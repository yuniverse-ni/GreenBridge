"""Tests for template parsing, green cell detection, and completeness reporting.

Includes Test T4.
"""

import os
from finance_transition.template_reader import parse_financial_template


def test_t4_missing_green_cell_completeness_notes():
    """Test T4: Missing green cell -> field null/0 + completeness note.

    Never fill with sample SME data unless use_sample=true.
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    xlsx_path = os.path.join(
        os.path.dirname(current_dir),
        "finance_transition",
        "File 1 - Financial Data Input Template.xlsx",
    )

    # When use_sample is False:
    res = parse_financial_template(xlsx_path, use_sample=False)

    assert res.use_sample is False
    # In the blank template, green cells have no data, so completeness notes must flag them
    assert len(res.completeness_notes) > 0
    assert any("Revenue" in note for note in res.completeness_notes)
    assert any("Cash / Bank" in note for note in res.completeness_notes)

    # Raw IS revenue must not be silently replaced with 3,200,000
    assert res.income_statements["FY2024"].revenue == 0.0


def test_template_with_sample_true():
    """When use_sample=True, API populates standard SME model numbers.

    Returns balanced statements, ratios, 12-month budget, tax, DSCR, and debt capacity.
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    xlsx_path = os.path.join(
        os.path.dirname(current_dir),
        "finance_transition",
        "File 1 - Financial Data Input Template.xlsx",
    )

    res = parse_financial_template(xlsx_path, use_sample=True)

    assert res.use_sample is True
    # Income statement for FY2024
    is_2024 = res.income_statements["FY2024"]
    assert is_2024.revenue == 3_200_000.0
    assert is_2024.gross_profit == 1_280_000.0
    assert is_2024.ebitda == 600_000.0

    # Balance sheet for FY2024
    bs_2024 = res.balance_sheets["FY2024"]
    assert bs_2024.is_reconciled is True
    assert bs_2024.total_assets == 1_912_500.0

    # Ratios for FY2024
    ratios_2024 = res.ratios["FY2024"]
    assert ratios_2024.current_ratio.is_calculable is True
    assert ratios_2024.current_ratio.formatted == "3.52x"

    # Cash budget
    assert res.cash_budget is not None
    assert len(res.cash_budget.months) == 12

    # Tax
    assert res.tax_adjustment is not None
    assert res.tax_adjustment.calculated_tax_expense > 0

    # Debt capacity
    assert res.financial_summary is not None
    assert res.financial_summary.max_borrowing_capacity_at_target_dscr > 0
