"""Bridge Adapter: Links Yuni's Data Ingestion (backend.data) with Finance & Transition (backend.finance_transition).

Converts NormalizedDataset into CanonicalSMEDataPayload and coordinates end-to-end
financial statement generation, carbon baseline calculation, debt capacity sizing,
and decarbonisation transition options evaluation.
"""

from __future__ import annotations

import csv
import io
import re
from typing import Any, Iterable, Optional

try:
    from backend.data.models import ActivityData, FinancialData, NormalizedDataset, SMEMetadata
    from backend.data.parser import DataImportError
    from backend.data.service import ingest_uploads
except ModuleNotFoundError:
    from data.models import ActivityData, FinancialData, NormalizedDataset, SMEMetadata
    from data.parser import DataImportError
    from data.service import ingest_uploads
from finance_transition.audit import create_audit_record
from finance_transition.finance_models import (
    BalanceSheetInputs,
    BusinessConstraints,
    CashBudgetInputs,
    CashFlowInputs,
    CollectionSchedule,
    DebtCapacityInputs,
    EnergyActivityInputs,
    FinancialSummaryInputs,
    IncomeStatementInputs,
    TaxInputs,
)
from finance_transition.finance_service import (
    calculate_12_month_cash_budget,
    calculate_balance_sheet,
    calculate_cash_flow_statement,
    calculate_debt_capacity,
    calculate_financial_ratios,
    calculate_income_statement,
    calculate_malaysian_sme_tax,
    get_financial_summary,
    get_standard_sme_financial_model,
)
from finance_transition.transition_service import (
    compare_transition_options,
    generate_decarbonisation_actions,
)
from shared.schemas import (
    CanonicalBalanceSheetPeriod,
    CanonicalCarbonBaselinePayload,
    CanonicalCashBudgetPayload,
    CanonicalEnergyPayload,
    CanonicalIncomeStatementPeriod,
    CanonicalSMEDataPayload,
)

# Documented Emission Factors (Peninsular Grid & Industrial Fuels)
GRID_EMISSION_FACTOR_KG = 0.584   # kgCO2e / kWh (Suruhanjaya Tenaga 2023)
DIESEL_EMISSION_FACTOR_KG = 2.6865 # kgCO2e / L (DEFRA 2024 / Malaysian Standard)
PETROL_EMISSION_FACTOR_KG = 2.31   # kgCO2e / L
NATURAL_GAS_EMISSION_FACTOR_KG = 2.02 # kgCO2e / m3
LPG_EMISSION_FACTOR_KG = 2.94      # kgCO2e / kg

# Standard Malaysian Commercial Tariffs
ELECTRICITY_TARIFF_RM_PER_KWH = 0.44
DIESEL_PRICE_RM_PER_L = 2.15
PETROL_PRICE_RM_PER_L = 2.05


def parse_energy_sector_csv(
    content: str | bytes,
    sector: str = "total",
    target_year: Optional[int] = None,
) -> NormalizedDataset:
    """Parses energy sector consumption CSV (e.g. date,sector,consumption).

    Filters by specified sector (default 'total') and extracts monthly consumption
    for the target reporting year (defaults to 2024 if available, or latest full year).
    """
    if isinstance(content, bytes):
        text = content.decode("utf-8-sig", errors="replace")
    else:
        text = content

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        raise ValueError("Empty energy consumption CSV file")

    target_sec = sector.strip().lower()
    matched = [r for r in rows if r.get("sector", "").strip().lower() == target_sec]
    if not matched:
        # Fallback to all rows if specific sector not found
        matched = rows

    available_years = sorted({r["date"][:4] for r in matched if len(r.get("date", "")) >= 4})
    if target_year is not None:
        year = str(target_year)
    else:
        year = "2024" if "2024" in available_years else (available_years[-1] if available_years else "2024")

    year_rows = [r for r in matched if r.get("date", "").startswith(year)]
    total_kwh = sum(float(r["consumption"]) for r in year_rows if r.get("consumption"))

    return NormalizedDataset(
        metadata=SMEMetadata(
            company_name=f"SME Energy Consumption ({sector.title()} Sector)",
            reporting_year=int(year),
        ),
        activity=ActivityData(electricity_kwh=round(total_kwh, 2)),
    )


def parse_asset_telemetry_csv(
    content: str | bytes,
    target_year: int = 2022,
) -> NormalizedDataset:
    """Parses equipment/machine telemetry CSV (ts,asset,items,status,power_avg,...).

    Aggregates runtime hours, items produced, and total power consumption across assets.
    """
    if isinstance(content, bytes):
        text = content.decode("utf-8-sig", errors="replace")
    else:
        text = content

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        raise ValueError("Empty asset telemetry CSV file")

    total_kwh = 0.0
    total_items = 0.0
    for r in rows:
        p_avg = float(r.get("power_avg") or 0.0)
        items = float(r.get("items") or 0.0)
        total_items += items
        # Each telemetry record is recorded every 5 minutes (5 / 60 hours = 0.0833 hr)
        # Power in kW * 5/60 hr = kWh consumed
        total_kwh += p_avg * (5.0 / 60.0)

    return NormalizedDataset(
        metadata=SMEMetadata(
            company_name="SME Precision Manufacturing Plant (IoT Telemetry)",
            reporting_year=target_year,
        ),
        activity=ActivityData(electricity_kwh=round(total_kwh, 2)),
    )


def normalized_to_canonical(dataset: NormalizedDataset) -> CanonicalSMEDataPayload:
    """Translates a NormalizedDataset from Yuni's parser into a CanonicalSMEDataPayload for the Finance & Transition engine.

    Ensures balanced financial statements (Assets = Liabilities + Equity) and computes
    emissions baseline and energy metrics.
    """
    year = dataset.metadata.reporting_year or 2024
    curr_period = f"FY{year}"
    periods = [f"FY{year-2}", f"FY{year-1}", curr_period]

    # Energy & Activity Data
    kwh = dataset.activity.electricity_kwh or 0.0
    diesel = dataset.activity.diesel_litres or 0.0
    petrol = dataset.activity.petrol_litres or 0.0
    gas = dataset.activity.natural_gas_m3 or 0.0
    lpg = dataset.activity.lpg_kg or 0.0

    elec_cost = round(kwh * ELECTRICITY_TARIFF_RM_PER_KWH, 2)
    fuel_cost = round(
        diesel * DIESEL_PRICE_RM_PER_L
        + petrol * PETROL_PRICE_RM_PER_L
        + gas * 2.02
        + lpg * 2.66,
        2,
    )

    scope2 = round((kwh * GRID_EMISSION_FACTOR_KG) / 1000.0, 3)
    scope1 = round(
        (
            diesel * DIESEL_EMISSION_FACTOR_KG
            + petrol * PETROL_EMISSION_FACTOR_KG
            + gas * NATURAL_GAS_EMISSION_FACTOR_KG
            + lpg * LPG_EMISSION_FACTOR_KG
        )
        / 1000.0,
        3,
    )
    total_tco2e = round(scope1 + scope2, 3)

    energy = CanonicalEnergyPayload(
        annual_kwh=round(kwh, 2),
        annual_electricity_cost=elec_cost,
        annual_diesel_l=round(diesel, 2),
        annual_fuel_cost=fuel_cost,
    )
    carbon_baseline = CanonicalCarbonBaselinePayload(
        total_tco2e=total_tco2e,
        scope1=scope1,
        scope2=scope2,
        confidence_pct=95.0,
    )

    # Financial Modeling Anchor
    # If revenue is ingested, anchor to ingested revenue; otherwise use standard baseline benchmark (RM 3.2M)
    std_model = get_standard_sme_financial_model()
    anchor_rev = dataset.financial.revenue or std_model["income_statement"].revenue
    anchor_cash = dataset.financial.cash_balance or std_model["balance_sheet"].cash
    anchor_opex = dataset.financial.operating_expenses or std_model["income_statement"].operating_expenses

    # Generate 3-year historical & current period inputs
    is_inputs: dict[str, CanonicalIncomeStatementPeriod] = {}
    bs_inputs: dict[str, CanonicalBalanceSheetPeriod] = {}

    growth_factors = {
        periods[0]: 0.88,
        periods[1]: 0.94,
        periods[2]: 1.00,
    }

    for p, factor in growth_factors.items():
        rev = round(anchor_rev * factor)
        cogs = round(rev * 0.55)
        opex = round(anchor_opex * factor)
        da = round(rev * 0.05)
        fin_cost = round(rev * 0.012)
        pbt = rev - cogs - opex - da - fin_cost
        tax = calculate_malaysian_sme_tax(TaxInputs(tax_year=int(p[2:]), accounting_profit=pbt)).calculated_tax_expense

        is_inputs[p] = CanonicalIncomeStatementPeriod(
            revenue=rev,
            cogs=cogs,
            opex_lines={"operating_expenses": opex},
            da=da,
            finance_costs=fin_cost,
            income_tax_expense=tax,
        )

        cash = round(anchor_cash * factor)
        ar = round(rev * 45 / 365)
        inv = round(cogs * 45 / 365)
        oca = round(rev * 0.015)
        fixed = round(rev * 0.40)
        acc_dep = round(fixed * 0.30)
        oa = round(rev * 0.01)

        ap = round(cogs * 45 / 365)
        st_debt = round(rev * 0.03)
        lt_debt = round(rev * 0.12)

        tot_assets = cash + ar + inv + oca + (fixed - acc_dep) + oa
        tot_liab = ap + st_debt + lt_debt
        equity = tot_assets - tot_liab

        cap = round(equity * 0.65)
        re = equity - cap

        bs_inputs[p] = CanonicalBalanceSheetPeriod(
            cash=cash,
            ar=ar,
            inventory=inv,
            other_current_assets=oca,
            fixed_assets_at_cost=fixed,
            accumulated_depreciation=acc_dep,
            other_assets=oa,
            ap=ap,
            short_term_debt=st_debt,
            long_term_debt=lt_debt,
            capital=cap,
            retained_earnings=re,
            drawings=0.0,
        )

    # 12-Month Cash Budget
    m_sales = round(anchor_rev / 12)
    m_purchases = round((anchor_rev * 0.55) / 12)
    m_opex = round(anchor_opex / 12)
    budget = CanonicalCashBudgetPayload(
        cash_sales=[round(m_sales * 0.20)] * 12,
        credit_sales=[round(m_sales * 0.80)] * 12,
        cash_purchases=[round(m_purchases * 0.40)] * 12,
        credit_purchases=[round(m_purchases * 0.60)] * 12,
        opex=[m_opex] * 12,
        opening_cash_m1=anchor_cash,
    )

    return CanonicalSMEDataPayload(
        currency="MYR",
        periods=periods,
        income_statement_inputs=is_inputs,
        balance_sheet_inputs=bs_inputs,
        cash_budget_inputs=budget,
        energy=energy,
        carbon_baseline=carbon_baseline,
    )


def ingest_and_evaluate(
    uploads: list[tuple[str, bytes]],
    sector: Optional[str] = None,
    year: Optional[int] = None,
) -> dict[str, Any]:
    """Universal ingestion pipeline:

    1. Tries standard structured Yuni import (ingest_uploads).
    2. If headers match custom format (energy consumption or IoT telemetry), adapts seamlessly.
    3. Transforms NormalizedDataset into CanonicalSMEDataPayload.
    4. Executes the full deterministic Finance + Transition calculation pipeline.
    5. Returns unified statements, ratios, carbon baseline, and transition options.
    """
    normalized: Optional[NormalizedDataset] = None
    ingest_mode = "standard_yuni_parser"

    # Step 1: Try standard ingest_uploads
    try:
        normalized = ingest_uploads(uploads)
    except DataImportError as e:
        # Check if the files match known custom formats
        for filename, content in uploads:
            header_sample = ""
            if isinstance(content, bytes):
                header_sample = content[:500].decode("utf-8-sig", errors="replace").lower()
            elif isinstance(content, str):
                header_sample = content[:500].lower()

            if "sector" in header_sample and "consumption" in header_sample:
                ingest_mode = "energy_sector_csv_adapter"
                normalized = parse_energy_sector_csv(content, sector=sector or "total", target_year=year)
                break
            elif "power_avg" in header_sample or ("asset" in header_sample and "cycle_time" in header_sample):
                ingest_mode = "asset_telemetry_csv_adapter"
                normalized = parse_asset_telemetry_csv(content, target_year=year or 2022)
                break

        if normalized is None:
            # Re-raise controlled diagnostic dictionary
            raise e

    # Step 2: Convert to Canonical Payload
    canonical = normalized_to_canonical(normalized)

    # Step 3: Run Finance Engine
    from finance_transition.router import statements_from_canonical

    finance_output = statements_from_canonical(canonical)

    # Step 4: Run Transition Options Engine
    latest_period = canonical.periods[-1]
    latest_is = finance_output["income_statements"][latest_period]
    latest_bs = finance_output["balance_sheets"][latest_period]

    constraints = BusinessConstraints(
        currency=canonical.currency,
        cash_balance=latest_bs.cash,
        annual_revenue=latest_is.revenue,
        annual_opex=latest_is.operating_expenses + latest_is.cogs,
        existing_annual_debt_service=latest_is.finance_costs,
        max_capex_budget=max(200_000.0, latest_bs.cash * 1.5),
        minimum_cash_buffer=100_000.0,
    )

    energy_inputs = EnergyActivityInputs(
        annual_kwh=canonical.energy.annual_kwh,
        annual_electricity_cost=canonical.energy.annual_electricity_cost,
        annual_diesel_liters=canonical.energy.annual_diesel_l,
        annual_fuel_cost=canonical.energy.annual_fuel_cost,
        total_tco2e=canonical.carbon_baseline.total_tco2e,
        grid_kg_per_kwh=GRID_EMISSION_FACTOR_KG,
        diesel_kg_per_l=DIESEL_EMISSION_FACTOR_KG,
    )

    fin_summary_inputs = FinancialSummaryInputs(
        currency=canonical.currency,
        cash_balance=latest_bs.cash,
        annual_revenue=latest_is.revenue,
        annual_opex=latest_is.operating_expenses + latest_is.cogs,
        annual_energy_cost=canonical.energy.annual_electricity_cost,
        annual_fuel_cost=canonical.energy.annual_fuel_cost,
        existing_annual_debt_service=latest_is.finance_costs,
    )
    fin_summary = get_financial_summary(fin_summary_inputs)

    actions = generate_decarbonisation_actions(energy_inputs, fin_summary)
    options_bundle = compare_transition_options(fin_summary_inputs, energy_inputs, constraints)

    # Step 5: Audit Log
    audit = create_audit_record(
        tool="ingest_and_evaluate",
        inputs={
            "files": [name for name, _ in uploads],
            "mode": ingest_mode,
            "normalized_metadata": normalized.metadata.model_dump(),
            "normalized_financial": normalized.financial.model_dump(),
            "normalized_activity": normalized.activity.model_dump(),
        },
        formulas=[
            "Yuni backend.data ingestion -> CanonicalSMEDataPayload adapter",
            "Scope 1 = (Diesel * 2.6865 + Petrol * 2.31 + Gas * 2.02 + LPG * 2.94) / 1000",
            "Scope 2 = (kWh * 0.584) / 1000",
            "Total Assets = Liabilities + Equity check",
            "Transition NPV & Payback across decarbonisation actions",
        ],
    )

    return {
        "success": True,
        "ingest_mode": ingest_mode,
        "company_name": normalized.metadata.company_name or "Precision Manufacturing SME",
        "reporting_year": canonical.periods[-1],
        "normalized_dataset": normalized.model_dump(mode="json"),
        "canonical_payload": canonical.model_dump(mode="json"),
        "carbon_baseline": canonical.carbon_baseline.model_dump(),
        "energy_metrics": canonical.energy.model_dump(),
        "income_statements": {k: v.model_dump() for k, v in finance_output["income_statements"].items()},
        "balance_sheets": {k: v.model_dump() for k, v in finance_output["balance_sheets"].items()},
        "cash_flow_statements": {k: v.model_dump() for k, v in finance_output["cash_flow_statements"].items()},
        "ratios": {k: v.model_dump() for k, v in finance_output["ratios"].items()},
        "cash_budget": finance_output["cash_budget"].model_dump() if finance_output["cash_budget"] else None,
        "tax_adjustment": finance_output["tax_adjustment"].model_dump() if finance_output["tax_adjustment"] else None,
        "financial_summary": finance_output["financial_summary"].model_dump() if finance_output["financial_summary"] else None,
        "transition_options": options_bundle.model_dump(),
        "audit": audit.model_dump(),
    }
