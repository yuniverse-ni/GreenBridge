"""Readiness-gated main LangGraph. No lender-pack or disclosure operations.

Inject real AnalysisServices when available; safe defaults request context.
Callers must authenticate human resume actors and isolate company/thread IDs.
Human ACCEPT records SME pathway review only, never approval to disclose.
"""

from datetime import datetime, timezone

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from .llm import GeminiAssistant, explain_results
from .models import (
    AnalysisRequest, CarbonAnalysis, ConstraintRequest, ConstraintResult, ContextResponse,
    EvaluatedPathway, FinancialAnalysis, FinancingRequest, FinancingSimulation, HumanDecision,
    MainAgentInput, PathwaySimulation, PathwaySpec, RankingRequest, Recommendation,
    SMEObjective, TraceEvent, TransitionOptions, TransitionRequest,
)
from .state import MainAgentState
from .tools import AgentTools
from backend.data.intake.models import DataIntakeResult


def event(name, detail, **extra):
    return TraceEvent(event=name, detail=detail, at=datetime.now(timezone.utc), **extra).model_dump(mode="json")


def required_modules(objective):
    return {"ASSESS_CARBON": ["carbon_analysis"], "ASSESS_FINANCIAL": ["financial_analysis"],
            "PLAN_TRANSITION": ["carbon_analysis", "financial_analysis", "transition_analysis"]}[objective.mode]


def cleared_results():
    return {"tool_results": {}, "transition_candidates": [], "transition_pathways": [], "financing_results": {},
            "constraint_results": {}, "ranked_pathways": [], "recommendation": None, "llm_explanation": None,
            "human_decision": None, "excluded_pathway_ids": [], "errors": [], "missing_context": [], "tool_plan": []}


def initialize(state):
    first = MainAgentInput.model_validate({"intake_result": state["intake_result"], "objective": state["objective"]})
    validated = MainAgentInput.model_validate(first.model_dump())
    return {**validated.model_dump(mode="json"), **cleared_results(), "warnings": [], "human_history": [],
            "execution_trace": [event("AGENT_STARTED", "Main agent started; no disclosure operations are available.")],
            "status": "PROCESSING"}


def check_readiness(state):
    intake = DataIntakeResult.model_validate(state["intake_result"])
    objective = SMEObjective.model_validate(state["objective"])
    missing, warnings = [], list(state["warnings"])
    if intake.agent_next_action != "PROCEED" or intake.normalized_data is None:
        missing.append("Complete/resume Data Intake before running analysis tools.")
    if not intake.company.company_id or intake.company.reporting_year is None:
        missing.append("Company ID and reporting year are required.")
    for module in required_modules(objective):
        ready = intake.readiness[module]
        if not ready.may_proceed:
            missing.append(f"{module}: {ready.status}; evidence/explicit partial acceptance required.")
        elif ready.status == "PARTIAL":
            warnings.append(f"{module} remains PARTIAL with recorded SME acceptance; limitations propagate.")
    return {"company_id": intake.company.company_id, "reporting_year": intake.company.reporting_year,
            "readiness": {key: value.model_dump() for key, value in intake.readiness.items()},
            "missing_context": missing, "warnings": list(dict.fromkeys(warnings)),
            "status": "NEEDS_CONTEXT" if missing else "PROCESSING",
            "execution_trace": [*state["execution_trace"], event("READINESS_CHECKED", f"Required modules: {', '.join(required_modules(objective))}.")]}


def select_tools(state):
    objective = SMEObjective.model_validate(state["objective"])
    plan = {"ASSESS_CARBON": ["get_carbon_analysis"], "ASSESS_FINANCIAL": ["get_financial_analysis"],
            "PLAN_TRANSITION": ["get_carbon_analysis", "get_financial_analysis", "get_transition_options"]}[objective.mode]
    return {"tool_plan": plan, "execution_trace": [*state["execution_trace"], event("TOOL_PLAN_SELECTED", ", ".join(plan))]}


def request_context(state):
    response = interrupt({"status": "NEEDS_CONTEXT", "missing_context": state["missing_context"],
                          "readiness": state.get("readiness", {}), "warnings": state["warnings"],
                          "errors": state["errors"], "instruction": "Supply an updated DataIntakeResult/structured objective, retry a connected service, or CANCEL. Raw analysis values and tool names are not accepted here."})
    try:
        human = ContextResponse.model_validate(response)
        audit = {"kind": "CONTEXT_RESPONSE", **human.model_dump(mode="json", exclude={"intake_result", "objective"}),
                 "at": datetime.now(timezone.utc).isoformat()}
        if human.action == "CANCEL":
            return {"status": "CANCELLED", "human_history": [*state["human_history"], audit]}
        return {**cleared_results(), "intake_result": human.intake_result.model_dump(mode="json") if human.intake_result else state["intake_result"],
                "objective": human.objective.model_dump(mode="json") if human.objective else state["objective"],
                "status": "PROCESSING", "warnings": [], "human_history": [*state["human_history"], audit],
                "execution_trace": [*state["execution_trace"], event("CONTEXT_SUPPLIED", "Human supplied/retried context; all derived results invalidated.")]}
    except ValueError:
        return {"status": "NEEDS_CONTEXT", "errors": [*state["errors"], "Invalid context response; use RESUME/CANCEL and typed inputs."]}


def build_graph(*, services=None, tools=None, assistant=None, checkpointer=None):
    registry = tools if tools is not None else AgentTools(services)
    narrator = assistant if assistant is not None else GeminiAssistant()

    def call(name, request, trace, pathway_id=None):
        trace.append(event("TOOL_CALLED", "Invoking typed allowlisted tool.", tool=name, pathway_id=pathway_id))
        return registry.invoke(name, request)

    def load_analyses(state):
        trace, results, missing, warnings = list(state["execution_trace"]), {}, [], list(state["warnings"])
        request = AnalysisRequest(intake=state["intake_result"], objective=state["objective"])
        for name in state["tool_plan"]:
            try:
                result = call(name, request, trace)
                results[name] = result.model_dump(mode="json")
                missing.extend(result.missing_context)
                if result.data is None and not result.missing_context:
                    missing.append(f"{name}: service returned no analysis")
                if result.data is not None and result.data.origin == "TEST_DOUBLE":
                    warnings.append(f"TEST_DOUBLE: {name} uses explicit fixtures, not verified service data.")
            except Exception:
                trace.append(event("TOOL_FAILED", "Service response unavailable or failed contract validation.", tool=name))
                missing.append(f"{name}: connect/repair a valid scoped service adapter")
        return {"tool_results": results, "missing_context": missing, "warnings": list(dict.fromkeys(warnings)),
                "execution_trace": trace, "status": "NEEDS_CONTEXT" if missing else "PROCESSING"}

    def simulate_pathways(state):
        trace, paths, warnings, errors = list(state["execution_trace"]), [], list(state["warnings"]), []
        objective = SMEObjective.model_validate(state["objective"])
        options = TransitionOptions.model_validate(state["tool_results"]["get_transition_options"]["data"])
        carbon = CarbonAnalysis.model_validate(state["tool_results"]["get_carbon_analysis"]["data"])
        financial = FinancialAnalysis.model_validate(state["tool_results"]["get_financial_analysis"]["data"])
        known = {item.action_id for item in options.actions}
        if not set(objective.action_ids) <= known:
            return {"status": "NEEDS_CONTEXT", "missing_context": ["Requested action IDs are not in the sourced transition catalog."]}
        specs = options.pathways or [PathwaySpec(pathway_id=item.action_id, name=item.name, action_ids=[item.action_id]) for item in options.actions]
        specs = [item for item in specs if not objective.action_ids or set(item.action_ids) <= set(objective.action_ids)]
        for spec in specs:
            try:
                result = call("simulate_transition", TransitionRequest(pathway=spec, options=options, carbon=carbon,
                              financial=financial, objective=objective), trace, spec.pathway_id)
                result.evidence_limitations.extend(item["message"] for item in state["intake_result"]["data_gaps"])
                result.evidence_limitations.extend(warning for warning in state["warnings"] if "PARTIAL" in warning)
                paths.append(result.model_dump(mode="json"))
                warnings.extend(result.warnings)
                trace.append(event("PATHWAY_SIMULATED", "Ordered residual-impact projection calculated.", pathway_id=spec.pathway_id))
            except Exception:
                errors.append(f"{spec.pathway_id}: transition simulation failed validation; excluded.")
                trace.append(event("TOOL_FAILED", "Pathway simulation failed validation.", tool="simulate_transition", pathway_id=spec.pathway_id))
        return {"transition_candidates": [item.model_dump(mode="json") for item in options.actions], "transition_pathways": paths,
                "warnings": list(dict.fromkeys([*warnings, *errors])), "errors": errors, "execution_trace": trace,
                "status": "PROCESSING" if paths else "NEEDS_CONTEXT",
                "missing_context": [] if paths else ["Provide a valid pathway catalog/funding context; no pathways could be simulated."]}

    def finance_pathways(state):
        trace, results, missing, warnings = list(state["execution_trace"]), {}, [], list(state["warnings"])
        objective = SMEObjective.model_validate(state["objective"])
        financial = FinancialAnalysis.model_validate(state["tool_results"]["get_financial_analysis"]["data"])
        if objective.funding.terms is None:
            return {"status": "NEEDS_CONTEXT", "missing_context": ["funding.terms: explicit interest rate and tenure are required."]}
        for raw in state["transition_pathways"]:
            path = PathwaySimulation.model_validate(raw)
            if path.financing_principal is None or path.financing_principal == 0:
                continue
            try:
                result = call("simulate_financing", FinancingRequest(
                    capex=path.capex, sme_contribution=path.sme_contribution, grant=path.grant,
                    principal=path.financing_principal, terms=objective.funding.terms, annual_savings=path.annual_savings,
                    annual_cash_available_for_debt_service=financial.annual_cash_available_for_debt_service,
                    existing_annual_debt_service=financial.existing_annual_debt_service), trace, path.pathway_id)
                results[path.pathway_id] = result.model_dump(mode="json")
                warnings.extend(result.warnings)
                trace.append(event("FINANCING_SIMULATED", "Funding reconciled; monthly amortisation calculated.", pathway_id=path.pathway_id))
            except Exception:
                missing.append(f"{path.pathway_id}: financing inputs failed validation")
                trace.append(event("TOOL_FAILED", "Financing inputs failed validation.", tool="simulate_financing", pathway_id=path.pathway_id))
        return {"financing_results": results, "warnings": list(dict.fromkeys(warnings)), "missing_context": missing,
                "execution_trace": trace, "status": "NEEDS_CONTEXT" if missing else "PROCESSING"}

    def constrain_pathways(state):
        trace, results = list(state["execution_trace"]), {}
        financial = FinancialAnalysis.model_validate(state["tool_results"]["get_financial_analysis"]["data"])
        for path in state["transition_pathways"]:
            result = call("check_transition_constraints", ConstraintRequest(pathway=path, financial=financial,
                financing=state["financing_results"].get(path["pathway_id"]), objective=state["objective"]), trace, path["pathway_id"])
            results[path["pathway_id"]] = result.model_dump(mode="json")
        trace.append(event("CONSTRAINTS_CHECKED", "Critical UNKNOWN checks cannot pass screening."))
        return {"constraint_results": results, "execution_trace": trace}

    def rank_pathways(state):
        trace = list(state["execution_trace"])
        objective = SMEObjective.model_validate(state["objective"])
        evaluated = [EvaluatedPathway(pathway=path, financing=state["financing_results"].get(path["pathway_id"]),
                     constraints=state["constraint_results"][path["pathway_id"]]) for path in state["transition_pathways"]]
        result = call("rank_transition_pathways", RankingRequest(pathways=evaluated, objective=objective,
            readiness_permits=all(state["readiness"][module]["may_proceed"] for module in required_modules(objective)),
            excluded_pathway_ids=state["excluded_pathway_ids"]), trace)
        missing = list(dict.fromkeys(field for item in result.pathways for check in item.constraints.checks
                                    if check.critical and check.status == "UNKNOWN" for field in check.missing_fields))
        warnings = list(state["warnings"])
        if missing:
            warnings.append("Some alternatives have critical UNKNOWN checks and cannot be recommended.")
        selected = next((item for item in result.pathways if item.pathway.pathway_id == result.selected_pathway_id), None)
        exhausted = selected is None and bool(state["excluded_pathway_ids"])
        if exhausted:
            missing.append("No unreviewed feasible alternatives remain; revise the objective/catalog or cancel.")
        recommendation = Recommendation(selected_pathway_id=result.selected_pathway_id,
            summary=f"Review {selected.pathway.name}: it passes the illustrative screen. {result.rule}" if selected else "No available pathway passes all critical checks.",
            reasons=[result.rule, "This is SME decision support, not a lending decision or disclosure authorization."] +
                    ([f"{check.name}: {check.status}" for check in selected.constraints.checks] if selected else []))
        trace.append(event("PATHWAYS_RANKED", result.rule))
        trace.append(event("RECOMMENDATION_GENERATED", "Selection is exclusively deterministic.", pathway_id=result.selected_pathway_id))
        return {"ranked_pathways": [item.model_dump(mode="json") for item in result.pathways],
                "recommendation": recommendation.model_dump(mode="json"), "missing_context": missing,
                "warnings": list(dict.fromkeys(warnings)), "execution_trace": trace,
                "status": "NEEDS_CONTEXT" if selected is None and missing else "PROCESSING"}

    def summarize_analysis(state):
        mode = SMEObjective.model_validate(state["objective"]).mode
        result = Recommendation(summary=f"{mode} service results are available for SME review.",
                                reasons=["No transition selection or lending/disclosure approval was made."])
        return {"recommendation": result.model_dump(mode="json"),
                "execution_trace": [*state["execution_trace"], event("RECOMMENDATION_GENERATED", "Analysis-only objective; transition tools skipped.")]}

    def explain_recommendation(state):
        facts = {"objective": state["objective"], "recommendation": state["recommendation"],
                 "carbon_analysis": state["tool_results"].get("get_carbon_analysis", {}).get("data"),
                 "financial_analysis": state["tool_results"].get("get_financial_analysis", {}).get("data"),
                 "ranked_pathways": state["ranked_pathways"], "readiness": state["readiness"],
                 "warnings": state["warnings"], "missing_context": state["missing_context"], "errors": state["errors"]}
        explanation, failure = explain_results(facts, narrator)
        return {"llm_explanation": explanation.model_dump(mode="json"),
                "warnings": [*state["warnings"], *([failure] if failure else [])], "status": "HUMAN_REVIEW_REQUIRED",
                "execution_trace": [*state["execution_trace"], event("EXPLANATION_FALLBACK" if failure else "EXPLANATION_GENERATED", "Commentary cannot update deterministic state."),
                                    event("HUMAN_REVIEW_REQUESTED", "SME must ACCEPT, REJECT or REQUEST_ALTERNATIVE.")]}

    def human_review(state):
        response = interrupt({"status": "HUMAN_REVIEW_REQUIRED", "recommendation": state["recommendation"],
                              "ranked_pathways": state["ranked_pathways"], "explanation": state["llm_explanation"],
                              "readiness": state["readiness"], "warnings": state["warnings"], "errors": state["errors"],
                              "instruction": "ACCEPT/REJECT/REQUEST_ALTERNATIVE with actor and reason. Acceptance is not lender or disclosure approval."})
        try:
            decision = HumanDecision.model_validate(response)
            selected = state["recommendation"]["selected_pathway_id"]
            mode = SMEObjective.model_validate(state["objective"]).mode
            if decision.action == "ACCEPT" and mode == "PLAN_TRANSITION" and selected is None:
                raise ValueError("No feasible pathway can be accepted")
            audit = {**decision.model_dump(), "selected_pathway_id": selected, "at": datetime.now(timezone.utc).isoformat()}
            trace = [*state["execution_trace"], event("HUMAN_DECISION_RECORDED", f"SME decision: {decision.action}; no disclosure authorized.", pathway_id=selected)]
            if decision.action == "REQUEST_ALTERNATIVE":
                if selected is None or mode != "PLAN_TRANSITION":
                    return {"human_history": [*state["human_history"], audit], "execution_trace": trace, "status": "NEEDS_CONTEXT",
                            "missing_context": ["No further selected alternative; revise objective/context or cancel."]}
                return {"excluded_pathway_ids": [*state["excluded_pathway_ids"], selected], "human_decision": None,
                        "human_history": [*state["human_history"], audit], "execution_trace": trace, "status": "ALTERNATIVE_REQUESTED"}
            return {"human_decision": audit, "human_history": [*state["human_history"], audit], "execution_trace": trace,
                    "status": "ACCEPTED" if decision.action == "ACCEPT" else "REJECTED"}
        except ValueError:
            return {"status": "HUMAN_REVIEW_REQUIRED", "warnings": [*state["warnings"], "Invalid review decision; no SME acceptance recorded."]}

    flow = StateGraph(MainAgentState)
    nodes = {"initialize": initialize, "check_readiness": check_readiness, "request_context": request_context,
             "select_tools": select_tools, "load_analyses": load_analyses, "simulate_pathways": simulate_pathways,
             "finance_pathways": finance_pathways, "check_constraints": constrain_pathways, "rank_pathways": rank_pathways,
             "summarize_analysis": summarize_analysis, "explain_recommendation": explain_recommendation, "human_review": human_review}
    for name, node in nodes.items():
        flow.add_node(name, node)
    flow.add_edge(START, "initialize")
    flow.add_edge("initialize", "check_readiness")
    flow.add_conditional_edges("check_readiness", lambda state: "request_context" if state["status"] == "NEEDS_CONTEXT" else "select_tools")
    flow.add_conditional_edges("request_context", lambda state: END if state["status"] == "CANCELLED" else "request_context" if state["status"] == "NEEDS_CONTEXT" else "check_readiness")
    flow.add_edge("select_tools", "load_analyses")
    flow.add_conditional_edges("load_analyses", lambda state: "request_context" if state["status"] == "NEEDS_CONTEXT" else "simulate_pathways" if state["objective"]["mode"] == "PLAN_TRANSITION" else "summarize_analysis")
    flow.add_conditional_edges("simulate_pathways", lambda state: "request_context" if state["status"] == "NEEDS_CONTEXT" else "finance_pathways" if any(path["financing_principal"] is not None and path["financing_principal"] > 0 for path in state["transition_pathways"]) else "check_constraints")
    flow.add_conditional_edges("finance_pathways", lambda state: "request_context" if state["status"] == "NEEDS_CONTEXT" else "check_constraints")
    flow.add_edge("check_constraints", "rank_pathways")
    flow.add_conditional_edges("rank_pathways", lambda state: "request_context" if state["status"] == "NEEDS_CONTEXT" else "explain_recommendation")
    flow.add_edge("summarize_analysis", "explain_recommendation")
    flow.add_edge("explain_recommendation", "human_review")
    flow.add_conditional_edges("human_review", lambda state: "rank_pathways" if state["status"] == "ALTERNATIVE_REQUESTED" else "request_context" if state["status"] == "NEEDS_CONTEXT" else "human_review" if state["status"] == "HUMAN_REVIEW_REQUIRED" else END)
    return flow.compile(checkpointer=checkpointer if checkpointer is not None else InMemorySaver(), name="greenbridge_main_agent")


class MainAgent:
    """JSON-ready facade. Always use unique company-scoped thread IDs."""
    def __init__(self, **options):
        self.graph = build_graph(**options)

    @staticmethod
    def _public(state):
        return {**state, "__interrupt__": [{"id": item.id, "value": item.value} for item in state.get("__interrupt__", [])]}

    def invoke(self, inputs, config):
        if isinstance(inputs, MainAgentInput):
            inputs = inputs.model_dump(mode="json")
        return self._public(self.graph.invoke(inputs, config))

    async def ainvoke(self, inputs, config):
        if isinstance(inputs, MainAgentInput):
            inputs = inputs.model_dump(mode="json")
        return self._public(await self.graph.ainvoke(inputs, config))
