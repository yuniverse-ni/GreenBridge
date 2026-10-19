"""Allowlisted typed tools and replaceable service adapters; no production engines.

UnavailableServices is the safe default. FixtureServices requires caller-supplied
analyses/catalogs and explicitly marks them TEST_DOUBLE. It never derives carbon,
EBITDA or CFADS from intake records. Real teammates' services replace this adapter.
"""

from copy import deepcopy
from math import isclose
from typing import Protocol

from .constraints import check_transition_constraints, reserve_floor
from .financing import simulate_financing
from .models import (
    AnalysisRequest, CarbonAnalysis, CarbonToolResult, ConstraintRequest, ConstraintResult,
    FinancialAnalysis, FinancialToolResult, FinancingRequest, FinancingSimulation, PathwaySimulation,
    RankingRequest, RankingResult, StageImpact, TransitionOptions, TransitionOptionsResult, TransitionRequest,
)
from .ranking import rank_transition_pathways


class AnalysisServices(Protocol):
    def get_carbon_analysis(self, request: AnalysisRequest) -> CarbonToolResult: ...
    def get_financial_analysis(self, request: AnalysisRequest) -> FinancialToolResult: ...
    def get_transition_options(self, request: AnalysisRequest) -> TransitionOptionsResult: ...


class UnavailableServices:
    def get_carbon_analysis(self, request):
        return CarbonToolResult(missing_context=["carbon_service: connect an authoritative service adapter"])

    def get_financial_analysis(self, request):
        return FinancialToolResult(missing_context=["finance_service: connect an authoritative service adapter"])

    def get_transition_options(self, request):
        return TransitionOptionsResult(missing_context=["transition_service: provide a sourced action catalog"])


class FixtureServices(UnavailableServices):
    """Explicit test/demo fixtures, not automatic sample-company fallback data."""
    def __init__(self, *, carbon: CarbonAnalysis | None = None, financial: FinancialAnalysis | None = None,
                 options: TransitionOptions | None = None):
        self.carbon = carbon.model_copy(deep=True) if carbon else None
        self.financial = financial.model_copy(deep=True) if financial else None
        self.options = options.model_copy(deep=True) if options else None
        for value in (self.carbon, self.financial, self.options):
            if value is not None:
                value.origin = "TEST_DOUBLE"

    def get_carbon_analysis(self, request):
        return CarbonToolResult(data=self.carbon.model_copy(deep=True)) if self.carbon else super().get_carbon_analysis(request)

    def get_financial_analysis(self, request):
        return FinancialToolResult(data=self.financial.model_copy(deep=True)) if self.financial else super().get_financial_analysis(request)

    def get_transition_options(self, request):
        return TransitionOptionsResult(data=self.options.model_copy(deep=True)) if self.options else super().get_transition_options(request)


def simulate_transition(request: TransitionRequest) -> PathwaySimulation:
    catalog = {item.action_id: item for item in request.options.actions}
    if any(key not in catalog for key in request.pathway.action_ids):
        raise ValueError("Unknown action in pathway")
    groups = {key: value.model_dump() for key, value in request.carbon.impact_groups.items()}
    stages, missing, assumptions, limitations = [], [], [], []
    capex = 0.0
    for action_id in request.pathway.action_ids:
        action = catalog[action_id]
        capex += action.capex
        group = groups.get(action.impact_group, {})
        carbon, cost = group.get("annual_emissions_tco2e"), group.get("annual_cost")
        reduction = None if carbon is None or action.emissions_reduction_fraction is None else carbon * action.emissions_reduction_fraction
        savings = None if cost is None or action.cost_saving_fraction is None else cost * action.cost_saving_fraction
        # Apply each stage to the remaining disjoint group's baseline. Unknown
        # stage impacts make subsequent effects unknown, never silently zero.
        group["annual_emissions_tco2e"] = None if reduction is None else max(0, carbon - reduction)
        group["annual_cost"] = None if savings is None else max(0, cost - savings)
        groups[action.impact_group] = group
        if reduction is None:
            missing.append(f"{action_id}: sourced baseline/fraction for emissions is missing")
        if savings is None:
            missing.append(f"{action_id}: sourced cost baseline/savings fraction is missing")
        stages.append(StageImpact(action_id=action_id, impact_group=action.impact_group,
                                  annual_savings=savings, annual_emissions_reduction_tco2e=reduction))
        assumptions.extend(action.assumptions)
        limitations.extend(action.evidence_limitations)
    savings = None if any(item.annual_savings is None for item in stages) else sum(item.annual_savings for item in stages)
    reduction = None if any(item.annual_emissions_reduction_tco2e is None for item in stages) else sum(item.annual_emissions_reduction_tco2e for item in stages)
    baseline = request.carbon.total_tco2e
    fraction = None if baseline is None or baseline == 0 or reduction is None else reduction / baseline * 100
    funding, financial = request.objective.funding, request.financial
    grant = funding.grant_amount
    contribution = principal = remaining = None
    if grant is None:
        missing.append("funding.grant_amount: explicitly confirm zero or a documented grant")
    elif grant > capex:
        raise ValueError("Grant exceeds project CAPEX")
    else:
        net = capex - grant
        if funding.mode == "CASH_ONLY":
            contribution, principal = net, 0.0
            if funding.maximum_sme_contribution is not None and contribution > funding.maximum_sme_contribution:
                missing.append("Cash-only funding exceeds the declared SME contribution limit")
        else:
            reserve = reserve_floor(financial, request.objective)
            if financial.cash_balance is None or reserve is None:
                missing.append("cash_balance/minimum_cash_reserve: required to allocate financing")
            else:
                contribution = min(net, max(0, financial.cash_balance - reserve))
                if funding.maximum_sme_contribution is not None:
                    contribution = min(contribution, funding.maximum_sme_contribution)
                principal = net - contribution
    if contribution is not None and financial.cash_balance is not None:
        remaining = financial.cash_balance - contribution
    warnings = []
    if any(value.origin == "TEST_DOUBLE" for value in (request.carbon, request.financial, request.options)):
        warnings.append("TEST_DOUBLE: projections use supplied demonstration fixtures, not verified service analysis.")
    assumptions.extend(["Stages act sequentially on residual emissions/cost within explicitly disjoint impact groups.",
                        "Metrics are steady-state after all stages; simple payback does not model installation delays.",
                        "All CAPEX funding is reserved upfront; no overlapping standalone savings are blindly added."])
    return PathwaySimulation(
        pathway_id=request.pathway.pathway_id, name=request.pathway.name, action_ids=request.pathway.action_ids,
        capex=capex, annual_savings=savings, annual_emissions_reduction_tco2e=reduction, carbon_reduction_pct=fraction,
        simple_payback_years=None if savings is None or savings <= 0 else capex / savings,
        grant=grant, sme_contribution=contribution, financing_principal=principal,
        cash_impact=None if contribution is None else -contribution, remaining_cash=remaining, stages=stages,
        assumptions=[*request.carbon.assumptions, *request.financial.assumptions, *request.options.assumptions, *assumptions],
        evidence_limitations=[*request.carbon.evidence_limitations, *request.financial.evidence_limitations,
                              *request.options.evidence_limitations, *limitations],
        missing_context=missing, warnings=warnings,
    )


class AgentTools:
    """Typed allowlist; never getattr/eval a model- or document-supplied name."""
    def __init__(self, services: AnalysisServices | None = None):
        self.services = services if services is not None else UnavailableServices()

    def invoke(self, name: str, request):
        registry = {
            "get_carbon_analysis": (AnalysisRequest, CarbonToolResult, self.services.get_carbon_analysis),
            "get_financial_analysis": (AnalysisRequest, FinancialToolResult, self.services.get_financial_analysis),
            "get_transition_options": (AnalysisRequest, TransitionOptionsResult, self.services.get_transition_options),
            "simulate_transition": (TransitionRequest, PathwaySimulation, simulate_transition),
            "simulate_financing": (FinancingRequest, FinancingSimulation, simulate_financing),
            "check_transition_constraints": (ConstraintRequest, ConstraintResult, check_transition_constraints),
            "rank_transition_pathways": (RankingRequest, RankingResult, rank_transition_pathways),
        }
        if name not in registry:
            raise ValueError("Tool is not allowlisted")
        input_type, output_type, callback = registry[name]
        raw = request.model_dump() if hasattr(request, "model_dump") else request
        validated = input_type.model_validate(deepcopy(raw))
        module = {"get_carbon_analysis": "carbon_analysis", "get_financial_analysis": "financial_analysis",
                  "get_transition_options": "transition_analysis"}.get(name)
        if module and (validated.intake.agent_next_action != "PROCEED" or not validated.intake.readiness[module].may_proceed):
            raise ValueError("Intake readiness does not authorize this tool")
        result = callback(validated)
        result = output_type.model_validate(result.model_dump() if hasattr(result, "model_dump") else result)
        if isinstance(validated, AnalysisRequest) and result.data is not None:
            if (result.data.company_id != validated.intake.company.company_id
                    or result.data.reporting_year != validated.intake.company.reporting_year):
                raise ValueError("Service response belongs to another company/reporting year")
            if name == "get_financial_analysis" and validated.intake.normalized_data is not None:
                source = validated.intake.normalized_data.financial
                for output_field, input_field in (("cash_balance", "cash_balance"), ("capex_budget", "capex_budget"),
                                                  ("minimum_cash_reserve", "minimum_cash_reserve"),
                                                  ("existing_annual_debt_service", "annual_debt_service")):
                    observed, supplied = getattr(source, input_field), getattr(result.data, output_field)
                    if observed is not None and supplied is not None and not isclose(observed, supplied, rel_tol=1e-12, abs_tol=1e-6):
                        raise ValueError("Financial snapshot conflicts with intake; reconcile source/version before analysis")
        return result
