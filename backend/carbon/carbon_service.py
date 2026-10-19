"""One production Carbon engine, porting the existing five supported TS factors.

No raw uploads, profile defaults, LLM, tariffs or pre-calculated record emissions.
Normalized intake totals are multiplied exactly once. Decimal prevents rounding
individual source values before aggregation. Scope totals require complete inputs.
"""
from collections import Counter
from decimal import Decimal

from backend.agent.models import AnalysisRequest, CarbonResult, CarbonToolResult
from backend.data.intake.models import DataIntakeResult
from backend.data.mapping import EXPECTED_UNITS
from backend.data.models import ActivityData

# Values, source labels and vintages preserved from carbonFactors.ts. No generic
# category/region fallback. Grid policy is explicit until intake supports region.
FACTORS = {
    "electricity_kwh": ("Scope 2", "0.584", "Suruhanjaya Tenaga Grid Emission Factor 2023", "2023", "Peninsular Malaysia"),
    "diesel_litres": ("Scope 1", "2.6865", "UK DEFRA / IPCC 2024 Fuel Conversion Factors", "2024", "Global / Standard"),
    "petrol_litres": ("Scope 1", "2.3144", "UK DEFRA / IPCC 2024", "2024", "Global / Standard"),
    "natural_gas_m3": ("Scope 1", "2.0226", "DEFRA / Gas Malaysia Industrial Tariff 2024", "2024", "Global / Standard"),
    "lpg_kg": ("Scope 1", "2.939", "DEFRA 2024 Fuel Table", "2024", "Global / Standard"),
}


def _unavailable(reason):
    return CarbonToolResult(missing_context=[f"SERVICE_UNAVAILABLE:carbon: {reason}"])


def analyse_intake_carbon(intake: DataIntakeResult) -> CarbonToolResult:
    # Revalidate at the boundary, including direct service calls.
    intake = DataIntakeResult.model_validate(intake.model_dump())
    dataset = intake.normalized_data
    ready = intake.readiness["carbon_analysis"]
    if (intake.agent_next_action != "PROCEED" or dataset is None or not ready.may_proceed
            or not intake.company.company_id or intake.company.reporting_year is None):
        return _unavailable("Complete intake and resolve or explicitly accept Carbon evidence limitations.")
    year = intake.company.reporting_year
    fields = {*ActivityData.model_fields, "floor_area_m2", "company_id", "reporting_year"}
    provenance = {key: value for key, value in dataset.provenance.items() if key in fields}
    evidence = [item for item in intake.evidence if item.field in fields]
    # Never recompute totals by adding evidence to normalized totals. Check that
    # each sourced value is scoped, non-overlapping and in the normalized unit.
    for field in fields:
        sources = provenance.get(field, [])
        observed = [item for item in evidence if item.field == field]
        if any(item.reporting_period and int(item.reporting_period[:4]) != year for item in [*sources, *observed]):
            return _unavailable("Reporting-year mismatch in Carbon evidence.")
        if field not in ActivityData.model_fields and field != "floor_area_m2":
            continue
        value = getattr(dataset.activity, field) if field in ActivityData.model_fields else dataset.metadata.floor_area_m2
        if value is None:
            continue
        if not sources or not observed:
            return _unavailable(f"Missing provenance/evidence for {field}.")
        if any(item.normalized_unit != EXPECTED_UNITS[field] for item in [*sources, *observed]):
            return _unavailable(f"Unsupported normalized unit for {field}.")
        if field in ActivityData.model_fields:
            periods = [item.reporting_period for item in sources]
            evidence_periods = [item.reporting_period for item in observed]
            if len(sources) > 1 and (any(not p or len(p) != 7 for p in periods) or len(set(periods)) != len(periods)):
                return _unavailable(f"Overlapping activity periods for {field}.")
            if len(observed) != len(sources) or sorted(p or "" for p in periods) != sorted(p or "" for p in evidence_periods):
                return _unavailable(f"Ambiguous activity evidence for {field}.")
            if sum(Decimal(str(item.normalized_value)) for item in observed) != Decimal(str(value)):
                # Intake uses floating point aggregation, so allow representation
                # noise but never accept a second copy of the same activity.
                from math import isclose
                if not isclose(sum(float(item.normalized_value) for item in observed), value, rel_tol=1e-12, abs_tol=1e-9):
                    return _unavailable(f"Activity evidence does not reconcile for {field}.")

    activity = dataset.activity.model_dump()
    missing = [key for key, value in activity.items() if value is None]
    if len(missing) == len(activity):
        return _unavailable("No normalized activity is available.")
    sources, amounts = {}, {}
    for field, (scope, coefficient, source, version, region) in FACTORS.items():
        value = activity[field]
        emissions = None if value is None else Decimal(str(value)) * Decimal(coefficient) / Decimal(1000)
        amounts[field] = emissions
        sources[field] = dict(scope=scope, activity_value=value, activity_unit=EXPECTED_UNITS[field],
            factor=float(coefficient), factor_unit=f"kgCO2e/{EXPECTED_UNITS[field]}", factor_source=source,
            factor_version=version, factor_region=region, emissions=None if emissions is None else float(emissions))

    def scope_total(scope):
        values = [amounts[field] for field in FACTORS if sources[field]["scope"] == scope]
        return None if any(value is None for value in values) else sum(values, Decimal(0))

    scope1, scope2 = scope_total("Scope 1"), scope_total("Scope 2")
    total = None if scope1 is None or scope2 is None else scope1 + scope2
    known = sum((value for value in amounts.values() if value is not None), Decimal(0))
    for field in sources:
        sources[field]["share_pct"] = None if total is None or total == 0 or amounts[field] is None else float(amounts[field] / total * 100)
    area = dataset.metadata.floor_area_m2
    intensity = None if total is None or area is None or area == 0 else float(total * 1000 / Decimal(str(area)))
    warnings = [gap.message for gap in intake.data_gaps]
    warnings.extend([
        "Electricity uses the existing Peninsular Malaysia 2023 factor policy; grid region is not supplied by the intake schema.",
        "Factor references are preserved from the repository; source declarations and factor applicability are not independently verified.",
    ])
    if missing:
        warnings.append("Incomplete coverage: missing activity is unknown, not zero; known emissions cover supplied sources only.")
    if any(version != str(year) for _, _, _, version, _ in FACTORS.values()):
        warnings.append(f"Reporting year {year} differs from one or more factor vintages; no newer factor is inferred.")
    confidence_sources = [source for field in ActivityData.model_fields for source in provenance.get(field, [])]
    number = lambda value: None if value is None else float(value)
    return CarbonToolResult(data=CarbonResult(
        company_id=intake.company.company_id, reporting_year=year, source="backend.carbon.carbon_service:v1",
        scope1_emissions=number(scope1), scope2_emissions=number(scope2), total_emissions=number(total),
        total_tco2e=number(total), known_emissions=float(known), emissions_by_source=sources,
        carbon_intensity=dict(value=intensity, floor_area_m2=area,
            reason=None if intensity is not None else "Complete activity coverage and a positive uploaded floor area are needed."),
        impact_groups={field: {"annual_emissions_tco2e": source["emissions"], "annual_cost": None}
                       for field, source in sources.items()},
        provenance=provenance, evidence=evidence,
        confidence=dict(evidence_quality_counts=dict(Counter(item.evidence_quality for item in confidence_sources)),
            extraction_confidence=[item.confidence for item in confidence_sources],
            mapping_confidence=[item.mapping_confidence for item in confidence_sources]),
        missing_data=[*missing, *(["floor_area_m2"] if area is None else [])],
        warnings=list(dict.fromkeys(warnings)), readiness=ready,
        assumptions=["Existing Peninsular Malaysia grid policy; factors ported from frontend/src/utils/carbonFactors.ts.",
                     "Activity × kgCO2e per activity unit / 1000 = tCO2e; no intermediate source rounding."],
        evidence_limitations=list(dict.fromkeys(warnings)),
    ))


def get_carbon_analysis(request: AnalysisRequest) -> CarbonToolResult:
    return analyse_intake_carbon(request.intake)
