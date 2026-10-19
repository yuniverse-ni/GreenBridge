"""Deterministic Carbon Engine over the published DataIntakeResult."""

from collections import Counter

from backend.agent.models import (
    CarbonDataConfidence,
    CarbonEvidence,
    CarbonFactorProvenance,
    CarbonIntensity,
    CarbonResult,
    CarbonSourceResult,
    ImpactGroup,
)
from backend.data.intake.models import DataIntakeResult

from .carbon_models import ACTIVITY_FIELDS, EMISSION_FACTORS, EmissionFactor

QUALITY_LEVELS = ("DIRECT_MEASURED", "INVOICE_DERIVED", "ESTIMATED_PROXY", "UNKNOWN")


def _evidence_for(intake: DataIntakeResult, field: str) -> list[CarbonEvidence]:
    return [
        CarbonEvidence(
            source_file=item.source_file,
            row=item.row,
            sheet=item.sheet,
            reporting_period=item.reporting_period,
            original_column=item.original_column,
            original_metric=item.original_metric,
            original_value=item.original_value,
            original_unit=item.original_unit,
            normalized_unit=item.normalized_unit,
            evidence_quality=item.evidence_quality,
            evidence_quality_basis=item.evidence_quality_basis,
            mapping_confidence=item.mapping_confidence,
            semantic_confidence=item.semantic_confidence,
            confirmation_status=item.confirmation_status,
        )
        for item in intake.evidence
        if item.field == field
    ]


def _period_error(evidence: list[CarbonEvidence], reporting_year: int, field: str) -> str | None:
    periods = [item.reporting_period for item in evidence if item.reporting_period]
    if any(int(period[:4]) != reporting_year for period in periods):
        return f"{field}: evidence period does not match reporting year {reporting_year}"
    if len(periods) != len(set(periods)):
        return f"{field}: duplicate evidence periods could double-count activity"
    return None


def _valid_units(evidence: list[CarbonEvidence], factor: EmissionFactor) -> bool:
    return all(item.normalized_unit == factor.activity_unit for item in evidence)


def calculate_carbon_result(intake: DataIntakeResult) -> CarbonResult:
    """Calculate source emissions only from normalized, year-scoped intake facts."""
    intake = DataIntakeResult.model_validate(intake.model_dump())
    dataset = intake.normalized_data
    company_id = intake.company.company_id
    reporting_year = intake.company.reporting_year
    if dataset is None:
        raise ValueError("A published normalized DataIntakeResult is required")
    if not company_id or reporting_year is None:
        raise ValueError("Carbon analysis requires company_id and reporting_year")

    warnings: list[str] = list(dataset.warnings and [item.message for item in dataset.warnings] or [])
    missing_data: list[str] = []
    if dataset.metadata.floor_area_m2 is None or dataset.metadata.floor_area_m2 <= 0:
        missing_data.append("carbon_intensity: floor_area_m2 is missing or is not a positive denominator")
    if any(factor.field == "electricity_kwh" for factor in EMISSION_FACTORS):
        warnings.append(
            "DataIntakeResult does not include a grid region; the documented Peninsular Malaysia 2023 factor is used."
        )

    source_results: list[CarbonSourceResult] = []
    factor_provenance: list[CarbonFactorProvenance] = []
    known_kg_by_scope: dict[str, list[float]] = {"Scope 1": [], "Scope 2": []}
    evidence_quality_counts: Counter[str] = Counter()
    evidenced_source_count = 0
    impact_groups: dict[str, ImpactGroup] = {}
    all_sources_complete = True

    for factor in EMISSION_FACTORS:
        activity_value = getattr(dataset.activity, factor.field)
        evidence = _evidence_for(intake, factor.field)
        factor_provenance.append(
            CarbonFactorProvenance(
                source=factor.source_name,
                scope=factor.scope,
                factor_kgco2e_per_unit=factor.factor_kgco2e_per_unit,
                factor_unit=factor.factor_unit,
                factor_source=factor.factor_source,
                factor_version=factor.factor_version,
                factor_region=factor.factor_region,
            )
        )

        period_issue = _period_error(evidence, reporting_year, factor.field)
        unit_valid = _valid_units(evidence, factor)
        can_calculate = activity_value is not None and period_issue is None and unit_valid
        emissions_kg = activity_value * factor.factor_kgco2e_per_unit if can_calculate else None

        if activity_value is None:
            missing_data.append(f"{factor.field}: activity value was not supplied")
            all_sources_complete = False
        if period_issue:
            missing_data.append(period_issue)
            warnings.append(f"{period_issue}; emissions for this source were withheld.")
            all_sources_complete = False
        if not unit_valid:
            message = f"{factor.field}: normalized evidence unit must be {factor.activity_unit}"
            missing_data.append(message)
            warnings.append(f"{message}; emissions for this source were withheld.")
            all_sources_complete = False
        if activity_value is not None and not evidence:
            warnings.append(f"{factor.field}: no field-level evidence was published; evidence quality is unknown.")
        if activity_value is not None and can_calculate:
            known_kg_by_scope[factor.scope].append(emissions_kg)
            impact_groups[factor.field] = ImpactGroup(annual_emissions_tco2e=emissions_kg / 1000)

        for item in evidence:
            evidence_quality_counts[item.evidence_quality] += 1
        if evidence:
            evidenced_source_count += 1

        source_results.append(
            CarbonSourceResult(
                source=factor.source_name,
                scope=factor.scope,
                reporting_year=reporting_year,
                activity_value=activity_value,
                activity_unit=factor.activity_unit,
                factor_kgco2e_per_unit=factor.factor_kgco2e_per_unit,
                factor_unit=factor.factor_unit,
                factor_source=factor.factor_source,
                factor_version=factor.factor_version,
                factor_region=factor.factor_region,
                emissions_kgco2e=emissions_kg,
                emissions_tco2e=None if emissions_kg is None else emissions_kg / 1000,
                evidence=evidence,
            )
        )

    for quality in QUALITY_LEVELS:
        evidence_quality_counts.setdefault(quality, 0)

    scope1_kg = sum(known_kg_by_scope["Scope 1"]) if known_kg_by_scope["Scope 1"] else None
    scope2_kg = sum(known_kg_by_scope["Scope 2"]) if known_kg_by_scope["Scope 2"] else None
    known_kg = [value for value in (scope1_kg, scope2_kg) if value is not None]
    total_kg = sum(known_kg) if known_kg else None

    if total_kg is not None and total_kg > 0 and all_sources_complete:
        source_results = [
            item.model_copy(update={
                "share_pct": item.emissions_kgco2e / total_kg * 100
                if item.emissions_kgco2e is not None else None
            })
            for item in source_results
        ]
    elif total_kg is not None and total_kg > 0:
        warnings.append("Source percentage shares are withheld because activity data is incomplete.")
    elif total_kg == 0:
        warnings.append("Emissions are zero; source percentage shares are undefined.")

    area = dataset.metadata.floor_area_m2
    intensity = (
        CarbonIntensity(value=total_kg / area, floor_area_m2=area)
        if all_sources_complete and total_kg is not None and area is not None and area > 0
        else None
    )
    if area is not None and area > 0 and not all_sources_complete:
        warnings.append("Carbon intensity is withheld because one or more activity sources are missing or invalid.")

    return CarbonResult(
        company_id=company_id,
        reporting_year=reporting_year,
        source="backend.carbon.carbon_service:documented-factors/v1",
        total_tco2e=None if total_kg is None else total_kg / 1000,
        scope1_emissions_tco2e=None if scope1_kg is None else scope1_kg / 1000,
        scope2_emissions_tco2e=None if scope2_kg is None else scope2_kg / 1000,
        activity_data_complete=all_sources_complete,
        emissions_by_source=source_results,
        carbon_intensity=intensity,
        data_confidence=CarbonDataConfidence(
            activity_source_count=len(ACTIVITY_FIELDS),
            evidenced_source_count=evidenced_source_count,
            evidence_record_count=sum(evidence_quality_counts.values()),
            evidence_quality_counts=dict(evidence_quality_counts),
        ),
        missing_data=missing_data,
        warnings=list(dict.fromkeys(warnings)),
        factor_provenance=factor_provenance,
        impact_groups=impact_groups,
        assumptions=[
            "Emissions are calculated as normalized activity × documented kgCO2e-per-unit factor.",
            "Scope 1 is limited to direct fuel use; purchased electricity is Scope 2.",
            "Unknown activity remains unknown; it is never substituted with zero.",
            "Known scope totals are partial subtotals when missing_data is non-empty.",
        ],
        evidence_limitations=[
            "Evidence confidence reflects intake declarations and mapping metadata, not independent verification.",
        ],
    )