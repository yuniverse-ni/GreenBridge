"""Tests G and I for 12-month forward cash budget and shortfall alerting."""

from finance_transition.finance_models import CashBudgetInputs, CollectionSchedule
from finance_transition.finance_service import calculate_12_month_cash_budget


def test_test_g_monthly_cash_budget_loan_principal_deduction():
    """Test G: Monthly Cash Budget & Loan Principal Deduction.

    Opening cash = RM 20,000. Cash receipts = RM 15,000. Operating payments = RM 8,000.
    Tax = RM 2,000. Interest = RM 500. Principal repayment = RM 2,500.
    Expected closing cash = RM 22,000.
    Principal repayment must reduce cash (corrects spreadsheet error #14).
    """
    opening_cash = 20_000
    receipts = 15_000
    opex = 8_000
    tax = 2_000
    interest = 500
    principal = 2_500
    # Net = 15000 - (8000 + 2000 + 500 + 2500) = 15000 - 13000 = +2000
    # Expected closing = 20000 + 2000 = 22000

    budget = calculate_12_month_cash_budget(
        CashBudgetInputs(
            initial_opening_cash=opening_cash,
            minimum_cash_buffer=10_000,
            monthly_sales=[receipts] + [0] * 11,
            cash_sales_pct=100,  # all cash sales for direct test
            collection_schedule=CollectionSchedule(
                current_month_pct=100, one_month_later_pct=0, two_months_later_pct=0
            ),
            monthly_purchases=[0] * 12,
            supplier_payment_current_pct=100,
            monthly_opex=[opex] + [0] * 11,
            monthly_tax_payments=[tax] + [0] * 11,
            monthly_interest_payments=[interest] + [0] * 11,
            monthly_principal_repayments=[principal] + [0] * 11,
            monthly_capex=[0] * 12,
        )
    )

    m1 = budget.months[0]
    assert m1.closing_cash == 22_000
    assert m1.principal_repayments == 2_500


def test_test_i_forecast_cash_shortfall_alert():
    """Test I: Forecast Cash Shortfall & Buffer Monitoring.

    When closing cash falls below minimum buffer, identify affected month & shortfall.
    Opening = 15,000, Buffer = 20,000 -> immediate shortfall in month 1.
    """
    budget = calculate_12_month_cash_budget(
        CashBudgetInputs(
            initial_opening_cash=15_000,
            minimum_cash_buffer=20_000,
            monthly_sales=[10_000] * 12,
            cash_sales_pct=50,
            collection_schedule=CollectionSchedule(
                current_month_pct=50, one_month_later_pct=30, two_months_later_pct=20
            ),
            monthly_purchases=[8_000] * 12,
            supplier_payment_current_pct=100,
            monthly_opex=[5_000] * 12,
        )
    )

    assert budget.shortfall_alert is not None
    assert budget.shortfall_alert.month_index == 1
    assert budget.shortfall_alert.shortfall_amount > 0
    assert budget.shortfall_alert.first_shortfall_month == "Month 1"
    assert budget.maximum_shortfall > 0


def test_month_to_month_cash_linkage():
    """Verifies that Month(i).opening_cash == Month(i-1).closing_cash strictly."""
    budget = calculate_12_month_cash_budget(
        CashBudgetInputs(
            initial_opening_cash=100_000,
            minimum_cash_buffer=50_000,
            monthly_sales=[50_000] * 12,
            cash_sales_pct=20,
            collection_schedule=CollectionSchedule(
                current_month_pct=50, one_month_later_pct=30, two_months_later_pct=20
            ),
            monthly_purchases=[30_000] * 12,
            supplier_payment_current_pct=60,
            monthly_opex=[15_000] * 12,
        )
    )

    for i in range(1, 12):
        prev_closing = budget.months[i - 1].closing_cash
        curr_opening = budget.months[i].opening_cash
        assert curr_opening == prev_closing
