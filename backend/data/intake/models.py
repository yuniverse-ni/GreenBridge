"""Checkpoint-safe contracts for intake orchestration, not business calculations."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue, field_validator, model_validator

from ..models import FIELD_GROUPS, NormalizedDataset, SMEMetadata

Module = Literal["carbon_analysis", "financial_analysis", "transition_analysis"]
EvidenceQuality = Literal["DIRECT_MEASURED", "INVOICE_DERIVED", "ESTIMATED_PROXY", "UNKNOWN"]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Upload(Contract):
    file_id: str = Field(min_length=1)
    filename: str = Field(min_length=1)
    content: bytes
    # These are caller declarations, not conclusions inferred from a filename.
    evidence_quality: EvidenceQuality = "UNKNOWN"
    quality_basis: str | None = None

    @model_validator(mode="after")
    def declared_quality_needs_basis(self):
        if self.evidence_quality != "UNKNOWN" and not (self.quality_basis or "").strip():
            raise ValueError("Declared evidence quality requires a source/basis")
        return self


class Inspection(Contract):
    file_id: str
    filename: str
    source_type: Literal["csv", "xlsx", "unsupported"]
    sha256: str
    headers: list[str] = Field(default_factory=list)
    metric_labels: list[str] = Field(default_factory=list)
    supported_fields: list[str] = Field(default_factory=list)
    error: str | None = None


class DocumentClassification(Contract):
    document_type: Literal["financial_records", "electricity_evidence", "fuel_records",
                           "operational_records", "supplier_evidence", "mixed", "unknown"]
    confidence: Literal["HIGH", "LOW", "UNKNOWN"]
    reasoning: str
    extraction_strategy: Literal["deterministic_csv", "deterministic_xlsx", "unsupported"]


class MappingRequest(Contract):
    request_id: str
    file_id: str
    original_column: str
    row: int | None = None
    sheet: str | None = None
    detected_unit: str | None = None
    deterministic_field: str | None = None
    mapping_confidence: float | None = Field(default=None, ge=0, le=1)
    reason: str


class SemanticSuggestion(Contract):
    request_id: str
    original_column: str
    suggested_field: str | None = None
    detected_unit: str | None = None
    normalized_unit: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    mapping_method: Literal["ai_semantic_suggestion", "unresolved"] = "ai_semantic_suggestion"
    reasoning: str
    requires_confirmation: Literal[True] = True

    @field_validator("suggested_field")
    @classmethod
    def existing_field(cls, value):
        if value is not None and value not in FIELD_GROUPS:
            raise ValueError("AI may suggest only existing normalized fields")
        return value


class SuggestionBatch(Contract):
    suggestions: list[SemanticSuggestion]


class MappingDecision(Contract):
    request_id: str
    action: Literal["confirm", "ignore"]
    mapped_field: str | None = None
    unit: str | None = None

    @model_validator(mode="after")
    def valid_decision(self):
        if self.action == "confirm" and self.mapped_field not in FIELD_GROUPS:
            raise ValueError("Confirm an existing field or explicitly ignore the source field")
        if self.action == "ignore" and (self.mapped_field is not None or self.unit is not None):
            raise ValueError("Ignored fields cannot specify a mapping or unit")
        return self


class ConfirmationResponse(Contract):
    actor: str = Field(min_length=1, pattern=r"\S")
    decisions: list[MappingDecision] = Field(min_length=1)


class EvidenceResponse(Contract):
    actor: str = Field(min_length=1, pattern=r"\S")
    action: Literal["upload", "continue_incomplete", "cancel"]
    uploads: list[Upload] = Field(default_factory=list)
    remove_file_ids: list[str] = Field(default_factory=list)
    reason: str = Field(min_length=1, pattern=r"\S")

    @model_validator(mode="after")
    def consistent_action(self):
        if self.action != "upload" and (self.uploads or self.remove_file_ids):
            raise ValueError("Only an upload action may change evidence files")
        if self.action == "upload" and not (self.uploads or self.remove_file_ids):
            raise ValueError("Supply new evidence or remove a problematic file")
        return self


class EvidenceGap(Contract):
    gap_type: str
    affected_field: str | None = None
    severity: Literal["INFO", "WARNING", "ERROR"]
    message: str
    recommended_action: str
    missing_periods: list[str] = Field(default_factory=list)


class EvidenceAssessment(Contract):
    file_id: str
    field: str
    source_file: str
    row: int | None
    column: str
    sheet: str | None = None
    mapping_status: Literal["DETERMINISTIC_ACCEPTED", "DETERMINISTIC_UNCONFIRMED", "AI_MAPPED_CONFIRMED", "AI_MAPPED_UNCONFIRMED", "HUMAN_CONFIRMED"]
    mapping_confidence: float | None = None
    semantic_confidence: float | None = None
    evidence_quality: EvidenceQuality = "UNKNOWN"
    quality_basis: str | None = None
    externally_verified: Literal[False] = False
    confirmation_status: Literal["ACCEPTED", "CONFIRMED", "REQUIRES_CONFIRMATION"]


class Readiness(Contract):
    status: Literal["READY", "PARTIAL", "BLOCKED"]
    reasons: list[str]


class IntakeInput(Contract):
    uploads: list[Upload]
    requested_modules: list[Module] = Field(min_length=1, default_factory=lambda: ["carbon_analysis", "financial_analysis", "transition_analysis"])


class IntakeError(Contract):
    stage: str
    file_id: str | None = None
    message: str


class PartialAcceptance(Contract):
    actor: str = Field(min_length=1, pattern=r"\S")
    reason: str = Field(min_length=1, pattern=r"\S")
    decided_at: datetime
    modules: list[Module] = Field(min_length=1)
    acknowledged_gaps: list[EvidenceGap]


class ModuleReadiness(Readiness):
    partial_accepted: bool = False
    may_proceed: bool = False

    @model_validator(mode="after")
    def acceptance_is_only_partial(self):
        if self.partial_accepted and self.status != "PARTIAL":
            raise ValueError("Only PARTIAL readiness can carry partial acceptance")
        if self.may_proceed and not (self.status == "READY" or self.status == "PARTIAL" and self.partial_accepted):
            raise ValueError("BLOCKED or unaccepted PARTIAL readiness cannot proceed")
        return self


class ValueEvidence(Contract):
    field: str
    source_file: str
    source_document_id: str | None = None
    original_column: str
    original_metric: str | None = None
    row: int
    sheet: str | None = None
    reporting_period: str | None = None
    original_value: JsonValue
    original_unit: str | None = None
    normalized_value: str | int | float
    normalized_unit: str | None = None
    extraction_method: str
    mapping_method: str | None = None
    mapping_confidence: float | None = Field(default=None, ge=0, le=1)
    semantic_confidence: float | None = Field(default=None, ge=0, le=1)
    evidence_quality: EvidenceQuality
    evidence_quality_basis: str | None = None
    confirmation_status: Literal["ACCEPTED", "CONFIRMED"]
    confirmed_by: str | None = None
    confirmed_at: datetime | None = None
    externally_verified: Literal[False] = False


class DataIntakeResult(Contract):
    """Public result; raw files/checkpoints are deliberately excluded.

    Use model_dump(mode='json')/model_dump_json() or as a FastAPI response model.
    A BLOCKED module never gains downstream permission from a partial override.
    """

    company: SMEMetadata
    normalized_data: NormalizedDataset | None
    evidence: list[ValueEvidence]
    data_gaps: list[EvidenceGap]
    readiness: dict[Module, ModuleReadiness]
    agent_next_action: Literal["PROCEED", "REQUEST_EVIDENCE", "REQUEST_CONFIRMATION", "BLOCK"]
    requested_modules: list[Module] = Field(min_length=1)
    partial_acceptances: list[PartialAcceptance] = Field(default_factory=list)
    mapping_requests: list[MappingRequest] = Field(default_factory=list)
    suggestions: list[SemanticSuggestion] = Field(default_factory=list)
    errors: list[IntakeError] = Field(default_factory=list)
    notices: list[str] = Field(default_factory=list)
    intake_status: str

    @model_validator(mode="after")
    def enforce_downstream_contract(self):
        if set(self.readiness) != {"carbon_analysis", "financial_analysis", "transition_analysis"}:
            raise ValueError("Readiness is required for all three downstream modules")
        if self.normalized_data is not None and self.company != self.normalized_data.metadata:
            raise ValueError("Company must match normalized dataset metadata")
        accepted = {module for item in self.partial_acceptances for module in item.modules}
        if any(value.partial_accepted and module not in accepted for module, value in self.readiness.items()):
            raise ValueError("Partial permission requires an explicit human acceptance record")
        for value in self.readiness.values():
            permitted = self.normalized_data is not None and (value.status == "READY" or value.status == "PARTIAL" and value.partial_accepted)
            if value.may_proceed != permitted:
                raise ValueError("Module permission must match published data and readiness")
        if self.agent_next_action == "PROCEED":
            if (self.normalized_data is None or self.errors or self.mapping_requests
                    or any(not self.readiness[module].may_proceed for module in self.requested_modules)):
                raise ValueError("PROCEED requires validated data and permission for every requested module")
        return self

