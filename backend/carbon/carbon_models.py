"""Documented, explicit factors supported by the normalized Phase 1 schema."""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class EmissionFactor:
    field: str
    source_name: str
    scope: Literal["Scope 1", "Scope 2"]
    activity_unit: str
    factor_kgco2e_per_unit: float
    factor_unit: str
    factor_source: str
    factor_version: str
    factor_region: str | None = None


# Values and source labels are retained from the existing documented Carbon
# factor repository. The intake schema does not carry a grid-region field.
EMISSION_FACTORS: tuple[EmissionFactor, ...] = (
    EmissionFactor(
        field="electricity_kwh",
        source_name="Purchased grid electricity",
        scope="Scope 2",
        activity_unit="kWh",
        factor_kgco2e_per_unit=0.584,
        factor_unit="kgCO2e/kWh",
        factor_source="Suruhanjaya Tenaga Grid Emission Factor",
        factor_version="2023",
        factor_region="Peninsular Malaysia",
    ),
    EmissionFactor(
        field="diesel_litres",
        source_name="Diesel",
        scope="Scope 1",
        activity_unit="litres",
        factor_kgco2e_per_unit=2.6865,
        factor_unit="kgCO2e/litre",
        factor_source="UK DEFRA / IPCC Fuel Conversion Factors",
        factor_version="2024",
        factor_region="Global / Standard",
    ),
    EmissionFactor(
        field="petrol_litres",
        source_name="Petrol",
        scope="Scope 1",
        activity_unit="litres",
        factor_kgco2e_per_unit=2.3144,
        factor_unit="kgCO2e/litre",
        factor_source="UK DEFRA / IPCC Fuel Conversion Factors",
        factor_version="2024",
        factor_region="Global / Standard",
    ),
    EmissionFactor(
        field="natural_gas_m3",
        source_name="Natural gas",
        scope="Scope 1",
        activity_unit="m3",
        factor_kgco2e_per_unit=2.0226,
        factor_unit="kgCO2e/m3",
        factor_source="DEFRA / Gas Malaysia Industrial Tariff",
        factor_version="2024",
        factor_region="Global / Standard",
    ),
    EmissionFactor(
        field="lpg_kg",
        source_name="LPG",
        scope="Scope 1",
        activity_unit="kg",
        factor_kgco2e_per_unit=2.939,
        factor_unit="kgCO2e/kg",
        factor_source="DEFRA Fuel Conversion Factors",
        factor_version="2024",
        factor_region="Global / Standard",
    ),
)

ACTIVITY_FIELDS = tuple(factor.field for factor in EMISSION_FACTORS)