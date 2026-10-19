"""Tests A through F, Test H, and Malaysian SME tax tests."""

import pytest
from finance_transition.finance_models import (
    BalanceSheetInputs,
    CashFlowInputs,
    IncomeStatementInputs,
    TaxInputs,
)
from finance_transition.finance_service import (
    calculate_balance_sheet,
    calculate_cash_flow_statement,
    calculate_financial_ratios,
    calculate_income_statement,
    calculate_malaysian_sme_tax,
)


def test_test_a_accounts_receivable_movement():
    """Test A: Opening AR = RM 20,000. Closing AR = RM 30,000.

    Expected operating cash-flow adjustment = -RM 10,000 (must NOT be -RM 50,000).
    """
    opening_ar = 20_000
    closing_ar = 30_000

    cfs = calculate_cash_flow_statement(
        CashFlowInputs(
            period="Test Period",
            opening_cash=10_000,
            net_profit=0,
            depreciation_expense=0,
            prior_accounts_receivable=opening_ar,
            current_accounts_receivable=closing_ar,
            prior_inventory=0,
            current_inventory=0,
            prior_accounts_payable=0,
            current_accounts_payable=0,
            capital_expenditure=0,
            principal_repayments=0,
            balance_sheet_cash=0,
        )
    )

    assert cfs.delta_accounts_receivable == -10_000
    assert cfs.operating_cash_flow == -10_000


def test_test_b_inventory_movement():
    """Test B: Opening inventory = RM 15,000. Closing inventory = RM 25,000.

    Expected operating cash-flow adjustment = -RM 10,000.
    """
    opening_inv = 15_000
    closing_inv = 25_000

    cfs = calculate_cash_flow_statement(
        CashFlowInputs(
            period="Test Period",
            opening_cash=10_000,
            net_profit=0,
            depreciation_expense=0,
            prior_accounts_receivable=0,
            current_accounts_receivable=0,
            prior_inventory=opening_inv,
            current_inventory=closing_inv,
            prior_accounts_payable=0,
            current_accounts_payable=0,
            capital_expenditure=0,
            principal_repayments=0,
            balance_sheet_cash=0,
        )
    )

    assert cfs.delta_inventory == -10_000
    assert cfs.operating_cash_flow == -10_000


def test_test_c_accounts_payable_movement():
    """Test C: Opening AP = RM 12,000. Closing AP = RM 17,000.

    Expected operating cash-flow adjustment = +RM 5,000.
    """
    opening_ap = 12_000
    closing_ap = 17_000

    cfs = calculate_cash_flow_statement(
        CashFlowInputs(
            period="Test Period",
            opening_cash=10_000,
            net_profit=0,
            depreciation_expense=0,
            prior_accounts_receivable=0,
            current_accounts_receivable=0,
            prior_inventory=0,
            current_inventory=0,
            prior_accounts_payable=opening_ap,
            current_accounts_payable=closing_ap,
            capital_expenditure=0,
            principal_repayments=0,
            balance_sheet_cash=15_000,
        )
    )

    assert cfs.delta_accounts_payable == 5_000
    assert cfs.operating_cash_flow == 5_000


def test_test_d_depreciation_add_back():
    """Test D: Net profit = RM 50,000. Depreciation expense = RM 8,000.

    Expected depreciation add-back = +RM 8,000. Total OCF = RM 58,000.
    """
    net_profit = 50_000
    dep_expense = 8_000

    cfs = calculate_cash_flow_statement(
        CashFlowInputs(
            period="Test Period",
            opening_cash=10_000,
            net_profit=net_profit,
            depreciation_expense=dep_expense,
            prior_accounts_receivable=0,
            current_accounts_receivable=0,
            prior_inventory=0,
            current_inventory=0,
            prior_accounts_payable=0,
            current_accounts_payable=0,
            capital_expenditure=0,
            principal_repayments=0,
            balance_sheet_cash=68_000,
        )
    )

    assert cfs.depreciation_add_back == 8_000
    assert cfs.operating_cash_flow == 58_000


def test_test_e_cash_reconciliation():
    """Test E: Opening cash = RM 20,000. Operating CF = RM 10,000. Investing CF = -RM 5,000. Financing CF = -RM 3,000.

    Expected closing cash = RM 22,000. Projected balance-sheet cash must reconcile to RM 22,000.
    """
    cfs = calculate_cash_flow_statement(
        CashFlowInputs(
            period="Test Period",
            opening_cash=20_000,
            net_profit=10_000,
            depreciation_expense=0,
            prior_accounts_receivable=0,
            current_accounts_receivable=0,
            prior_inventory=0,
            current_inventory=0,
            prior_accounts_payable=0,
            current_accounts_payable=0,
            capital_expenditure=5_000,  # Investing -5k
            principal_repayments=3_000,  # Financing -3k
            balance_sheet_cash=22_000,
        )
    )

    assert cfs.closing_cash == 22_000
    assert cfs.is_reconciled is True
    assert cfs.cash_reconciliation_difference == 0.0


def test_test_f_balance_sheet_equality():
    """Test F: Total assets = RM 150,000. Total liabilities = RM 90,000. Total equity = RM 60,000.

    Expected balance-sheet difference = RM 0.
    """
    bs = calculate_balance_sheet(
        BalanceSheetInputs(
            period="Test Period",
            cash=50_000,
            accounts_receivable=50_000,
            inventory=50_000,  # Current Assets = 150k
            fixed_assets_at_cost=0,
            accumulated_depreciation=0,
            accounts_payable=40_000,
            short_term_debt=20_000,
            long_term_debt=30_000,  # Total Liab = 90k
            capital=30_000,
            retained_earnings=30_000,  # Total Equity = 60k
        )
    )

    assert bs.total_assets == 150_000
    assert bs.total_liabilities_and_equity == 150_000
    assert bs.is_reconciled is True
    assert bs.reconciliation_difference == 0.0


def test_test_h_zero_denominator_ratios():
    """Test H: Zero Denominators in Financial Ratios.

    Revenue = 0.
    Must NOT produce division-by-zero, infinity, or misleading percentage.
    Return explanatory non-calculable result.
    """
    is_zero = calculate_income_statement(
        IncomeStatementInputs(
            period="Zero Revenue Period",
            revenue=0,
            cogs=0,
            operating_expenses=10_000,
            depreciation_amortisation=0,
            finance_costs=0,
            income_tax_expense=0,
        )
    )

    bs_dummy = calculate_balance_sheet(
        BalanceSheetInputs(
            period="Dummy BS",
            cash=10_000,
            accounts_receivable=0,
            inventory=0,
            fixed_assets_at_cost=10_000,
            accumulated_depreciation=0,
            accounts_payable=5_000,
            short_term_debt=0,
            long_term_debt=0,
            capital=15_000,
            retained_earnings=0,
        )
    )

    ratios = calculate_financial_ratios(bs_dummy, is_zero)

    assert ratios.gross_profit_margin.is_calculable is False
    assert ratios.gross_profit_margin.status == "not_calculable"
    assert ratios.gross_profit_margin.value is None
    assert "Revenue is zero" in ratios.gross_profit_margin.explanation

    assert ratios.net_profit_margin.is_calculable is False
    assert ratios.net_profit_margin.status == "not_calculable"
    assert ratios.net_profit_margin.value is None

    assert ratios.ebitda_margin.is_calculable is False
    assert ratios.ebitda_margin.status == "not_calculable"


def test_income_statement_math():
    """Verifies core income statement calculations."""
    is_res = calculate_income_statement(
        IncomeStatementInputs(
            period="FY2024",
            revenue=1_000_000,
            cogs=600_000,
            operating_expenses=200_000,
            depreciation_amortisation=50_000,
            finance_costs=20_000,
            income_tax_expense=25_000,
        )
    )
    assert is_res.gross_profit == 400_000
    assert is_res.ebitda == 200_000
    assert is_res.ebit == 150_000
    assert is_res.profit_before_tax == 130_000
    assert is_res.net_profit == 105_000


def test_malaysian_sme_tax_tiers():
    """Verifies Malaysian SME Tax Tiers:

    15% on first RM 150,000, 17% on next RM 450,000, 24% on remainder.
    """
    # Case 1: RM 100,000 (all in Tier 1)
    t1 = calculate_malaysian_sme_tax(TaxInputs(tax_year=2024, accounting_profit=100_000))
    assert t1.calculated_tax_expense == 15_000.0
    assert t1.effective_tax_rate_pct == 15.0

    # Case 2: RM 300,000 (150k @ 15% + 150k @ 17%)
    # 22,500 + 25,500 = 48,000
    t2 = calculate_malaysian_sme_tax(TaxInputs(tax_year=2024, accounting_profit=300_000))
    assert t2.calculated_tax_expense == 48_000.0

    # Case 3: RM 800,000 (150k @ 15% + 450k @ 17% + 200k @ 24%)
    # 22,500 + 76,500 + 48,000 = 147,000
    t3 = calculate_malaysian_sme_tax(TaxInputs(tax_year=2024, accounting_profit=800_000))
    assert t3.calculated_tax_expense == 147_000.0
    assert any("not a Form C filing" in note for note in t3.notes)


def test_statements_from_canonical():
    """Verifies that the canonical contract from Part 1 computes balanced statements and CFS."""
    from fastapi.testclient import TestClient
    from main import app
    from shared.schemas import (
        CanonicalBalanceSheetPeriod,
        CanonicalEnergyPayload,
        CanonicalIncomeStatementPeriod,
        CanonicalSMEDataPayload,
    )

    client = TestClient(app)
    payload = CanonicalSMEDataPayload(
        currency="MYR",
        periods=["FY2023", "FY2024"],
        income_statement_inputs={
            "FY2024": CanonicalIncomeStatementPeriod(
                revenue=3_200_000,
                cogs=1_920_000,
                opex_lines={"staff": 400_000, "utilities": 96_000, "admin": 184_000},
                da=95_000,
                finance_costs=32_000,
                income_tax_expense=80_500,
            )
        },
        balance_sheet_inputs={
            "FY2023": CanonicalBalanceSheetPeriod(
                cash=240_000,
                ar=410_000,
                inventory=280_000,
                other_current_assets=25_000,
                fixed_assets_at_cost=1_100_000,
                accumulated_depreciation=320_000,
                ap=215_000,
                short_term_debt=65_000,
                long_term_debt=320_000,
                capital=500_000,
                retained_earnings=635_000,
                drawings=0,
            ),
            "FY2024": CanonicalBalanceSheetPeriod(
                cash=312_500,
                ar=460_000,
                inventory=310_000,
                other_current_assets=25_000,
                fixed_assets_at_cost=1_220_000,
                accumulated_depreciation=415_000,
                ap=245_000,
                short_term_debt=70_000,
                long_term_debt=275_000,
                capital=500_000,
                retained_earnings=927_500,
                drawings=105_000,
            ),
        },
        energy=CanonicalEnergyPayload(
            annual_kwh=120_000,
            annual_electricity_cost=96_000,
            annual_diesel_l=20_000,
            annual_fuel_cost=55_000,
        ),
    )

    res = client.post("/api/finance/statements/from-canonical", json=payload.model_dump())
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["balance_sheets"]["FY2024"]["is_reconciled"] is True
    assert data["income_statements"]["FY2024"]["ebitda"] == 600_000.0
    assert "FY2024" in data["cash_flow_statements"]
    assert data["cash_flow_statements"]["FY2024"]["delta_accounts_receivable"] == -50_000.0
    assert data["ratios"]["FY2024"]["current_ratio"]["is_calculable"] is True
    assert "audit" in data

