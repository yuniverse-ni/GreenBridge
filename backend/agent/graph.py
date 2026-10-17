"""Deterministic GreenBridge workflow with optional Gemini commentary.

Usage::

    result = graph.invoke({"company_id": "SME-APEX-01", "reporting_year": 2024})

Scenarios are evaluated independently, not as a combined portfolio. Financing
assumes the full CapEx is borrowed at 3.75% over seven years. Ranking prefers
eligible scenarios, then higher annual emissions reduction, higher net annual
cash flow, shorter payback, lower CapEx, and scenario ID as a stable tie-breaker.
Eligibility here is an illustrative screen, not a lender credit decision.
The optional explanation is separate from the authoritative recommendation and
cannot update ranked scenarios, metrics, or screening results.
"""

from copy import deepcopy
from math import isfinite
from typing import Dict, List, Optional

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from pydantic import TypeAdapter
from typing_extensions import NotRequired, TypedDict

from . import tools
from .llm import generate_transition_explanation


ANNUAL_INTEREST_RATE_PCT = 3.75
FINANCING_TENURE_YEARS = 7
MINIMUM_DSCR = 1.25


class RankedScenario(TypedDict):
    rank: int
    scenario: tools.TransitionScenario
    eligible: bool
    reasons: List[str]
    net_annual_cash_flow: Optional[float]
    simple_payback_years: Optional[float]
    post_financing_dscr: Optional[float]


class AgentState(TypedDict):
    company_id: str
    reporting_year: int
    carbon_analysis: NotRequired[Optional[tools.CarbonAnalysis]]
    financial_analysis: NotRequired[Optional[tools.FinancialAnalysis]]
    transition_scenarios: NotRequired[Optional[tools.TransitionScenarios]]
    financing_simulations: NotRequired[Dict[str, tools.FinancingSimulation]]
    ranked_scenarios: NotRequired[List[RankedScenario]]
    recommendation: NotRequired[Optional[str]]
    llm_explanation: NotRequired[Optional[str]]
    errors: NotRequired[List[str]]


class StateUpdate(TypedDict, total=False):
    carbon_analysis: Optional[tools.CarbonAnalysis]
    financial_analysis: Optional[tools.FinancialAnalysis]
    transition_scenarios: Optional[tools.TransitionScenarios]
    financing_simulations: Dict[str, tools.FinancingSimulation]
    ranked_scenarios: List[RankedScenario]
    recommendation: Optional[str]
    llm_explanation: Optional[str]
    errors: List[str]


def initialize_state(state: AgentState) -> StateUpdate:
    """Reset derived state so a new invocation cannot reuse stale results."""
    errors: List[str] = []
    company_id = state.get("company_id")
    reporting_year = state.get("reporting_year")
    if not isinstance(company_id, str) or not company_id.strip():
        errors.append("company_id must be a non-empty string")
    if type(reporting_year) is not int or not 1900 <= reporting_year <= 9999:
        errors.append("reporting_year must be an integer between 1900 and 9999")
    return {
        "carbon_analysis": None,
        "financial_analysis": None,
        "transition_scenarios": None,
        "financing_simulations": {},
        "ranked_scenarios": [],
        "recommendation": "Unable to run: invalid company or reporting year." if errors else None,
        "llm_explanation": None,
        "errors": errors,
    }


def load_analyses(state: AgentState) -> StateUpdate:
    """Load independently so a failed carbon call does not hide finance errors."""
    errors = list(state.get("errors", []))
    update: StateUpdate = {"carbon_analysis": None, "financial_analysis": None}
    try:
        update["carbon_analysis"] = TypeAdapter(tools.CarbonAnalysis).validate_python(
            tools.get_carbon_analysis(state["company_id"], state["reporting_year"])
        )
    except Exception as exc:
        errors.append(f"load_carbon_analysis: {exc}")
    try:
        update["financial_analysis"] = TypeAdapter(tools.FinancialAnalysis).validate_python(
            tools.get_financial_analysis(state["company_id"], state["reporting_year"])
        )
    except Exception as exc:
        errors.append(f"load_financial_analysis: {exc}")
    update["errors"] = errors
    return update


def _non_negative(value: float, field: str) -> None:
    if not isfinite(value) or value < 0:
        raise ValueError(f"{field} must be finite and non-negative")


def load_scenarios(state: AgentState) -> StateUpdate:
    errors = list(state.get("errors", []))
    try:
        scenarios = TypeAdapter(tools.TransitionScenarios).validate_python(
            tools.get_transition_scenarios(state["company_id"], state["reporting_year"])
        )
        seen = set()
        for scenario in scenarios["scenarios"]:
            scenario_id = scenario["scenario_id"]
            if not scenario_id.strip() or scenario_id in seen:
                raise ValueError("Scenario IDs must be non-empty and unique")
            seen.add(scenario_id)
            for field in ("capex", "annual_savings", "annual_emissions_reduction_tco2e"):
                _non_negative(scenario[field], field)
        return {"transition_scenarios": scenarios, "errors": errors}
    except Exception as exc:
        errors.append(f"load_transition_scenarios: {exc}")
        return {"transition_scenarios": None, "errors": errors}


def simulate_scenario_financing(state: AgentState) -> StateUpdate:
    """Use explicit full-CapEx financing; zero-CapEx actions need no loan."""
    errors = list(state.get("errors", []))
    simulations: Dict[str, tools.FinancingSimulation] = {}
    dataset = state.get("transition_scenarios")
    for scenario in dataset["scenarios"] if dataset else []:
        if scenario["capex"] == 0:
            continue
        try:
            simulation = TypeAdapter(tools.FinancingSimulation).validate_python(
                tools.simulate_financing(
                    loan_amount=scenario["capex"],
                    annual_interest_rate_pct=ANNUAL_INTEREST_RATE_PCT,
                    tenure_years=FINANCING_TENURE_YEARS,
                    annual_savings=scenario["annual_savings"],
                )
            )
            _non_negative(simulation["annual_debt_service"], "annual_debt_service")
            if not isfinite(simulation["net_annual_cash_flow"]):
                raise ValueError("net_annual_cash_flow must be finite")
            simulations[scenario["scenario_id"]] = simulation
        except Exception as exc:
            errors.append(f"simulate_financing[{scenario['scenario_id']}]: {exc}")
    return {"financing_simulations": simulations, "errors": errors}


def rank_scenarios(state: AgentState) -> StateUpdate:
    """Apply transparent screening and stable sorting without model judgement."""
    errors = list(state.get("errors", []))
    carbon = state.get("carbon_analysis")
    financial = state.get("financial_analysis")
    dataset = state.get("transition_scenarios")
    if carbon is None or financial is None or dataset is None:
        return {
            "ranked_scenarios": [],
            "recommendation": "Unable to recommend: required analysis or scenario data is missing. See errors.",
            "errors": errors,
        }
    try:
        for field in ("max_capex_budget", "ebitda", "existing_annual_debt_service"):
            _non_negative(financial[field], field)
        _non_negative(carbon["total_tco2e"], "total_tco2e")
    except ValueError as exc:
        errors.append(f"rank_scenarios: {exc}")
        return {
            "ranked_scenarios": [],
            "recommendation": "Unable to recommend: invalid analysis values. See errors.",
            "errors": errors,
        }

    ranked: List[RankedScenario] = []
    simulations = state.get("financing_simulations", {})
    for scenario in dataset["scenarios"]:
        reasons: List[str] = []
        capex = scenario["capex"]
        savings = scenario["annual_savings"]
        simulation = simulations.get(scenario["scenario_id"])
        cash_flow: Optional[float] = savings if capex == 0 else None
        dscr: Optional[float] = None
        annual_debt = 0.0
        if capex > 0:
            if simulation is None:
                reasons.append("Financing simulation unavailable.")
            else:
                annual_debt = simulation["annual_debt_service"]
                cash_flow = simulation["net_annual_cash_flow"]
        if capex > financial["max_capex_budget"]:
            reasons.append("CapEx exceeds the declared project budget.")
        if cash_flow is not None and cash_flow <= 0:
            reasons.append("Net annual cash flow is not positive.")
        total_debt_service = financial["existing_annual_debt_service"] + annual_debt
        if capex == 0 or simulation is not None:
            if total_debt_service > 0:
                dscr = (financial["ebitda"] + savings) / total_debt_service
                if dscr < MINIMUM_DSCR:
                    reasons.append("Illustrative post-financing DSCR is below 1.25.")
        if scenario["annual_emissions_reduction_tco2e"] <= 0:
            reasons.append("No positive annual emissions reduction.")
        if carbon["total_tco2e"] <= 0:
            reasons.append("A positive carbon baseline is required.")
        elif scenario["annual_emissions_reduction_tco2e"] > carbon["total_tco2e"]:
            reasons.append("Claimed reduction exceeds the total carbon baseline.")
        ranked.append({
            "rank": 0,
            "scenario": scenario,
            "eligible": not reasons,
            "reasons": reasons,
            "net_annual_cash_flow": cash_flow,
            "simple_payback_years": capex / savings if savings > 0 else None,
            "post_financing_dscr": dscr,
        })

    ranked.sort(key=lambda item: (
        not item["eligible"],
        -item["scenario"]["annual_emissions_reduction_tco2e"],
        -(item["net_annual_cash_flow"] if item["net_annual_cash_flow"] is not None else float("-inf")),
        item["simple_payback_years"] if item["simple_payback_years"] is not None else float("inf"),
        item["scenario"]["capex"],
        item["scenario"]["scenario_id"],
    ))
    for position, item in enumerate(ranked, 1):
        item["rank"] = position
    if not ranked:
        recommendation = "No transition scenarios are available."
    elif not ranked[0]["eligible"]:
        recommendation = "No scenario passes the illustrative budget, cash-flow, carbon, and debt-coverage screen."
    else:
        best = ranked[0]
        recommendation = (
            f"Recommend reviewing {best['scenario']['name']} "
            f"({best['scenario']['scenario_id']}): highest annual emissions reduction "
            f"among scenarios passing the screen, with estimated net annual cash flow "
            f"of MYR {best['net_annual_cash_flow']:,.2f}."
        )
    recommendation += (
        " TEMPORARY MOCK DATA: evaluate scenarios independently; financing assumes "
        "100% of CapEx at 3.75% over 7 years and minimum DSCR of 1.25. "
        "DSCR uses (EBITDA + annual savings) / (existing + new annual debt service); "
        "null DSCR means no debt service or unavailable simulation."
    )
    if errors:
        recommendation += " Results are partial; review errors before using them."
    return {"ranked_scenarios": ranked, "recommendation": recommendation, "errors": errors}


def explain_recommendation(state: AgentState) -> StateUpdate:
    """Add optional narration without permitting changes to deterministic state."""
    fallback = state.get("recommendation")
    if not state.get("ranked_scenarios"):
        return {"llm_explanation": fallback}
    # Detached inputs prevent a helper from mutating authoritative nested state.
    facts = deepcopy({
        "carbon_analysis": state.get("carbon_analysis"),
        "financial_analysis": state.get("financial_analysis"),
        "ranked_scenarios": state.get("ranked_scenarios"),
        "deterministic_recommendation": fallback,
        "errors": state.get("errors", []),
    })
    try:
        explanation = generate_transition_explanation(facts)
        if isinstance(explanation, str) and explanation.strip():
            return {"llm_explanation": explanation.strip()}
        failure = (
            "explain_recommendation: Gemini unavailable or returned no explanation; "
            "deterministic recommendation retained."
        )
    except Exception:
        # Provider exceptions can contain request details; do not expose them.
        failure = (
            "explain_recommendation: Gemini explanation failed; "
            "deterministic recommendation retained."
        )
    return {
        "llm_explanation": fallback,
        "errors": [*state.get("errors", []), failure],
    }


def build_graph() -> CompiledStateGraph:
    """Build a fresh, stateless workflow suitable for invoke/ainvoke/stream."""
    workflow = StateGraph(AgentState)
    workflow.add_node("initialize", initialize_state)
    workflow.add_node("load_analyses", load_analyses)
    workflow.add_node("load_scenarios", load_scenarios)
    workflow.add_node("simulate_financing", simulate_scenario_financing)
    workflow.add_node("rank_scenarios", rank_scenarios)
    workflow.add_node("explain_recommendation", explain_recommendation)
    workflow.add_edge(START, "initialize")
    workflow.add_conditional_edges(
        "initialize",
        lambda state: "invalid" if state.get("errors") else "valid",
        {"invalid": END, "valid": "load_analyses"},
    )
    workflow.add_edge("load_analyses", "load_scenarios")
    workflow.add_edge("load_scenarios", "simulate_financing")
    workflow.add_edge("simulate_financing", "rank_scenarios")
    workflow.add_edge("rank_scenarios", "explain_recommendation")
    workflow.add_edge("explain_recommendation", END)
    return workflow.compile()


graph = build_graph()
