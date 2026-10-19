"""Deterministic financial engines: statements, ratios, cash budget, tax, debt capacity.

Formulas are disclosed on outputs. LLM must not invent these numbers.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Literal, Optional

from finance_transition.finance_models import (
    BalanceSheet,
    BalanceSheetInputs,
    CashBudgetInputs,
    CashBudgetMonth,
    CashBudgetResult,
    CashFlowInputs,
    CashFlowStatement,
    CashShortfallAlert,
    CollectionSchedule,
    DebtCapacityInputs,
    DebtCapacityResult,
    FinancialRatios,
    FinancialSummary,
    FinancialSummaryInputs,
    IncomeStatement,
    IncomeStatementInputs,
    RatioValue,
    RecommendedCashAction,
    TaxAdjustmentWorkflow,
    TaxInputs,
)


def money(value: float, places: str = "0.01") -> float:
    return float(Decimal(str(value)).quantize(Decimal(places), rounding=ROUND_HALF_UP))


def _ratio(
    numerator: float,
    denominator: float,
    fmt: Literal["percentage", "multiple", "days"],
    metric_name: str,
    formula: str,
    healthy_min: Optional[float] = None,
    healthy_max: Optional[float] = None,
    zero_denominator_reason: str = "Zero or missing denominator",
) -> RatioValue:
    if denominator == 0 or denominator != denominator or abs(denominator) == float("inf"):
        return RatioValue(
            value=None,
            formatted="N/A",
            is_calculable=False,
            status="not_calculable",
            explanation=f"{metric_name} is not calculable: {zero_denominator_reason}.",
            formula=formula,
        )

    raw = numerator / denominator
    if raw != raw or abs(raw) == float("inf"):
        return RatioValue(
            value=None,
            formatted="N/A",
            is_calculable=False,
            status="not_calculable",
            explanation=f"{metric_name} resulted in an undefined arithmetic value.",
            formula=formula,
        )

    if fmt == "percentage":
        formatted = f"{raw * 100:.1f}%"
    elif fmt == "multiple":
        formatted = f"{raw:.2f}x"
    else:
        formatted = f"{round(raw)} days"

    status: Literal["healthy", "caution", "warning", "neutral", "not_calculable"] = "neutral"
    if healthy_min is not None or healthy_max is not None:
        if healthy_min is not None and raw < healthy_min:
            status = "warning" if raw < healthy_min * 0.7 else "caution"
        elif healthy_max is not None and raw > healthy_max:
            status = "warning" if raw > healthy_max * 1.5 else "caution"
        else:
            status = "healthy"

    return RatioValue(
        value=money(raw, "0.0001"),
        formatted=formatted,
        is_calculable=True,
        status=status,
        explanation=f"{metric_name} = {formatted} ({formula})",
        formula=formula,
    )


def calculate_operating_profit(revenue: float | None, cogs: float | None,
                               operating_expenses: float | None) -> tuple[float | None, float | None]:
    """Shared statement arithmetic, preserving unknowns and operating losses."""
    gross_profit = None if revenue is None or cogs is None else revenue - cogs
    ebitda = None if gross_profit is None or operating_expenses is None else gross_profit - operating_expenses
    return gross_profit, ebitda


def calculate_known_ratio(numerator: float | None, denominator: float | None,
                          fmt: Literal["percentage", "multiple", "days"],
                          metric_name: str, formula: str) -> RatioValue:
    """Use the statement engine's ratio rules without replacing missing inputs."""
    if numerator is None or denominator is None:
        return RatioValue(value=None, formatted="N/A", is_calculable=False,
                          status="not_calculable", explanation=f"{metric_name} requires additional inputs.",
                          formula=formula)
    return _ratio(numerator, denominator, fmt, metric_name, formula)


def calculate_income_statement(inputs: IncomeStatementInputs) -> IncomeStatement:
    revenue = max(0.0, inputs.revenue)
    cogs = max(0.0, inputs.cogs)
    operating_expenses = max(0.0, inputs.operating_expenses)
    gross_profit, ebitda = calculate_operating_profit(revenue, cogs, operating_expenses)
    depreciation = max(0.0, inputs.depreciation_amortisation)
    ebit = ebitda - depreciation
    finance_costs = max(0.0, inputs.finance_costs)
    profit_before_tax = ebit - finance_costs
    tax = max(0.0, inputs.income_tax_expense)
    net_profit = profit_before_tax - tax
    return IncomeStatement(
        period=inputs.period,
        revenue=revenue,
        cogs=cogs,
        gross_profit=gross_profit,
        operating_expenses=operating_expenses,
        ebitda=ebitda,
        depreciation_amortisation=depreciation,
        ebit=ebit,
        finance_costs=finance_costs,
        profit_before_tax=profit_before_tax,
        income_tax_expense=tax,
        net_profit=net_profit,
    )


def calculate_balance_sheet(inputs: BalanceSheetInputs) -> BalanceSheet:
    cash = inputs.cash
    ar = max(0.0, inputs.accounts_receivable)
    inventory = max(0.0, inputs.inventory)
    other_ca = max(0.0, inputs.other_current_assets)
    current_assets = cash + ar + inventory + other_ca

    fa_cost = max(0.0, inputs.fixed_assets_at_cost)
    accum_dep = max(0.0, inputs.accumulated_depreciation)
    net_fa = max(0.0, fa_cost - accum_dep)
    other_assets = max(0.0, inputs.other_assets)
    total_assets = current_assets + net_fa + other_assets

    ap = max(0.0, inputs.accounts_payable)
    std = max(0.0, inputs.short_term_debt)
    other_cl = max(0.0, inputs.other_current_liabilities)
    current_liabilities = ap + std + other_cl

    ltd = max(0.0, inputs.long_term_debt)
    other_liab = max(0.0, inputs.other_liabilities)
    total_liabilities = current_liabilities + ltd + other_liab

    capital = max(0.0, inputs.capital)
    re = inputs.retained_earnings
    drawings = max(0.0, inputs.owner_drawings)
    other_eq = inputs.other_equity
    total_equity = capital + re - drawings + other_eq

    total_l_and_e = total_liabilities + total_equity
    diff = money(total_assets - total_l_and_e)
    return BalanceSheet(
        period=inputs.period,
        cash=cash,
        accounts_receivable=ar,
        inventory=inventory,
        other_current_assets=other_ca,
        current_assets=current_assets,
        fixed_assets_at_cost=fa_cost,
        accumulated_depreciation=accum_dep,
        net_fixed_assets=net_fa,
        other_assets=other_assets,
        total_assets=total_assets,
        accounts_payable=ap,
        short_term_debt=std,
        other_current_liabilities=other_cl,
        current_liabilities=current_liabilities,
        long_term_debt=ltd,
        other_liabilities=other_liab,
        total_liabilities=total_liabilities,
        capital=capital,
        retained_earnings=re,
        owner_drawings=drawings,
        other_equity=other_eq,
        total_equity=total_equity,
        total_liabilities_and_equity=total_l_and_e,
        reconciliation_difference=diff,
        is_reconciled=abs(diff) < 0.01,
    )


def calculate_cash_flow_statement(inputs: CashFlowInputs) -> CashFlowStatement:
    dep_add_back = abs(inputs.depreciation_expense)
    delta_ar = inputs.prior_accounts_receivable - inputs.current_accounts_receivable
    delta_inv = inputs.prior_inventory - inputs.current_inventory
    delta_ap = inputs.current_accounts_payable - inputs.prior_accounts_payable
    other = inputs.other_operating_adjustments
    ocf = (
        inputs.net_profit
        + dep_add_back
        + delta_ar
        + delta_inv
        + delta_ap
        + other
    )

    capex = -abs(inputs.capital_expenditure or 0)
    disposals = max(0.0, inputs.asset_disposals)
    investing = capex + disposals

    new_borrow = max(0.0, inputs.new_borrowing)
    principal = -abs(inputs.principal_repayments or 0)
    equity = max(0.0, inputs.equity_contributions)
    drawings = -abs(inputs.drawings or 0)
    financing = new_borrow + principal + equity + drawings

    net_change = ocf + investing + financing
    closing = money(inputs.opening_cash + net_change)
    recon = money(closing - inputs.balance_sheet_cash)

    return CashFlowStatement(
        period=inputs.period,
        opening_cash=inputs.opening_cash,
        net_profit=inputs.net_profit,
        depreciation_add_back=dep_add_back,
        delta_accounts_receivable=delta_ar,
        delta_inventory=delta_inv,
        delta_accounts_payable=delta_ap,
        other_operating_adjustments=other,
        operating_cash_flow=money(ocf),
        capital_expenditure=capex,
        asset_disposals=disposals,
        investing_cash_flow=money(investing),
        new_borrowing=new_borrow,
        principal_repayments=principal,
        equity_contributions=equity,
        drawings=drawings,
        financing_cash_flow=money(financing),
        net_change_in_cash=money(net_change),
        closing_cash=closing,
        balance_sheet_cash=inputs.balance_sheet_cash,
        cash_reconciliation_difference=recon,
        is_reconciled=abs(recon) < 0.01,
    )


def calculate_financial_ratios(
    bs: BalanceSheet,
    income: IncomeStatement,
    prior_bs: Optional[BalanceSheet] = None,
    credit_sales: Optional[float] = None,
    credit_purchases: Optional[float] = None,
    days_in_period: int = 365,
) -> FinancialRatios:
    avg_assets = (prior_bs.total_assets + bs.total_assets) / 2 if prior_bs else bs.total_assets
    avg_equity = (prior_bs.total_equity + bs.total_equity) / 2 if prior_bs else bs.total_equity
    avg_ar = (prior_bs.accounts_receivable + bs.accounts_receivable) / 2 if prior_bs else bs.accounts_receivable
    avg_inv = (prior_bs.inventory + bs.inventory) / 2 if prior_bs else bs.inventory
    avg_ap = (prior_bs.accounts_payable + bs.accounts_payable) / 2 if prior_bs else bs.accounts_payable

    effective_sales = credit_sales if credit_sales is not None else income.revenue
    effective_purchases = credit_purchases if credit_purchases is not None else income.cogs * 0.85
    interest_bearing = bs.short_term_debt + bs.long_term_debt

    current_ratio = _ratio(
        bs.current_assets,
        bs.current_liabilities,
        "multiple",
        "Current Ratio",
        "Current Assets / Current Liabilities",
        healthy_min=1.2,
        healthy_max=3.0,
        zero_denominator_reason="Current liabilities are zero",
    )
    quick_ratio = _ratio(
        bs.cash + bs.accounts_receivable,
        bs.current_liabilities,
        "multiple",
        "Quick Ratio",
        "(Cash + Accounts Receivable) / Current Liabilities",
        healthy_min=1.0,
        healthy_max=2.5,
        zero_denominator_reason="Current liabilities are zero",
    )
    cash_ratio = _ratio(
        bs.cash,
        bs.current_liabilities,
        "multiple",
        "Cash Ratio",
        "Cash / Current Liabilities",
        healthy_min=0.2,
        zero_denominator_reason="Current liabilities are zero",
    )
    wc = bs.current_assets - bs.current_liabilities

    if bs.total_equity <= 0:
        dte_total = RatioValue(
            value=None,
            formatted="Negative Equity",
            is_calculable=False,
            status="warning",
            explanation="Debt-to-Equity is undefined due to zero or negative equity.",
            formula="Total Liabilities / Total Equity",
        )
        dte_ib = RatioValue(
            value=None,
            formatted="Negative Equity",
            is_calculable=False,
            status="warning",
            explanation="Interest-Bearing Debt-to-Equity is undefined due to zero or negative equity.",
            formula="(Short-Term Debt + Long-Term Debt) / Total Equity",
        )
        equity_mult = RatioValue(
            value=None,
            formatted="Undefined",
            is_calculable=False,
            status="warning",
            explanation="Equity multiplier is undefined due to zero or negative equity.",
            formula="Total Assets / Total Equity",
        )
    else:
        dte_total = _ratio(
            bs.total_liabilities,
            bs.total_equity,
            "multiple",
            "Total Debt-to-Equity",
            "Total Liabilities / Total Equity",
            healthy_max=2.5,
        )
        dte_ib = _ratio(
            interest_bearing,
            bs.total_equity,
            "multiple",
            "Bank Debt-to-Equity",
            "Interest-Bearing Debt / Total Equity",
            healthy_max=1.5,
        )
        equity_mult = _ratio(
            bs.total_assets,
            bs.total_equity,
            "multiple",
            "Equity Multiplier",
            "Total Assets / Total Equity",
        )

    debt_ratio = _ratio(
        bs.total_liabilities,
        bs.total_assets,
        "percentage",
        "Debt Ratio",
        "Total Liabilities / Total Assets",
        healthy_max=0.7,
    )
    interest_coverage = _ratio(
        income.ebitda,
        income.finance_costs,
        "multiple",
        "Interest Coverage Ratio",
        "EBITDA / Finance Costs",
        healthy_min=2.0,
        zero_denominator_reason="Finance costs are zero (unlevered)",
    )
    gpm = _ratio(
        income.gross_profit,
        income.revenue,
        "percentage",
        "Gross Profit Margin",
        "Gross Profit / Revenue",
        healthy_min=0.2,
        zero_denominator_reason="Revenue is zero",
    )
    npm = _ratio(
        income.net_profit,
        income.revenue,
        "percentage",
        "Net Profit Margin",
        "Net Profit / Revenue",
        healthy_min=0.05,
        zero_denominator_reason="Revenue is zero",
    )
    ebitda_m = _ratio(
        income.ebitda,
        income.revenue,
        "percentage",
        "EBITDA Margin",
        "EBITDA / Revenue",
        healthy_min=0.1,
        zero_denominator_reason="Revenue is zero",
    )
    roa = _ratio(
        income.net_profit,
        avg_assets,
        "percentage",
        "Return on Assets (ROA)",
        "Net Profit / Average Total Assets",
        healthy_min=0.05,
    )
    if avg_equity <= 0:
        roe = RatioValue(
            value=None,
            formatted="Undefined",
            is_calculable=False,
            status="warning",
            explanation="ROE is undefined due to zero or negative equity.",
            formula="Net Profit / Average Total Equity",
        )
    else:
        roe = _ratio(
            income.net_profit,
            avg_equity,
            "percentage",
            "Return on Equity (ROE)",
            "Net Profit / Average Total Equity",
            healthy_min=0.1,
        )

    dso = _ratio(
        avg_ar * days_in_period,
        effective_sales,
        "days",
        "Days Sales Outstanding (DSO)",
        "(Accounts Receivable × Days) / Credit Sales",
        healthy_max=90,
        zero_denominator_reason="Sales are zero",
    )
    dio = _ratio(
        avg_inv * days_in_period,
        abs(income.cogs),
        "days",
        "Days Inventory Outstanding (DIO)",
        "(Inventory × Days) / COGS",
        healthy_max=120,
        zero_denominator_reason="Cost of goods sold is zero",
    )
    dpo = _ratio(
        avg_ap * days_in_period,
        effective_purchases,
        "days",
        "Days Payable Outstanding (DPO)",
        "(Accounts Payable × Days) / Credit Purchases",
        healthy_min=30,
        healthy_max=90,
        zero_denominator_reason="Purchases are zero",
    )

    if dso.value is not None and dio.value is not None and dpo.value is not None:
        ccc_val = dso.value + dio.value - dpo.value
        ccc_status: Literal["healthy", "caution", "warning", "neutral", "not_calculable"]
        if ccc_val <= 60:
            ccc_status = "healthy"
        elif ccc_val <= 100:
            ccc_status = "caution"
        else:
            ccc_status = "warning"
        ccc = RatioValue(
            value=money(ccc_val, "0.1"),
            formatted=f"{round(ccc_val)} days",
            is_calculable=True,
            status=ccc_status,
            explanation=(
                f"Cash Conversion Cycle = {round(ccc_val)} days "
                f"(DSO {round(dso.value)} + DIO {round(dio.value)} - DPO {round(dpo.value)})"
            ),
            formula="DSO + DIO - DPO",
        )
    else:
        ccc = RatioValue(
            value=None,
            formatted="N/A",
            is_calculable=False,
            status="not_calculable",
            explanation="Cash Conversion Cycle cannot be computed without complete DSO, DIO, and DPO.",
            formula="DSO + DIO - DPO",
        )

    asset_to = _ratio(
        income.revenue,
        avg_assets,
        "multiple",
        "Asset Turnover",
        "Revenue / Average Total Assets",
        healthy_min=0.8,
    )
    inv_to = _ratio(
        abs(income.cogs),
        avg_inv,
        "multiple",
        "Inventory Turnover",
        "COGS / Average Inventory",
        healthy_min=3.0,
        zero_denominator_reason="Inventory balance is zero",
    )

    return FinancialRatios(
        period=bs.period,
        current_ratio=current_ratio,
        quick_ratio=quick_ratio,
        cash_ratio=cash_ratio,
        working_capital_value=wc,
        working_capital_formatted=f"RM {wc:,.0f}",
        debt_to_equity_total=dte_total,
        debt_to_equity_interest_bearing=dte_ib,
        debt_ratio=debt_ratio,
        interest_coverage=interest_coverage,
        equity_multiplier=equity_mult,
        gross_profit_margin=gpm,
        net_profit_margin=npm,
        ebitda_margin=ebitda_m,
        return_on_assets=roa,
        return_on_equity=roe,
        days_sales_outstanding=dso,
        days_inventory_outstanding=dio,
        days_payable_outstanding=dpo,
        cash_conversion_cycle=ccc,
        asset_turnover=asset_to,
        inventory_turnover=inv_to,
    )


def _month_value(series: Optional[list[float]], index: int) -> float:
    if not series or index >= len(series):
        return 0.0
    return series[index] or 0.0


def calculate_12_month_cash_budget(params: CashBudgetInputs) -> CashBudgetResult:
    months: list[CashBudgetMonth] = []
    buffer = max(0.0, params.minimum_cash_buffer)
    current_opening = params.initial_opening_cash
    sales = params.monthly_sales or []
    prior_sales_proxy = sales[0] if sales else 0.0
    schedule = params.collection_schedule or CollectionSchedule()

    for i in range(12):
        total_sales = _month_value(params.monthly_sales, i)
        cash_sales = total_sales * (params.cash_sales_pct / 100)
        credit_sales = total_sales * (1 - params.cash_sales_pct / 100)

        coll_m0 = credit_sales * (schedule.current_month_pct / 100)
        prev1 = (
            params.monthly_sales[i - 1] * (1 - params.cash_sales_pct / 100)
            if i >= 1
            else prior_sales_proxy * (1 - params.cash_sales_pct / 100)
        )
        coll_m1 = prev1 * (schedule.one_month_later_pct / 100)
        if i >= 2:
            prev2 = params.monthly_sales[i - 2] * (1 - params.cash_sales_pct / 100)
        elif i == 1:
            prev2 = prior_sales_proxy * (1 - params.cash_sales_pct / 100)
        else:
            prev2 = prior_sales_proxy * (1 - params.cash_sales_pct / 100)
        coll_m2 = prev2 * (schedule.two_months_later_pct / 100)

        total_collections = coll_m0 + coll_m1 + coll_m2
        total_receipts = cash_sales + total_collections

        purchases = _month_value(params.monthly_purchases, i)
        cash_purchases = purchases * 0.3
        credit_purchases = purchases * 0.7
        supplier_m0 = credit_purchases * (params.supplier_payment_current_pct / 100)
        prev_purch = (
            (_month_value(params.monthly_purchases, i - 1) * 0.7) if i >= 1 else purchases * 0.7
        )
        supplier_m1 = prev_purch * ((100 - params.supplier_payment_current_pct) / 100)
        supplier_payments = supplier_m0 + supplier_m1

        opex = _month_value(params.monthly_opex, i)
        tax = _month_value(params.monthly_tax_payments, i)
        interest = _month_value(params.monthly_interest_payments, i)
        principal = _month_value(params.monthly_principal_repayments, i)
        capex = _month_value(params.monthly_capex, i)
        disbursements = (
            cash_purchases + supplier_payments + opex + tax + interest + principal + capex
        )
        new_borrow = _month_value(params.monthly_new_borrowing, i)
        net_change = total_receipts - disbursements + new_borrow
        closing = money(current_opening + net_change)
        shortfall = max(0.0, buffer - closing)

        labels = params.month_labels
        label = labels[i] if labels and i < len(labels) else f"Month {i + 1}"

        months.append(
            CashBudgetMonth(
                month_index=i + 1,
                month_label=label,
                opening_cash=money(current_opening),
                cash_sales=money(cash_sales),
                collections_month_0=money(coll_m0),
                collections_month_1=money(coll_m1),
                collections_month_2=money(coll_m2),
                total_collections=money(total_collections),
                other_receipts=0,
                total_cash_receipts=money(total_receipts),
                cash_purchases=money(cash_purchases),
                supplier_payments=money(supplier_payments),
                operating_expenses_paid=money(opex),
                tax_payments=money(tax),
                interest_payments=money(interest),
                principal_repayments=money(principal),
                capital_expenditure=money(capex),
                total_cash_disbursements=money(disbursements),
                new_borrowing=money(new_borrow),
                net_change_in_cash=money(net_change),
                closing_cash=closing,
                minimum_cash_buffer=buffer,
                shortfall=money(shortfall),
                has_shortfall=closing < buffer,
            )
        )
        current_opening = closing

    shortfall_months = [m for m in months if m.has_shortfall]
    min_closing = min((m.closing_cash for m in months), default=0.0)
    max_shortfall = max((m.shortfall for m in months), default=0.0)
    alert = None
    if shortfall_months:
        first = shortfall_months[0]
        alert = CashShortfallAlert(
            first_shortfall_month=first.month_label,
            month_index=first.month_index,
            expected_closing_cash=first.closing_cash,
            minimum_buffer=buffer,
            shortfall_amount=first.shortfall,
            duration_months=len(shortfall_months),
            funding_needed_to_restore_buffer=max_shortfall,
            primary_drivers=[
                "Delayed customer collections from credit terms (collection lag).",
                "Scheduled loan principal amortization commitments.",
                "High fixed operating expenditure and utility bill disbursements.",
            ],
            recommended_actions=[
                RecommendedCashAction(
                    action="Accelerate receivables collection (offer 2% prompt settlement discount)",
                    expected_cash_impact=round(max_shortfall * 0.4),
                    feasibility="High",
                    timeframe="Immediate (15-30 days)",
                ),
                RecommendedCashAction(
                    action="Negotiate 15-day supplier credit extension on bulk raw material orders",
                    expected_cash_impact=round(max_shortfall * 0.35),
                    feasibility="High",
                    timeframe="Next 30 days",
                ),
                RecommendedCashAction(
                    action="Apply for BNM Low Carbon Transition Facility (LCTF) working capital line",
                    expected_cash_impact=round(max_shortfall),
                    feasibility="Medium",
                    timeframe="45-60 days",
                ),
            ],
        )

    return CashBudgetResult(
        months=months,
        shortfall_alert=alert,
        minimum_closing_cash=min_closing,
        maximum_shortfall=max_shortfall,
    )


def calculate_malaysian_sme_tax(inputs: TaxInputs) -> TaxAdjustmentWorkflow:
    entity = inputs.entity_type
    accounting_profit = inputs.accounting_profit
    non_deductible = max(0.0, inputs.non_deductible_expenses)
    exempt = max(0.0, inputs.exempt_income)
    adjusted = max(0.0, accounting_profit + non_deductible - exempt)
    capital_allowances = max(0.0, inputs.capital_allowances)
    losses = max(0.0, inputs.losses_carried_forward)
    chargeable = max(0.0, adjusted - capital_allowances - losses)

    t1, t2, t3 = 15.0, 17.0, 24.0
    if entity == "SME Company (Sdn Bhd)":
        if chargeable <= 150000:
            tax = chargeable * (t1 / 100)
        elif chargeable <= 600000:
            tax = 150000 * (t1 / 100) + (chargeable - 150000) * (t2 / 100)
        else:
            tax = (
                150000 * (t1 / 100)
                + 450000 * (t2 / 100)
                + (chargeable - 600000) * (t3 / 100)
            )
    else:
        tax = chargeable * 0.24

    etr = money((tax / chargeable) * 100) if chargeable > 0 else 0.0
    paid = max(0.0, inputs.tax_installments_paid)
    return TaxAdjustmentWorkflow(
        tax_year=inputs.tax_year,
        jurisdiction="Malaysia (Inland Revenue Board / LHDN)",
        entity_type=entity,
        accounting_profit=accounting_profit,
        non_deductible_expenses=non_deductible,
        exempt_income=exempt,
        adjusted_business_income=adjusted,
        capital_allowances=capital_allowances,
        losses_carried_forward=losses,
        chargeable_income=chargeable,
        tier1_rate_pct=t1,
        tier2_rate_pct=t2,
        tier3_rate_pct=t3,
        calculated_tax_expense=money(tax),
        effective_tax_rate_pct=etr,
        tax_installments_paid=paid,
        estimated_balance_tax_payable=money(tax - paid),
        notes=[
            "Calculated under Malaysian Income Tax Act 1967 (SME preferential rates on qualifying paid-up capital ≤ RM 2.5 million).",
            "Statutory Capital Allowances substitute accounting depreciation for tax relief.",
            "Indicative decision-support estimate only; not a Form C filing.",
        ],
    )


def calculate_debt_capacity(inputs: DebtCapacityInputs) -> DebtCapacityResult:
    existing = inputs.existing_annual_debt_service
    current_dscr = money(inputs.ebitda / existing) if existing > 0 else 50.0
    if current_dscr > 50:
        current_dscr = 50.0

    max_ads = inputs.ebitda / inputs.target_dscr if inputs.ebitda > 0 else 0.0
    available = max(0.0, max_ads - existing)

    r = inputs.indicative_interest_rate_pct / 100
    n = inputs.indicative_tenure_years
    max_loan = 0.0
    if r > 0 and available > 0:
        max_loan = available * ((1 - (1 + r) ** (-n)) / r)

    return DebtCapacityResult(
        current_dscr=current_dscr,
        available_annual_debt_service=money(available),
        max_loan_amount=round(max_loan),
        assumptions=[
            f"Minimum DSCR covenant enforced at {inputs.target_dscr}x.",
            f"Indicative concessionary green lending rate modeled at {inputs.indicative_interest_rate_pct}% per annum.",
            f"Standard green asset amortization term modeled at {n} years.",
            "Indicative mathematical capacity only — not a credit approval.",
            "Max loan = PV of available annual debt service: PMT × [1 − (1+r)^−n] / r.",
        ],
    )


def get_financial_summary(inputs: FinancialSummaryInputs) -> FinancialSummary:
    energy = inputs.annual_energy_cost
    fuel = inputs.annual_fuel_cost
    utility = energy + fuel
    revenue = inputs.annual_revenue
    opex = inputs.annual_opex
    ebitda = max(0.0, revenue - opex)
    ocf = max(0.0, revenue - (opex - utility) - (utility * 1.05))
    energy_pct = money((utility / opex) * 100) if opex > 0 else 0.0
    capacity = calculate_debt_capacity(
        DebtCapacityInputs(
            ebitda=ebitda,
            existing_annual_debt_service=inputs.existing_annual_debt_service,
            target_dscr=inputs.min_dscr_requirement,
        )
    )
    notes: list[str] = []
    if revenue == 0:
        notes.append("Annual revenue not recorded.")
    if opex == 0:
        notes.append("Operating expenses not specified.")
    if utility == 0:
        notes.append("No electricity or fuel cost figures provided by Data + Carbon.")
    if inputs.existing_annual_debt_service == 0:
        notes.append("Existing debt service declared as RM 0. Confirm if facilities exist.")

    return FinancialSummary(
        cash_balance=inputs.cash_balance,
        annual_revenue=revenue,
        annual_opex=opex,
        annual_energy_cost=money(energy),
        annual_fuel_cost=money(fuel),
        total_utility_cost=money(utility),
        energy_cost_pct_of_opex=energy_pct,
        ebitda=money(ebitda),
        operating_cash_flow=money(ocf),
        existing_debt_service=inputs.existing_annual_debt_service,
        current_dscr=capacity.current_dscr,
        max_borrowing_capacity_at_target_dscr=capacity.max_loan_amount,
        is_sufficient_data=revenue > 0 and opex > 0 and utility > 0,
        data_completeness_notes=notes,
        assumptions=capacity.assumptions,
    )


def currencies_compatible(a: str, b: str) -> bool:
    return (a or "").upper() == (b or "").upper()


def get_standard_sme_financial_model() -> dict:
    """Hackathon sample: precision manufacturing SME FY2024 (MYR)."""
    period = "FY2024"
    income = calculate_income_statement(
        IncomeStatementInputs(
            period=period,
            revenue=3_200_000,
            cogs=1_920_000,
            operating_expenses=680_000,
            depreciation_amortisation=95_000,
            finance_costs=32_000,
            income_tax_expense=80_500,
        )
    )
    prior_bs = calculate_balance_sheet(
        BalanceSheetInputs(
            period="FY2023",
            cash=240_000,
            accounts_receivable=410_000,
            inventory=280_000,
            other_current_assets=25_000,
            fixed_assets_at_cost=1_100_000,
            accumulated_depreciation=320_000,
            accounts_payable=215_000,
            short_term_debt=65_000,
            long_term_debt=320_000,
            capital=500_000,
            retained_earnings=635_000,
        )
    )
    bs = calculate_balance_sheet(
        BalanceSheetInputs(
            period=period,
            cash=312_500,
            accounts_receivable=460_000,
            inventory=310_000,
            other_current_assets=25_000,
            fixed_assets_at_cost=1_220_000,
            accumulated_depreciation=415_000,
            accounts_payable=245_000,
            short_term_debt=70_000,
            long_term_debt=275_000,
            capital=500_000,
            retained_earnings=927_500,
            owner_drawings=105_000,
        )
    )
    cfs = calculate_cash_flow_statement(
        CashFlowInputs(
            period=period,
            opening_cash=prior_bs.cash,
            net_profit=income.net_profit,
            depreciation_expense=income.depreciation_amortisation,
            prior_accounts_receivable=prior_bs.accounts_receivable,
            current_accounts_receivable=bs.accounts_receivable,
            prior_inventory=prior_bs.inventory,
            current_inventory=bs.inventory,
            prior_accounts_payable=prior_bs.accounts_payable,
            current_accounts_payable=bs.accounts_payable,
            capital_expenditure=220_000,
            new_borrowing=5_000,
            principal_repayments=45_000,
            drawings=105_000,
            balance_sheet_cash=bs.cash,
        )
    )
    ratios = calculate_financial_ratios(bs, income, prior_bs)
    monthly_sales = [
        250000, 260000, 240000, 270000, 280000, 290000,
        275000, 265000, 285000, 300000, 310000, 320000,
    ]
    budget = calculate_12_month_cash_budget(
        CashBudgetInputs(
            initial_opening_cash=bs.cash,
            minimum_cash_buffer=100_000,
            monthly_sales=monthly_sales,
            cash_sales_pct=20,
            collection_schedule=CollectionSchedule(
                current_month_pct=50, one_month_later_pct=30, two_months_later_pct=20
            ),
            monthly_purchases=[s * 0.58 for s in monthly_sales],
            supplier_payment_current_pct=60,
            monthly_opex=[56000] * 12,
            monthly_principal_repayments=[4500] * 12,
            monthly_interest_payments=[2500] * 12,
            month_labels=[
                "Jan 2025", "Feb 2025", "Mar 2025", "Apr 2025", "May 2025", "Jun 2025",
                "Jul 2025", "Aug 2025", "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025",
            ],
        )
    )
    tax = calculate_malaysian_sme_tax(
        TaxInputs(
            tax_year=2024,
            accounting_profit=income.profit_before_tax,
            non_deductible_expenses=35_000,
            exempt_income=5_000,
            capital_allowances=85_000,
            tax_installments_paid=60_000,
        )
    )
    summary = get_financial_summary(
        FinancialSummaryInputs(
            cash_balance=bs.cash,
            annual_revenue=income.revenue,
            annual_opex=income.cogs + income.operating_expenses,
            annual_energy_cost=96_000,
            annual_fuel_cost=55_000,
            existing_annual_debt_service=income.finance_costs + 45_000,
        )
    )
    return {
        "income_statement": income,
        "balance_sheet": bs,
        "prior_balance_sheet": prior_bs,
        "cash_flow_statement": cfs,
        "ratios": ratios,
        "cash_budget": budget,
        "tax": tax,
        "summary": summary,
    }
