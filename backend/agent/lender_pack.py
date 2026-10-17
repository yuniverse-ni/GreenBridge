"""Build a reviewable transition pack from deterministic graph results only.

No LLM, calculations, lender submission, or external sharing occurs here.
generate_lender_pack(state) always creates a DRAFT. Explicit owner authorization
can be recorded with set_approval_status(pack, ApprovalStatus.APPROVED, actor=...).
Approval records authorization to disclose, not lender approval or verification.
Callers must authenticate/authorize the actor before recording their decision.
"""

from copy import deepcopy
from datetime import datetime, timezone
from enum import Enum
from math import isfinite
from typing import Any, List, Literal, Mapping, Optional

from pydantic import BaseModel, ConfigDict, TypeAdapter, computed_field, model_validator

from . import tools


class ApprovalStatus(str, Enum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Approval(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status: ApprovalStatus = ApprovalStatus.DRAFT
    actor: Optional[str] = None
    decided_at: Optional[datetime] = None
    reason: Optional[str] = None

    @model_validator(mode="after")
    def require_explicit_decision(self) -> "Approval":
        if self.status != ApprovalStatus.DRAFT:
            if not self.actor or not self.actor.strip() or self.decided_at is None:
                raise ValueError("Approval/rejection requires an actor and decision timestamp")
        return self


class ProjectedPathway(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, allow_inf_nan=False)

    information_status: Literal["PROJECTED"] = "PROJECTED"
    selected_scenario: tools.TransitionScenario
    capex: float
    annual_savings: float
    annual_emissions_reduction_tco2e: float
    financing_simulation: Optional[tools.FinancingSimulation]
    post_financing_dscr: Optional[float]
    deterministic_screen_passed: bool
    deterministic_screen_reasons: List[str]


class EvidenceStatus(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status: Literal["MOCK_UNVERIFIED", "UNVERIFIED"]
    verified: Literal[False] = False
    description: str


class LenderPack(BaseModel):
    """Structured pack; use model_dump(mode='json') for a JSON-ready dictionary.

    Sharing/submission flags are derived from approval, never accepted as inputs.
    They describe authorization only; this module performs neither operation.
    """

    model_config = ConfigDict(extra="forbid", frozen=True, allow_inf_nan=False)

    company_id: str
    reporting_year: int
    currency: str
    carbon_baseline: tools.CarbonAnalysis
    carbon_baseline_information_status: Literal["MOCK_UNVERIFIED", "UNVERIFIED"]
    projected_pathway: ProjectedPathway
    is_mock: bool
    assumptions: List[str]
    data_limitations: List[str]
    evidence_status: EvidenceStatus
    approval: Approval

    @computed_field
    @property
    def shareable(self) -> bool:
        return self.approval.status == ApprovalStatus.APPROVED

    @computed_field
    @property
    def submittable(self) -> bool:
        return self.approval.status == ApprovalStatus.APPROVED


def _check_finite(value: Any) -> None:
    """Reject non-finite service values without replacing or recalculating them."""
    if isinstance(value, float) and not isfinite(value):
        raise ValueError("Deterministic results must contain only finite numeric values")
    if isinstance(value, dict):
        for item in value.values():
            _check_finite(item)
    elif isinstance(value, list):
        for item in value:
            _check_finite(item)


def generate_lender_pack(
    state: Mapping[str, Any], selected_scenario_id: Optional[str] = None
) -> LenderPack:
    """Copy existing results into a DRAFT; do not run tools or infer new numbers.

    By default select the graph's rank-one scenario. An explicit ID must match
    exactly one ranked scenario. Missing analysis, financing for positive CapEx,
    or inconsistent company/period/financing inputs raises ValueError. Company
    names and evidence documents are not invented when absent from graph state.
    LLM explanation and recommendation text are deliberately excluded.
    """
    company_id = state.get("company_id")
    year = state.get("reporting_year")
    if not isinstance(company_id, str) or not company_id.strip():
        raise ValueError("company_id must be a non-empty string")
    if type(year) is not int or not 1900 <= year <= 9999:
        raise ValueError("reporting_year must be an integer between 1900 and 9999")
    carbon = TypeAdapter(tools.CarbonAnalysis).validate_python(state.get("carbon_analysis"))
    financial = TypeAdapter(tools.FinancialAnalysis).validate_python(state.get("financial_analysis"))
    for analysis in (carbon, financial):
        if analysis["company_id"] != company_id or analysis["reporting_year"] != year:
            raise ValueError("Analysis company/reporting year does not match the pack")
    candidates = [
        row for row in state.get("ranked_scenarios", [])
        if (row["scenario"]["scenario_id"] == selected_scenario_id
            if selected_scenario_id is not None else row["rank"] == 1)
    ]
    if len(candidates) != 1:
        raise ValueError("Select exactly one existing ranked scenario")
    ranked = candidates[0]
    scenario = TypeAdapter(tools.TransitionScenario).validate_python(ranked["scenario"])
    if any(scenario[field] < 0 for field in (
        "capex", "annual_savings", "annual_emissions_reduction_tco2e"
    )):
        raise ValueError("Scenario monetary values and reductions cannot be negative")
    raw_financing = state.get("financing_simulations", {}).get(scenario["scenario_id"])
    financing = (
        TypeAdapter(tools.FinancingSimulation).validate_python(raw_financing)
        if raw_financing is not None else None
    )
    if scenario["capex"] > 0 and financing is None:
        raise ValueError("Positive-CapEx scenario requires an existing financing simulation")
    if financing is not None:
        if (financing["currency"] != financial["currency"]
                or financing["loan_amount"] != scenario["capex"]
                or financing["annual_savings"] != scenario["annual_savings"]):
            raise ValueError("Financing must match the graph's full-CapEx scenario inputs")
    if "post_financing_dscr" not in ranked:
        raise ValueError("Ranked scenario must supply post_financing_dscr (may be null)")
    is_mock = any(
        result["metadata"]["is_mock"]
        for result in (carbon, financial, financing) if result is not None
    )
    evidence_label = "MOCK_UNVERIFIED" if is_mock else "UNVERIFIED"
    assumptions = [
        *carbon["assumptions"], *financial["assumptions"], *scenario["assumptions"],
        *(financing["assumptions"] if financing else []),
        "Scenario impacts are independent projections, not a combined portfolio.",
        "Numeric values are copied from deterministic results without recalculation.",
    ]
    limitations = [
        "No verified company identity, utility invoices, financial statements, or equipment quotations are supplied by this graph contract.",
        "Carbon baseline is reported analysis, not independently verified evidence.",
        "CapEx, savings, emissions reduction, financing and post-financing DSCR are projections, not verified outcomes or lender terms.",
        "The deterministic screen does not establish lending eligibility or lender approval.",
        "Pack approval authorizes disclosure only; it does not verify data or initiate sharing/submission.",
    ]
    if is_mock:
        limitations.append("TEMPORARY MOCK DATA: this pack is for demonstration and review only.")
    if carbon["scope_3_tco2e"] is None:
        limitations.append("Scope 3 is unavailable; it must not be interpreted as zero.")
    if ranked["post_financing_dscr"] is None:
        limitations.append("Post-financing DSCR is unavailable or not applicable; no value was inferred.")
    limitations.extend(f"Workflow issue: {error}" for error in state.get("errors", []))
    values = {
        "company_id": company_id,
        "reporting_year": year,
        "currency": financial["currency"],
        "carbon_baseline": carbon,
        "carbon_baseline_information_status": evidence_label,
        "projected_pathway": {
            "selected_scenario": scenario,
            "capex": scenario["capex"],
            "annual_savings": scenario["annual_savings"],
            "annual_emissions_reduction_tco2e": scenario["annual_emissions_reduction_tco2e"],
            "financing_simulation": financing,
            "post_financing_dscr": ranked["post_financing_dscr"],
            "deterministic_screen_passed": ranked["eligible"],
            "deterministic_screen_reasons": ranked["reasons"],
        },
        "is_mock": is_mock,
        "assumptions": assumptions,
        "data_limitations": limitations,
        "evidence_status": {
            "status": evidence_label,
            "description": "No independently verified source evidence is available in the supplied deterministic results.",
        },
        "approval": {"status": ApprovalStatus.DRAFT},
    }
    _check_finite(values)
    return LenderPack.model_validate(deepcopy(values))


def set_approval_status(
    pack: LenderPack,
    status: ApprovalStatus,
    *,
    actor: str,
    reason: Optional[str] = None,
) -> LenderPack:
    """Record an explicit decision on a detached copy; never submit or share.

    Callers are responsible for authenticating the actor and retaining the
    resulting pack. Approval applies to this pack's content only; regenerating
    a pack always resets it to DRAFT.
    """
    approval = Approval(
        status=ApprovalStatus(status),
        actor=actor,
        decided_at=datetime.now(timezone.utc),
        reason=reason,
    )
    values = pack.model_dump(exclude={"shareable", "submittable"})
    values["approval"] = approval.model_dump()
    return LenderPack.model_validate(deepcopy(values))
