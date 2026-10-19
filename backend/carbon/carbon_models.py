"""Structured Carbon facts; factor references are ported from carbonFactors.ts."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class CarbonModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class CarbonSource(CarbonModel):
    scope: Literal["Scope 1", "Scope 2"]
    activity_value: float | None = Field(default=None, ge=0)
    activity_unit: str
    factor: float = Field(ge=0)
    factor_unit: str
    factor_source: str
    factor_version: str
    factor_region: str
    emissions: float | None = Field(default=None, ge=0)
    emissions_unit: Literal["tCO2e"] = "tCO2e"
    share_pct: float | None = None


class CarbonIntensity(CarbonModel):
    value: float | None = None
    unit: Literal["kgCO2e/m2"] = "kgCO2e/m2"
    floor_area_m2: float | None = None
    reason: str | None = None


class CarbonConfidence(CarbonModel):
    externally_verified: Literal[False] = False
    evidence_quality_counts: dict[str, int] = Field(default_factory=dict)
    extraction_confidence: list[float | None] = Field(default_factory=list)
    mapping_confidence: list[float | None] = Field(default_factory=list)
    description: str = "Source quality is declared; extraction/mapping confidence is not independent verification."
