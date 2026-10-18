"""Test J: Multi-Currency Consistency Enforcement."""

import os
import pytest
from fastapi.testclient import TestClient
from finance_transition.finance_models import (
    BalanceSheetInputs,
    IncomeStatementInputs,
    StatementsComputeRequest,
)
from finance_transition.finance_service import currencies_compatible
from finance_transition.template_reader import parse_financial_template
from main import app


def test_test_j_multi_currency_consistency():
    """Test J: Multi-Currency Consistency Enforcement.

    Guards against combining figures from different currencies without exchange rate metadata.
    Refuses incompatible currency mixes (e.g. MYR vs USD).
    """
    assert currencies_compatible("MYR", "MYR") is True
    assert currencies_compatible("myr", "MYR") is True
    assert currencies_compatible("MYR", "USD") is False
    assert currencies_compatible("MYR", "CNY") is False


def test_api_refuses_non_myr_without_conversion():
    """API endpoint /statements/compute returns 400 when currency is not MYR."""
    client = TestClient(app)
    req = StatementsComputeRequest(
        currency="USD",
        income=IncomeStatementInputs(
            period="FY2024",
            revenue=100_000,
            cogs=50_000,
            operating_expenses=20_000,
            depreciation_amortisation=5_000,
            finance_costs=1_000,
        ),
        balance_sheet=BalanceSheetInputs(
            period="FY2024",
            cash=10_000,
            accounts_receivable=20_000,
            inventory=15_000,
            fixed_assets_at_cost=50_000,
            accumulated_depreciation=10_000,
            accounts_payable=15_000,
            short_term_debt=5_000,
            long_term_debt=20_000,
            capital=30_000,
            retained_earnings=15_000,
        ),
    )
    res = client.post("/api/finance/statements/compute", json=req.model_dump())
    assert res.status_code == 400
    assert "Multi-Currency Consistency Enforcement" in res.json()["detail"]


def test_template_reader_refuses_non_myr():
    """Template reader raises ValueError when non-MYR currency override is passed without FX rule."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    xlsx_path = os.path.join(
        os.path.dirname(current_dir),
        "finance_transition",
        "File 1 - Financial Data Input Template.xlsx",
    )
    with pytest.raises(ValueError, match="Multi-Currency Consistency Enforcement"):
        parse_financial_template(
            xlsx_path,
            override_currency="USD",
        )
