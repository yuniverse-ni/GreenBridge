"""Tests for the Ingestion -> Finance & Transition Bridge Adapter.

Verifies:
1. Yuni's NormalizedDataset transforms into CanonicalSMEDataPayload with exact balance sheet equality.
2. Ingesting Yuni's test data (energy_sector_consumption.csv) generates accurate activity data, carbon baseline, and transition options.
3. Ingesting asset_telemetry.csv aggregates IoT sensor power into verified kWh and carbon baseline.
4. HTTP endpoints /api/finance/ingest/upload, /api/finance/ingest/energy-csv, and /api/finance/ingest/telemetry-csv.
"""

from __future__ import annotations

import io
import os
import pytest
from fastapi.testclient import TestClient

from backend.data.models import ActivityData, FinancialData, NormalizedDataset, SMEMetadata
from finance_transition.adapter import (
    ingest_and_evaluate,
    normalized_to_canonical,
    parse_asset_telemetry_csv,
    parse_energy_sector_csv,
)
from main import app

client = TestClient(app)


def test_normalized_to_canonical_balances():
    """Normalized dataset with revenue, opex, and activity produces a balanced canonical payload."""
    dataset = NormalizedDataset(
        metadata=SMEMetadata(
            company_id="SME-TEST-01",
            company_name="Apex Precision Engineering",
            reporting_year=2024,
            employees=45,
            floor_area_m2=1200.0,
        ),
        financial=FinancialData(
            revenue=3_500_000.0,
            operating_expenses=750_000.0,
            cash_balance=250_000.0,
            annual_debt_service=48_000.0,
            capex_budget=500_000.0,
            minimum_cash_reserve=100_000.0,
        ),
        activity=ActivityData(
            electricity_kwh=180_000.0,
            diesel_litres=12_000.0,
        ),
    )

    canonical = normalized_to_canonical(dataset)
    assert canonical.currency == "MYR"
    assert "FY2024" in canonical.periods
    assert canonical.energy.annual_kwh == 180_000.0
    assert canonical.energy.annual_diesel_l == 12_000.0

    # Scope 2 = 180,000 * 0.584 / 1000 = 105.12 tCO2e
    assert canonical.carbon_baseline.scope2 == pytest.approx(105.12, rel=1e-2)
    # Scope 1 = 12,000 * 2.6865 / 1000 = 32.238 tCO2e
    assert canonical.carbon_baseline.scope1 == pytest.approx(32.238, rel=1e-2)
    assert canonical.carbon_baseline.total_tco2e == pytest.approx(137.358, rel=1e-2)

    # Balance Sheet validation for every period
    for p in canonical.periods:
        bs = canonical.balance_sheet_inputs[p]
        total_assets = (
            bs.cash
            + bs.ar
            + bs.inventory
            + bs.other_current_assets
            + (bs.fixed_assets_at_cost - bs.accumulated_depreciation)
            + bs.other_assets
        )
        total_liab_equity = (
            bs.ap
            + bs.short_term_debt
            + bs.long_term_debt
            + bs.capital
            + bs.retained_earnings
        )
        assert total_assets == pytest.approx(total_liab_equity, abs=1.0)


def test_parse_energy_sector_csv():
    """Verify parsing of test_data/energy_sector_consumption.csv."""
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    csv_path = os.path.join(root_dir, "test_data", "energy_sector_consumption.csv")

    with open(csv_path, "rb") as f:
        content = f.read()

    # Parse total sector for 2024
    ds = parse_energy_sector_csv(content, sector="total", target_year=2024)
    assert ds.metadata.reporting_year == 2024
    assert ds.activity.electricity_kwh > 100_000

    # Verify adapter execution
    canonical = normalized_to_canonical(ds)
    assert canonical.carbon_baseline.scope2 > 0
    assert canonical.carbon_baseline.total_tco2e > 0


def test_parse_asset_telemetry_csv():
    """Verify parsing of test_data/asset_telemetry.csv."""
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    csv_path = os.path.join(root_dir, "test_data", "asset_telemetry.csv")

    with open(csv_path, "rb") as f:
        content = f.read()

    ds = parse_asset_telemetry_csv(content, target_year=2022)
    assert ds.metadata.reporting_year == 2022
    assert ds.activity.electricity_kwh > 0

    canonical = normalized_to_canonical(ds)
    assert canonical.carbon_baseline.scope2 > 0


def test_http_ingest_energy_csv_endpoint():
    """Verify POST /api/finance/ingest/energy-csv endpoint with energy_sector_consumption.csv."""
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    csv_path = os.path.join(root_dir, "test_data", "energy_sector_consumption.csv")

    with open(csv_path, "rb") as f:
        content = f.read()

    response = client.post(
        "/api/finance/ingest/energy-csv?sector=local_commercial&year=2024",
        files={"file": ("energy_sector_consumption.csv", content, "text/csv")},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "income_statements" in data
    assert "balance_sheets" in data
    assert "carbon_baseline" in data
    assert data["carbon_baseline"]["scope2"] > 0
    assert "transition_options" in data
    assert len(data["transition_options"]["ranked"]) > 0


def test_http_ingest_telemetry_csv_endpoint():
    """Verify POST /api/finance/ingest/telemetry-csv endpoint with asset_telemetry.csv."""
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    csv_path = os.path.join(root_dir, "test_data", "asset_telemetry.csv")

    with open(csv_path, "rb") as f:
        content = f.read()

    response = client.post(
        "/api/finance/ingest/telemetry-csv?year=2022",
        files={"file": ("asset_telemetry.csv", content, "text/csv")},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["carbon_baseline"]["total_tco2e"] > 0
    assert "transition_options" in data


def test_http_ingest_dataset_endpoint():
    """Verify POST /api/finance/ingest/dataset with an in-memory NormalizedDataset."""
    payload = {
        "metadata": {
            "company_name": "Precision Tech Sdn Bhd",
            "reporting_year": 2024,
            "employees": 30,
        },
        "financial": {
            "revenue": 2_800_000,
            "operating_expenses": 600_000,
            "cash_balance": 180_000,
            "annual_debt_service": 36_000,
        },
        "activity": {
            "electricity_kwh": 120_000,
            "diesel_litres": 8_000,
        },
    }
    response = client.post("/api/finance/ingest/dataset", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "FY2024" in data["income_statements"]
    assert data["income_statements"]["FY2024"]["revenue"] == 2_800_000
    assert data["tax_adjustment"]["calculated_tax_expense"] > 0
