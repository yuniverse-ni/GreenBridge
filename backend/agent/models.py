"""Main-agent contracts. Service facts, projections and narration stay separate."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator

from backend.data.intake.models import DataIntakeResult, ModuleReadiness, ValueEvidence
from backend.data.models import FinancialData, Provenance

Amount = Annotated[float, Field(ge=0)]
Fraction = Annotated[float, Field(ge=0, le=1)]
ToolName = Literal["get_carbon_analysis", "get_financial_analysis", "get_transition_options",
                   "simulate_transition", "simulate_financing", "check_transition_constraints", "rank_transition_pathways"]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, validate_default=True)

    @field_validator("*", mode="before")
    @classmethod
    def no_boolean_numbers(cls, value, info: ValidationInfo):
        if isinstance(value, bool) and cls.model_fields[info.field_name].annotation is not bool:
            raise ValueError("Boolean is not a numeric/service value")
        return value


class SMEConstraints(Contract):
    carbon_reduction_target_pct: float | None = Field(default=None, ge=0, le=100)
    minimum_cash_reserve: Amount | None = None
    maximum_payback_years: Amount | None = None
    maximum_capex: Amount | None = None
    minimum_post_financing_dscr: Amount | None = None
    maximum_annual_financing_payment: Amount | None = None


class FinancingTerms(Contract):
    annual_interest_rate_pct: Amount
    tenure_years: int = Field(ge=1, le=50, strict=True)


class FundingPolicy(Contract):
    mode: Literal["CASH_ONLY", "FINANCE_IF_NEEDED"] = "CASH_ONLY"
    grant_amount: Amount | None = None
    maximum_sme_contribution: Amount | None = None
    terms: FinancingTerms | None = None


class SMEObjective(Contract):
    mode: Literal["PLAN_TRANSITION", "ASSESS_CARBON", "ASSESS_FINANCIAL"] = "PLAN_TRANSITION"
    focus: Literal["CARBON", "COST", "BALANCED"] = "BALANCED"
    description: str = "Review feasible transition pathways"
    constraints: SMEConstraints = Field(default_factory=SMEConstraints)
    funding: FundingPolicy = Field(default_factory=FundingPolicy)
    action_ids: list[str] = Field(default_factory=list)


class AnalysisRequest(Contract):
    intake: DataIntakeResult
    objective: SMEObjective


class ServiceFacts(Contract):
    company_id: str = Field(min_length=1)
    reporting_year: int = Field(ge=1900, le=9999, strict=True)
    source: str = Field(min_length=1)
    origin: Literal["SERVICE", "TEST_DOUBLE"] = "SERVICE"
    assumptions: list[str] = Field(default_factory=list)
    evidence_limitations: list[str] = Field(default_factory=list)


class ImpactGroup(Contract):
    """Disjoint baseline allocation supplied by a service, never inferred here."""
    annual_emissions_tco2e: Amount | None = None
    annual_cost: Amount | None = None


class CarbonAnalysis(ServiceFacts):
    total_tco2e: Amount | None = None
    impact_groups: dict[str, ImpactGroup] = Field(default_factory=dict)

    @model_validator(mode="after")
    def disjoint_allocation(self):
        known = [group.annual_emissions_tco2e for group in self.impact_groups.values() if group.annual_emissions_tco2e is not None]
        if self.total_tco2e is not None and sum(known) > self.total_tco2e + 1e-8:
            raise ValueError("Disjoint impact groups exceed the total carbon baseline")
        return self


class FinanceMetric(Contract):
    value: float | None = None
    formatted: str
    is_calculable: bool
    status: Literal["healthy", "caution", "warning", "neutral", "not_calculable"]
    explanation: str
    formula: str


class FinanceResult(ServiceFacts):
    """One production finance contract; legacy graph fields remain compatible.

    inputs preserves all canonical supplied values. Metrics are calculated only
    from known inputs; EBITDA coverage is never represented as CFADS/DSCR.
    """
    currency: Literal["MYR"] = "MYR"
    inputs: FinancialData = Field(default_factory=FinancialData)
    gross_profit: float | None = None
    ebitda: float | None = None
    cash_above_reserve: float | None = None
    metrics: dict[str, FinanceMetric] = Field(default_factory=dict)
    financial_provenance: dict[str, list[Provenance]] = Field(default_factory=dict)
    evidence: list[ValueEvidence] = Field(default_factory=list)
    readiness: ModuleReadiness | None = None
    cash_balance: Amount | None = None
    capex_budget: Amount | None = None
    minimum_cash_reserve: Amount | None = None
    annual_cash_available_for_debt_service: float | None = None
    existing_annual_debt_service: Amount | None = None
    minimum_dscr: Amount | None = None


# Compatibility name used by the existing graph, tools and service providers.
FinancialAnalysis = FinanceResult


class TransitionAction(Contract):
    action_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    impact_group: str = Field(min_length=1)
    capex: Amount
    emissions_reduction_fraction: Fraction | None = None
    cost_saving_fraction: Fraction | None = None
    assumptions: list[str] = Field(default_factory=list)
    evidence_limitations: list[str] = Field(default_factory=list)


class PathwaySpec(Contract):
    pathway_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    action_ids: list[str] = Field(min_length=1)

    @field_validator("action_ids")
    @classmethod
    def unique_actions(cls, value):
        if len(set(value)) != len(value):
            raise ValueError("An action cannot be counted twice in a pathway")
        return value


class TransitionOptions(ServiceFacts):
    actions: list[TransitionAction]
    pathways: list[PathwaySpec]

    @model_validator(mode="after")
    def valid_catalog(self):
        action_ids = [item.action_id for item in self.actions]
        pathway_ids = [item.pathway_id for item in self.pathways]
        if len(set(action_ids)) != len(action_ids) or len(set(pathway_ids)) != len(pathway_ids):
            raise ValueError("Catalog action/pathway IDs must be unique")
        if any(not set(item.action_ids) <= set(action_ids) for item in self.pathways):
            raise ValueError("Pathway references an unknown action")
        return self


class CarbonToolResult(Contract):
    data: CarbonAnalysis | None = None
    missing_context: list[str] = Field(default_factory=list)


class FinancialToolResult(Contract):
    data: FinancialAnalysis | None = None
    missing_context: list[str] = Field(default_factory=list)


class TransitionOptionsResult(Contract):
    data: TransitionOptions | None = None
    missing_context: list[str] = Field(default_factory=list)


class TransitionRequest(Contract):
    pathway: PathwaySpec
    options: TransitionOptions
    carbon: CarbonAnalysis
    financial: FinancialAnalysis
    objective: SMEObjective

    @model_validator(mode="after")
    def same_company_and_period(self):
        if len({(item.company_id, item.reporting_year) for item in (self.options, self.carbon, self.financial)}) != 1:
            raise ValueError("Transition inputs must belong to one company/reporting year")
        return self


class StageImpact(Contract):
    action_id: str
    impact_group: str
    annual_savings: Amount | None
    annual_emissions_reduction_tco2e: Amount | None


class PathwaySimulation(Contract):
    pathway_id: str
    name: str
    action_ids: list[str]
    capex: Amount
    annual_savings: Amount | None
    annual_emissions_reduction_tco2e: Amount | None
    carbon_reduction_pct: Amount | None
    simple_payback_years: Amount | None
    grant: Amount | None
    sme_contribution: Amount | None
    financing_principal: Amount | None
    cash_impact: float | None
    remaining_cash: float | None
    stages: list[StageImpact]
    assumptions: list[str]
    evidence_limitations: list[str]
    missing_context: list[str]
    warnings: list[str]
    information_status: Literal["PROJECTED"] = "PROJECTED"


class FinancingRequest(Contract):
    capex: Amount
    sme_contribution: Amount
    grant: Amount
    principal: Amount
    annual_savings: Amount | None
    annual_cash_available_for_debt_service: float | None
    existing_annual_debt_service: Amount | None
    terms: FinancingTerms

    @model_validator(mode="after")
    def funding_reconciles(self):
        from math import isclose
        if not isclose(self.capex, self.sme_contribution + self.grant + self.principal, rel_tol=1e-12, abs_tol=1e-6):
            raise ValueError("CAPEX must equal SME contribution + grant + financing principal")
        return self


class FinancingSimulation(Contract):
    capex: Amount
    sme_contribution: Amount
    grant: Amount
    principal: Amount
    monthly_repayment: Amount
    annual_debt_service: Amount
    total_repayment: Amount
    total_interest: Amount
    net_annual_cash_flow: float | None
    post_financing_dscr: float | None
    terms: FinancingTerms
    assumptions: list[str]
    warnings: list[str]


class ConstraintCheck(Contract):
    name: str
    status: Literal["PASS", "FAIL", "UNKNOWN"]
    critical: bool = True
    reason: str
    missing_fields: list[str] = Field(default_factory=list)


class ConstraintRequest(Contract):
    pathway: PathwaySimulation
    financing: FinancingSimulation | None = None
    financial: FinancialAnalysis
    objective: SMEObjective


class ConstraintResult(Contract):
    pathway_id: str
    checks: list[ConstraintCheck]
    status: Literal["PASS", "FAIL", "UNKNOWN"]


class EvaluatedPathway(Contract):
    pathway: PathwaySimulation
    financing: FinancingSimulation | None = None
    constraints: ConstraintResult

    @model_validator(mode="after")
    def corresponding_results(self):
        from math import isclose
        if self.constraints.pathway_id != self.pathway.pathway_id:
            raise ValueError("Constraint result belongs to another pathway")
        if self.financing is not None:
            for finance_field, path_field in (("capex", "capex"), ("sme_contribution", "sme_contribution"),
                                            ("grant", "grant"), ("principal", "financing_principal")):
                path_value = getattr(self.pathway, path_field)
                if path_value is None or not isclose(getattr(self.financing, finance_field), path_value, rel_tol=1e-12, abs_tol=1e-6):
                    raise ValueError("Financing result does not match this pathway's funding")
        return self


class RankingRequest(Contract):
    pathways: list[EvaluatedPathway]
    objective: SMEObjective
    readiness_permits: bool
    excluded_pathway_ids: list[str] = Field(default_factory=list)

    @field_validator("pathways")
    @classmethod
    def unique_pathways(cls, value):
        ids = [item.pathway.pathway_id for item in value]
        if len(set(ids)) != len(ids):
            raise ValueError("Ranking requires unique pathway IDs")
        return value


class RankedPathway(EvaluatedPathway):
    rank: int = Field(ge=1)
    feasible: bool
    reasons: list[str]


class RankingResult(Contract):
    pathways: list[RankedPathway]
    selected_pathway_id: str | None
    rule: str


class Recommendation(Contract):
    selected_pathway_id: str | None = None
    summary: str
    reasons: list[str]
    screening_only: bool = True


class Explanation(Contract):
    selected_pathway_id: str | None
    summary: str
    trade_offs: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    missing_data: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def qualitative_only(self):
        # Numeric facts are displayed from deterministic outputs, not model prose.
        import re
        if any(re.search(r"\d", text) for text in [self.summary, *self.trade_offs, *self.risks, *self.missing_data]):
            raise ValueError("LLM commentary must be qualitative; numeric results stay structured")
        return self


class HumanDecision(Contract):
    action: Literal["ACCEPT", "REJECT", "REQUEST_ALTERNATIVE"]
    actor: str = Field(min_length=1, pattern=r"\S")
    reason: str = Field(min_length=1, pattern=r"\S")


class ContextResponse(Contract):
    actor: str = Field(min_length=1, pattern=r"\S")
    action: Literal["RESUME", "CANCEL"]
    intake_result: DataIntakeResult | None = None
    objective: SMEObjective | None = None


class TraceEvent(Contract):
    event: str
    detail: str
    tool: ToolName | None = None
    pathway_id: str | None = None
    at: datetime


class MainAgentInput(Contract):
    intake_result: DataIntakeResult
    objective: SMEObjective
