"""Contracts for deterministic imports. Missing values are distinct from zero."""

from datetime import date, datetime
import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ImportModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    @field_validator("*", mode="before")
    @classmethod
    def reject_boolean_numbers(cls, value: Any) -> Any:
        if isinstance(value, bool):
            raise ValueError("Boolean values are not valid imported values")
        return value


class SMEMetadata(ImportModel):
    company_id: str | None = None
    company_name: str | None = None
    reporting_year: int | None = Field(default=None, ge=1900, le=9999)
    employees: int | None = Field(default=None, ge=0)
    floor_area_m2: float | None = Field(default=None, ge=0)

    @field_validator("company_id", "company_name", mode="before")
    @classmethod
    def clean_text(cls, value: Any) -> Any:
        return value.strip() or None if isinstance(value, str) else value


class FinancialData(ImportModel):
    revenue: float | None = Field(default=None, ge=0)
    operating_expenses: float | None = Field(default=None, ge=0)
    cash_balance: float | None = Field(default=None, ge=0)
    annual_debt_service: float | None = Field(default=None, ge=0)
    capex_budget: float | None = Field(default=None, ge=0)
    minimum_cash_reserve: float | None = Field(default=None, ge=0)


class ActivityData(ImportModel):
    electricity_kwh: float | None = Field(default=None, ge=0)
    diesel_litres: float | None = Field(default=None, ge=0)
    petrol_litres: float | None = Field(default=None, ge=0)
    natural_gas_m3: float | None = Field(default=None, ge=0)
    lpg_kg: float | None = Field(default=None, ge=0)


FIELD_GROUPS = {
    **dict.fromkeys(SMEMetadata.model_fields, "metadata"),
    **dict.fromkeys(FinancialData.model_fields, "financial"),
    **dict.fromkeys(ActivityData.model_fields, "activity"),
}
GROUP_MODELS = {"metadata": SMEMetadata, "financial": FinancialData, "activity": ActivityData}


class Provenance(ImportModel):
    source_file: str
    source_document_id: str | None = None
    source_type: Literal["csv", "xlsx"]
    reporting_period: str | None = None
    extraction_method: Literal["deterministic_csv", "deterministic_xlsx"]
    # Confidence in structured extraction, never independent evidence verification.
    confidence: float | None = Field(default=None, ge=0, le=1)
    sheet: str | None = None
    row: int = Field(ge=2)
    column: str
    original_value: Any = None
    original_metric: str | None = None
    detected_unit: str | None = None
    normalized_unit: str | None = None
    mapping_method: str | None = None
    mapping_confidence: float | None = Field(default=None, ge=0, le=1)
    confirmation_status: Literal["ACCEPTED", "CONFIRMED"] = "ACCEPTED"
    confirmed_by: str | None = None
    confirmed_at: datetime | None = None
    evidence_quality: Literal["DIRECT_MEASURED", "INVOICE_DERIVED", "ESTIMATED_PROXY", "UNKNOWN"] = "UNKNOWN"
    evidence_quality_basis: str | None = None
    semantic_confidence: float | None = Field(default=None, ge=0, le=1)

    @field_validator("reporting_period")
    @classmethod
    def valid_period(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not re.fullmatch(r"\d{4}(?:-\d{2}(?:-\d{2})?)?", value):
            raise ValueError("reporting_period must be YYYY, YYYY-MM or YYYY-MM-DD")
        date.fromisoformat(value + ("-01-01" if len(value) == 4 else "-01" if len(value) == 7 else ""))
        return value


class ConfirmedMapping(BaseModel):
    """An externally authorized decision; never constructed from an AI response.

    Callers must authenticate the actor. These records authorize interpretation,
    not source verification. Units describe the input, not the output schema.
    """

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    original_column: str = Field(min_length=1)
    mapped_field: str
    unit: str | None = None
    row: int | None = Field(default=None, ge=2)
    sheet: str | None = None
    actor: str = Field(min_length=1, pattern=r"\S")
    decided_at: datetime
    ai_suggested: bool = False
    semantic_confidence: float | None = Field(default=None, ge=0, le=1)

    @field_validator("mapped_field")
    @classmethod
    def supported_field(cls, value: str) -> str:
        if value not in FIELD_GROUPS:
            raise ValueError("Confirmed mapping must name an existing normalized field")
        return value


class ParsedValue(ImportModel):
    field: str
    value: str | int | float
    provenance: Provenance

    @field_validator("field")
    @classmethod
    def known_field(cls, value: str) -> str:
        if value not in FIELD_GROUPS:
            raise ValueError(f"Unknown normalized field: {value}")
        return value


class FieldMapping(ImportModel):
    original_column: str
    mapped_field: str | None = None
    detected_unit: str | None = None
    normalized_unit: str | None = None
    mapping_confidence: float | None = Field(default=0, ge=0, le=1)
    mapping_method: Literal["exact", "alias", "fuzzy", "unmapped", "ambiguous", "human_confirmed", "ai_mapped_confirmed"]
    row: int | None = None


class MappingWarning(ImportModel):
    code: str
    message: str
    source_file: str
    original_column: str
    row: int | None = None
    sheet: str | None = None


class MappingLocation(ImportModel):
    mapping_index: int = Field(ge=0)
    sheet: str | None = None


class ParsedDocument(ImportModel):
    source_file: str
    values: list[ParsedValue] = Field(default_factory=list)
    mappings: list[FieldMapping] = Field(default_factory=list)
    unmapped_fields: list[str] = Field(default_factory=list)
    warnings: list[MappingWarning] = Field(default_factory=list)
    mapping_locations: list[MappingLocation] = Field(default_factory=list)


class NormalizedDataset(ImportModel):
    metadata: SMEMetadata = Field(default_factory=SMEMetadata)
    financial: FinancialData = Field(default_factory=FinancialData)
    activity: ActivityData = Field(default_factory=ActivityData)
    provenance: dict[str, list[Provenance]] = Field(default_factory=dict)
    mappings: list[FieldMapping] = Field(default_factory=list)
    unmapped_fields: list[str] = Field(default_factory=list)
    warnings: list[MappingWarning] = Field(default_factory=list)

