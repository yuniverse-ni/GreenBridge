"""Snapshot-based disclosure boundary; no calculations, LLM, or network actions.

Bootstrap code supplies trusted identity and accepted-run providers. Never build
those providers from HTTP role/name fields or an unverified client graph state.
The in-memory repository is an MVP implementation, not durable authentication,
encryption, document delivery, or a production audit database.
"""

from datetime import datetime, timezone
from enum import Enum
from hashlib import sha256
import hmac
import json
from math import isclose
import secrets
from threading import RLock
from typing import Any, Literal, Mapping, Protocol
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, JsonValue, computed_field

from backend.data.intake.models import DataIntakeResult, ModuleReadiness, ValueEvidence
from .models import CarbonAnalysis, FinancialAnalysis, FinancingSimulation, RankedPathway, TransitionOptions


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, allow_inf_nan=False)


class PackStatus(str, Enum):
    DRAFT = "DRAFT"
    PENDING_DISCLOSURE_APPROVAL = "PENDING_DISCLOSURE_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Role(str, Enum):
    SME_OWNER = "SME_OWNER"
    FINANCE_MANAGER = "FINANCE_MANAGER"
    LENDER = "LENDER"


class DisclosureSection(str, Enum):
    TRANSITION_PROJECT = "transition_project"
    FINANCIAL_SUMMARY = "financial_summary"
    FINANCING_REQUEST = "financing_request"
    CARBON_IMPACT = "carbon_impact"
    EVIDENCE_PROVENANCE = "evidence_provenance"
    ASSUMPTIONS_LIMITATIONS = "assumptions_limitations"


class DisclosureAction(str, Enum):
    APPROVE_DISCLOSURE = "APPROVE_DISCLOSURE"
    REJECT_DISCLOSURE = "REJECT_DISCLOSURE"


class Principal(Model):
    subject_id: str = Field(min_length=1, pattern=r"\S")
    role: Role
    company_ids: frozenset[str] = frozenset()
    # Exact version grants are provisioned by trusted backend code, not users.
    lender_grants: frozenset[tuple[str, int]] = frozenset()


class AuthorizationProvider(Protocol):
    def authenticate(self, credential: str) -> Principal: ...


class AcceptedRunProvider(Protocol):
    def load_accepted_run(self, run_id: str) -> Mapping[str, Any]: ...


class StaticAuthorizationProvider:
    """Demo/test bootstrap adapter. Opaque credentials must stay server-owned.

    Replace with session/JWT verification later; do not expose this constructor
    as a request API or treat a role name as a credential.
    """

    def __init__(self, identities: Mapping[str, Principal]):
        self._identities = {key: Principal.model_validate(value.model_dump()) for key, value in identities.items()}

    def authenticate(self, credential: str) -> Principal:
        if not isinstance(credential, str) or credential not in self._identities:
            raise PermissionError("Authentication required")
        return self._identities[credential]


class InMemoryAcceptedRuns:
    """Trusted backend fixture/bridge to server-side MainAgent checkpoints."""

    def __init__(self, runs: Mapping[str, Mapping[str, Any]]):
        self._runs = {key: json.dumps(value, allow_nan=False) for key, value in runs.items()}

    def load_accepted_run(self, run_id: str) -> Mapping[str, Any]:
        if run_id not in self._runs:
            raise ValueError("Unknown accepted run")
        return json.loads(self._runs[run_id])


class CalculationVersions(Model):
    """Declared by trusted deployment configuration; None means not supplied."""
    pack_schema: Literal["greenbridge-lender-pack-v1"] = "greenbridge-lender-pack-v1"
    tools: dict[str, str | None] = Field(default_factory=dict)


class CompanyPeriod(Model):
    company_id: str
    company_name: str | None
    reporting_year: int
    information_status: Literal["REPORTED_UNVERIFIED"] = "REPORTED_UNVERIFIED"


class TransitionProject(Model):
    information_status: Literal["PROJECTED"] = "PROJECTED"
    pathway_id: str
    name: str
    action_ids: list[str]
    action_descriptions: list[str]
    capex: float = Field(ge=0)
    annual_savings: float | None = Field(ge=0)
    simple_payback_years: float | None = Field(ge=0)


class FinancialSummary(Model):
    information_status: Literal["REPORTED_UNVERIFIED"] = "REPORTED_UNVERIFIED"
    currency: Literal["MYR"] = "MYR"
    revenue: float | None
    operating_expenses: float | None
    cash_balance: float | None
    capex_budget: float | None
    minimum_cash_reserve: float | None
    annual_cash_available_for_debt_service: float | None
    existing_annual_debt_service: float | None


class FinancingDetails(Model):
    information_status: Literal["PROJECTED"] = "PROJECTED"
    currency: Literal["MYR"] = "MYR"
    capex: float
    sme_contribution: float | None
    grant: float | None
    financing_requested: float | None
    annual_interest_rate_pct: float | None
    tenure_years: int | None
    monthly_repayment: float | None
    annual_repayment: float | None
    total_repayment: float | None
    total_interest: float | None
    post_financing_dscr: float | None


class CarbonImpact(Model):
    baseline_information_status: Literal["REPORTED_UNVERIFIED"] = "REPORTED_UNVERIFIED"
    impact_information_status: Literal["PROJECTED"] = "PROJECTED"
    baseline_tco2e: float | None
    projected_annual_reduction_tco2e: float | None
    projected_reduction_pct: float | None


class TransitionKPIs(Model):
    information_status: Literal["PROJECTED"] = "PROJECTED"
    annual_savings: float | None
    annual_emissions_reduction_tco2e: float | None
    carbon_reduction_pct: float | None
    payback_years: float | None
    remaining_cash: float | None
    net_annual_cash_flow: float | None
    post_financing_dscr: float | None


class EvidenceSection(Model):
    information_status: Literal["UNVERIFIED"] = "UNVERIFIED"
    externally_verified: Literal[False] = False
    readiness: dict[str, ModuleReadiness]
    partial_evidence_accepted: bool
    provenance: list[ValueEvidence]
    data_gaps: list[str]
    # Service origin is explicit, without disclosing arbitrary service metadata.
    uses_test_doubles: bool


class Limitations(Model):
    assumptions: list[str]
    warnings: list[str]
    limitations: list[str]
    calculation_versions: CalculationVersions


class PackContent(Model):
    company: CompanyPeriod
    transition_project: TransitionProject
    financial_summary: FinancialSummary
    financing_request: FinancingDetails
    carbon_impact: CarbonImpact
    transition_kpis: TransitionKPIs
    evidence_provenance: EvidenceSection
    assumptions_limitations: Limitations


class PackReference(Model):
    pack_id: str = Field(min_length=1)
    version: int = Field(ge=1, strict=True)
    content_hash: str = Field(pattern=r"^[0-9a-f]{64}$")


class DisclosureDecision(Model):
    reference: PackReference
    action: DisclosureAction
    sections: frozenset[DisclosureSection] = Field(min_length=1)
    reason: str = Field(min_length=1, pattern=r"\S")


class ApprovalRecord(Model):
    reference: PackReference
    action: DisclosureAction
    sections: frozenset[DisclosureSection]
    subject_id: str
    decided_at: datetime
    reason: str
    meaning: Literal["Decision concerns SME permission to share this specific snapshot only; not lender approval or verification."] = (
        "Decision concerns SME permission to share this specific snapshot only; not lender approval or verification.")


class AuditRecord(Model):
    event: str
    at: datetime
    subject_id: str
    reference: PackReference
    sections: frozenset[DisclosureSection] = frozenset()


class LenderPack(Model):
    pack_id: str
    version: int
    created_at: datetime
    content_hash: str
    content: PackContent
    status: PackStatus = PackStatus.DRAFT
    requested_sections: frozenset[DisclosureSection] = frozenset()
    decision: ApprovalRecord | None = None
    audit: list[AuditRecord]

    @property
    def reference(self) -> PackReference:
        return PackReference(pack_id=self.pack_id, version=self.version, content_hash=self.content_hash)

    @computed_field
    @property
    def shareable(self) -> bool:
        if self.status != PackStatus.APPROVED or self.decision is None:
            return False
        try:
            _validate_integrity(self)
        except ValueError:
            return False
        return True

    @computed_field
    @property
    def submittable(self) -> bool:
        return self.shareable


def _canonical(value: Any) -> bytes:
    # Pydantic's frozenset serialization order is intentionally normalized too.
    if isinstance(value, BaseModel):
        value = value.model_dump(mode="json", exclude={"shareable", "submittable"})
    def ordered(item):
        if isinstance(item, dict):
            return {key: ordered(val) for key, val in item.items()}
        if isinstance(item, list):
            return [ordered(val) for val in item]
        return item
    return json.dumps(ordered(value), sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def _content_hash(pack_id: str, version: int, created_at: datetime, content: PackContent) -> str:
    return sha256(_canonical({"pack_id": pack_id, "version": version, "created_at": created_at.isoformat(),
                              "content": content.model_dump(mode="json")})).hexdigest()


def _validate_integrity(pack: LenderPack) -> None:
    expected = _content_hash(pack.pack_id, pack.version, pack.created_at, pack.content)
    if not hmac.compare_digest(expected, pack.content_hash):
        raise ValueError("Pack content hash mismatch")
    if pack.status in (PackStatus.APPROVED, PackStatus.REJECTED):
        expected_action = (DisclosureAction.APPROVE_DISCLOSURE if pack.status == PackStatus.APPROVED
                           else DisclosureAction.REJECT_DISCLOSURE)
        if (pack.decision is None or pack.decision.reference != pack.reference
                or pack.decision.action != expected_action
                or pack.decision.sections != pack.requested_sections or not pack.requested_sections):
            raise ValueError("Invalid snapshot disclosure decision")
    elif pack.decision is not None:
        raise ValueError("Undecided pack has a disclosure decision")


class InMemoryPackRepository:
    """Detached, sealed JSON snapshots. Terminal versions cannot be overwritten.

    A keyed seal also rejects a substituted payload with a recomputed public
    hash. The process-private key and all snapshots are lost on restart.
    """
    def __init__(self):
        self.lock = RLock()
        self._key = secrets.token_bytes(32)
        self._records: dict[tuple[str, int], tuple[bytes, bytes]] = {}

    def get(self, pack_id: str, version: int) -> LenderPack:
        with self.lock:
            payload, seal = self._records[(pack_id, version)]
            if not hmac.compare_digest(hmac.digest(self._key, payload, "sha256"), seal):
                raise ValueError("Snapshot integrity check failed")
            pack = LenderPack.model_validate_json(payload)
            _validate_integrity(pack)
            return pack

    def next_version(self, pack_id: str) -> int:
        return max((version for key, version in self._records if key == pack_id), default=0) + 1

    def save(self, pack: LenderPack) -> None:
        with self.lock:
            _validate_integrity(pack)
            key = (pack.pack_id, pack.version)
            if key in self._records:
                old = self.get(*key)
                allowed = {PackStatus.DRAFT: {PackStatus.PENDING_DISCLOSURE_APPROVAL},
                           PackStatus.PENDING_DISCLOSURE_APPROVAL: {PackStatus.APPROVED, PackStatus.REJECTED}}
                if pack.status not in allowed.get(old.status, set()) or old.content_hash != pack.content_hash:
                    raise ValueError("Snapshot/version is immutable; create a new draft version")
                if old.status == PackStatus.PENDING_DISCLOSURE_APPROVAL and pack.requested_sections != old.requested_sections:
                    raise ValueError("Pending disclosure scope is immutable; create a new draft version")
                if pack.audit[:-1] != old.audit:
                    raise ValueError("Audit history must be append-only")
            elif pack.status != PackStatus.DRAFT or pack.version != self.next_version(pack.pack_id):
                raise ValueError("New versions must start as DRAFT in sequence")
            payload = _canonical(pack)
            self._records[key] = (payload, hmac.digest(self._key, payload, "sha256"))


def _build_content(state: Mapping[str, Any], versions: CalculationVersions) -> PackContent:
    """Validate and copy server-held deterministic results, never LLM prose."""
    decision, recommendation = state.get("human_decision") or {}, state.get("recommendation") or {}
    selected = recommendation.get("selected_pathway_id")
    if (state.get("status") != "ACCEPTED" or decision.get("action") != "ACCEPT"
            or not selected or decision.get("selected_pathway_id") != selected):
        raise ValueError("An explicitly ACCEPTED MainAgent pathway is required")
    intake = DataIntakeResult.model_validate(state.get("intake_result"))
    if intake.normalized_data is None or not all(item.may_proceed for item in intake.readiness.values()):
        raise ValueError("Required readiness does not permit a transition pack")
    company_id, year = state.get("company_id"), state.get("reporting_year")
    if (company_id, year) != (intake.company.company_id, intake.company.reporting_year):
        raise ValueError("Company/reporting period mismatch")
    rows = [RankedPathway.model_validate(row) for row in state.get("ranked_pathways", [])]
    matches = [row for row in rows if row.pathway.pathway_id == selected]
    if len(matches) != 1:
        raise ValueError("Accepted pathway must match exactly one ranked pathway")
    ranked = matches[0]
    if (not ranked.feasible or ranked.constraints.status != "PASS" or not ranked.constraints.checks
            or any(check.critical and check.status != "PASS" for check in ranked.constraints.checks)):
        raise ValueError("Accepted pathway must pass deterministic feasibility checks")
    results = state.get("tool_results", {})
    carbon = CarbonAnalysis.model_validate(results.get("get_carbon_analysis", {}).get("data"))
    financial = FinancialAnalysis.model_validate(results.get("get_financial_analysis", {}).get("data"))
    options = TransitionOptions.model_validate(results.get("get_transition_options", {}).get("data"))
    if any((item.company_id, item.reporting_year) != (company_id, year) for item in (carbon, financial, options)):
        raise ValueError("Service results belong to another company/reporting period")
    path, financing = ranked.pathway, ranked.financing
    actions = {action.action_id: action for action in options.actions}
    if any(action_id not in actions for action_id in path.action_ids):
        raise ValueError("Unknown selected action")
    funding = (path.sme_contribution, path.grant, path.financing_principal)
    if all(value is not None for value in funding) and not isclose(sum(funding), path.capex, rel_tol=1e-12, abs_tol=1e-6):
        raise ValueError("Funding does not reconcile to CAPEX")
    if path.financing_principal is not None and path.financing_principal > 0 and financing is None:
        raise ValueError("Financing simulation required for requested borrowing")
    stored_financing = state.get("financing_results", {}).get(selected)
    if stored_financing is not None and FinancingSimulation.model_validate(stored_financing) != financing:
        raise ValueError("Conflicting deterministic financing results")
    partial = any(item.status == "PARTIAL" for item in intake.readiness.values())
    test_double = any(item.origin == "TEST_DOUBLE" for item in (carbon, financial, options))
    # Raw agent/provider diagnostics may contain private request details. Only
    # deterministic pathway/financing limitations belong in a shareable section.
    warnings = [*path.warnings, *(financing.warnings if financing else [])]
    if state.get("errors"):
        warnings.append("The agent recorded internal workflow issues; review internally before disclosure.")
    if partial:
        warnings.append("PARTIAL evidence: incomplete evidence was explicitly accepted; readiness remains PARTIAL.")
    if test_double:
        warnings.append("TEST DOUBLE / MOCK service results: demonstration only, not verified company analysis.")
    if financing is None or financing.post_financing_dscr is None:
        warnings.append("Company post-financing DSCR is unavailable/not applicable; no value was inferred.")
    if not versions.tools or any(value is None for value in versions.tools.values()):
        warnings.append("Some calculation/tool versions were not supplied by the deployment.")
    f = intake.normalized_data.financial
    return PackContent(
        company=CompanyPeriod(company_id=company_id, company_name=intake.company.company_name, reporting_year=year),
        transition_project=TransitionProject(pathway_id=path.pathway_id, name=path.name, action_ids=path.action_ids,
            action_descriptions=[actions[key].name for key in path.action_ids], capex=path.capex,
            annual_savings=path.annual_savings, simple_payback_years=path.simple_payback_years),
        financial_summary=FinancialSummary(revenue=f.revenue, operating_expenses=f.operating_expenses,
            cash_balance=financial.cash_balance, capex_budget=financial.capex_budget,
            minimum_cash_reserve=financial.minimum_cash_reserve,
            annual_cash_available_for_debt_service=financial.annual_cash_available_for_debt_service,
            existing_annual_debt_service=financial.existing_annual_debt_service),
        financing_request=FinancingDetails(capex=path.capex, sme_contribution=path.sme_contribution, grant=path.grant,
            financing_requested=path.financing_principal,
            annual_interest_rate_pct=financing.terms.annual_interest_rate_pct if financing else None,
            tenure_years=financing.terms.tenure_years if financing else None,
            monthly_repayment=financing.monthly_repayment if financing else None,
            annual_repayment=financing.annual_debt_service if financing else None,
            total_repayment=financing.total_repayment if financing else None,
            total_interest=financing.total_interest if financing else None,
            post_financing_dscr=financing.post_financing_dscr if financing else None),
        carbon_impact=CarbonImpact(baseline_tco2e=carbon.total_tco2e,
            projected_annual_reduction_tco2e=path.annual_emissions_reduction_tco2e,
            projected_reduction_pct=path.carbon_reduction_pct),
        transition_kpis=TransitionKPIs(annual_savings=path.annual_savings,
            annual_emissions_reduction_tco2e=path.annual_emissions_reduction_tco2e,
            carbon_reduction_pct=path.carbon_reduction_pct, payback_years=path.simple_payback_years,
            remaining_cash=path.remaining_cash, net_annual_cash_flow=financing.net_annual_cash_flow if financing else None,
            post_financing_dscr=financing.post_financing_dscr if financing else None),
        evidence_provenance=EvidenceSection(readiness=intake.readiness, partial_evidence_accepted=partial,
            provenance=intake.evidence, data_gaps=[gap.message for gap in intake.data_gaps], uses_test_doubles=test_double),
        assumptions_limitations=Limitations(
            assumptions=[*carbon.assumptions, *financial.assumptions, *options.assumptions, *path.assumptions,
                         *(financing.assumptions if financing else [])], warnings=list(dict.fromkeys(warnings)),
            limitations=[*carbon.evidence_limitations, *financial.evidence_limitations, *options.evidence_limitations,
                         *path.evidence_limitations,
                         "Projections are decision support, not lending approval, credit eligibility or guaranteed carbon reductions.",
                         "No independent company verification or accreditation is established by this pack.",
                         "Disclosure approval authorizes sharing only; no external submission occurs."],
            calculation_versions=versions))


class LenderView(Model):
    """Only approved sections appear; KPIs follow the matching section boundary."""
    pack_id: str
    version: int
    company: CompanyPeriod
    approved_at: datetime
    status: Literal["APPROVED_FOR_DISCLOSURE"] = "APPROVED_FOR_DISCLOSURE"
    notice: str = "SME-authorized disclosure only; not lender approval or independent verification. Impacts and financing are projections."
    evidence_status: Literal["UNVERIFIED", "PARTIAL_UNVERIFIED", "MOCK_UNVERIFIED"]
    sections: dict[DisclosureSection, JsonValue]


class LenderPackService:
    """Application service. Credentials are resolved only by a trusted provider.

    Accepted runs must come from server checkpoints. Repository and provider
    objects are backend capabilities and must never be exposed as request APIs.
    """
    def __init__(self, *, authorization: AuthorizationProvider, accepted_runs: AcceptedRunProvider,
                 repository: InMemoryPackRepository | None = None, versions: CalculationVersions | None = None):
        self.authorization = authorization
        self.accepted_runs = accepted_runs
        self.repository = repository if repository is not None else InMemoryPackRepository()
        self.versions = versions or CalculationVersions()

    @staticmethod
    def _company_access(principal: Principal, company_id: str, *, owner_only=False) -> None:
        roles = {Role.SME_OWNER} if owner_only else {Role.SME_OWNER, Role.FINANCE_MANAGER}
        if principal.role not in roles or company_id not in principal.company_ids:
            raise PermissionError("Not authorized for this company/action")

    def generate_draft(self, run_id: str, *, credential: str, pack_id: str | None = None) -> LenderPack:
        principal = self.authorization.authenticate(credential)
        state = self.accepted_runs.load_accepted_run(run_id)
        self._company_access(principal, state.get("company_id"))
        content = _build_content(state, self.versions)
        with self.repository.lock:
            if pack_id is not None:
                previous = self.repository.get(pack_id, self.repository.next_version(pack_id) - 1)
                if previous.content.company.company_id != content.company.company_id:
                    raise PermissionError("Cannot change a pack's company")
            else:
                pack_id = uuid4().hex
            version, created = self.repository.next_version(pack_id), _now()
            digest = _content_hash(pack_id, version, created, content)
            reference = PackReference(pack_id=pack_id, version=version, content_hash=digest)
            pack = LenderPack(pack_id=pack_id, version=version, created_at=created, content_hash=digest,
                              content=content, audit=[AuditRecord(event="DRAFT_GENERATED", at=created,
                                                               subject_id=principal.subject_id, reference=reference)])
            self.repository.save(pack)
            return self.repository.get(pack_id, version)

    def get_internal(self, reference: PackReference, *, credential: str) -> LenderPack:
        principal = self.authorization.authenticate(credential)
        pack = self.repository.get(reference.pack_id, reference.version)
        self._company_access(principal, pack.content.company.company_id)
        self._match(pack, reference)
        return pack

    @staticmethod
    def _match(pack: LenderPack, reference: PackReference) -> None:
        if pack.reference != reference:
            raise ValueError("Approval/request does not match the exact pack version/content hash")

    def request_disclosure_review(self, reference: PackReference, sections: frozenset[DisclosureSection],
                                  *, credential: str) -> LenderPack:
        sections = frozenset(DisclosureSection(item) for item in sections)
        if not sections:
            raise ValueError("Choose at least one disclosure section")
        principal = self.authorization.authenticate(credential)
        with self.repository.lock:
            pack = self.repository.get(reference.pack_id, reference.version)
            self._company_access(principal, pack.content.company.company_id)
            self._match(pack, reference)
            if pack.status != PackStatus.DRAFT:
                raise ValueError("Only DRAFT can request disclosure review")
            record = AuditRecord(event="DISCLOSURE_REVIEW_REQUESTED", at=_now(), subject_id=principal.subject_id,
                                 reference=reference, sections=sections)
            updated = pack.model_copy(update={"status": PackStatus.PENDING_DISCLOSURE_APPROVAL,
                                               "requested_sections": sections, "audit": [*pack.audit, record]})
            self.repository.save(updated)
            return self.repository.get(pack.pack_id, pack.version)

    def decide_disclosure(self, decision: DisclosureDecision, *, credential: str) -> LenderPack:
        principal = self.authorization.authenticate(credential)
        with self.repository.lock:
            pack = self.repository.get(decision.reference.pack_id, decision.reference.version)
            self._company_access(principal, pack.content.company.company_id, owner_only=True)
            self._match(pack, decision.reference)
            if pack.status != PackStatus.PENDING_DISCLOSURE_APPROVAL:
                raise ValueError("Disclosure decision requires pending review")
            if decision.sections != pack.requested_sections:
                raise ValueError("Owner must explicitly decide on the exact requested disclosure scope")
            now = _now()
            approval = ApprovalRecord(**decision.model_dump(), subject_id=principal.subject_id, decided_at=now)
            status = (PackStatus.APPROVED if decision.action == DisclosureAction.APPROVE_DISCLOSURE else PackStatus.REJECTED)
            record = AuditRecord(event=decision.action.value, at=now, subject_id=principal.subject_id,
                                 reference=pack.reference, sections=decision.sections)
            updated = pack.model_copy(update={"status": status, "decision": approval, "audit": [*pack.audit, record]})
            self.repository.save(updated)
            return self.repository.get(pack.pack_id, pack.version)

    def lender_view(self, pack_id: str, version: int, *, credential: str) -> LenderView:
        principal = self.authorization.authenticate(credential)
        if principal.role != Role.LENDER or (pack_id, version) not in principal.lender_grants:
            raise PermissionError("No lender grant for this exact snapshot")
        pack = self.repository.get(pack_id, version)
        if pack.status != PackStatus.APPROVED or pack.decision is None:
            raise PermissionError("Only explicitly approved disclosure snapshots may be accessed")
        sections = {section: getattr(pack.content, section.value).model_dump(mode="json")
                    for section in pack.decision.sections}
        # Do not dump all KPIs globally: remaining cash/DSCR would leak financials.
        evidence = pack.content.evidence_provenance
        label = ("MOCK_UNVERIFIED" if evidence.uses_test_doubles else
                 "PARTIAL_UNVERIFIED" if evidence.partial_evidence_accepted else "UNVERIFIED")
        if evidence.partial_evidence_accepted:
            notice = "PARTIAL evidence explicitly accepted; missing evidence remains incomplete. "
        else:
            notice = ""
        return LenderView(pack_id=pack.pack_id, version=pack.version, company=pack.content.company,
            approved_at=pack.decision.decided_at, evidence_status=label, sections=sections,
            notice=notice + "SME-authorized disclosure only; not lender approval, credit eligibility, verification or guaranteed reductions. All transition/financing outcomes are projected.")
