"""HTTP API for Finance + Transition engines. No LLM calls."""

from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from finance_transition.audit import create_audit_record
from finance_transition.finance_models import (
    BalanceSheetInputs,
    CashBudgetInputs,
    CashFlowInputs,
    DebtCapacityInputs,
    EnergyActivityInputs,
    FinancialSummaryInputs,
    FinancingSimulationParams,
    IncomeStatementInputs,
    ScenarioSimulateRequest,
    StatementsComputeRequest,
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
    currencies_compatible,
    get_financial_summary,
    get_standard_sme_financial_model,
)
from finance_transition.template_reader import ParsedTemplateResult, parse_financial_template
from finance_transition.transition_service import (
    calculate_annual_cash_flow_path,
    compare_transition_options,
    generate_decarbonisation_actions,
    simulate_financing,
)
from shared.schemas import CanonicalSMEDataPayload

router = APIRouter(tags=["finance-transition"])


class TemplateParseRequest(BaseModel):
    file_path: Optional[str] = None
    use_sample: bool = False
    override_currency: Optional[str] = None


@router.get("/sample")
def sample_model():
    model = get_standard_sme_financial_model()
    audit = create_audit_record(
        tool="get_standard_sme_financial_model",
        inputs={"sample": "precision_mfg_sme_2024"},
        formulas=["standard Malaysian SME precision manufacturing baseline"],
    )
    return {"success": True, "currency": "MYR", "model": model, "audit": audit}


@router.post("/statements/compute")
def compute_statements(payload: StatementsComputeRequest):
    if payload.currency and payload.currency.upper() != "MYR":
        raise HTTPException(
            status_code=400,
            detail=(
                f"Multi-Currency Consistency Enforcement: Currency '{payload.currency}' "
                "is not supported without an explicit foreign exchange conversion rule (Test J). "
                "Expected 'MYR'."
            ),
        )
    income = calculate_income_statement(payload.income)
    bs = calculate_balance_sheet(payload.balance_sheet)
    prior = (
        calculate_balance_sheet(payload.prior_balance_sheet)
        if payload.prior_balance_sheet
        else None
    )
    cfs = calculate_cash_flow_statement(payload.cash_flow) if payload.cash_flow else None
    ratios = calculate_financial_ratios(bs, income, prior)

    audit = create_audit_record(
        tool="compute_statements",
        inputs=payload,
        formulas=[
            "GP = Rev - COGS",
            "EBITDA = GP - OpEx",
            "EBIT = EBITDA - D&A",
            "PBT = EBIT - Finance Costs",
            "NP = PBT - Tax",
            "Total Assets = Current Assets + Net Fixed Assets + Other Assets",
            "A = TL + E check",
            "OCF = NP + D&A + Delta AR + Delta Inv + Delta AP",
            "Closing Cash = Opening + OCF + Investing + Financing",
        ],
    )
    return {
        "success": True,
        "currency": payload.currency,
        "income_statement": income,
        "balance_sheet": bs,
        "prior_balance_sheet": prior,
        "cash_flow_statement": cfs,
        "ratios": ratios,
        "audit": audit,
    }


@router.post("/statements/from-template", response_model=ParsedTemplateResult)
def statements_from_template(payload: Optional[TemplateParseRequest] = None):
    """Parses File 1 - Financial Data Input Template.xlsx reading only green cells."""
    req = payload or TemplateParseRequest()
    target_path = req.file_path
    if not target_path:
        # Default to the template in the finance_transition folder
        current_dir = os.path.dirname(os.path.abspath(__file__))
        target_path = os.path.join(current_dir, "File 1 - Financial Data Input Template.xlsx")

    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail=f"Template file not found at: {target_path}")

    try:
        result = parse_financial_template(
            target_path,
            use_sample=req.use_sample,
            override_currency=req.override_currency,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/statements/upload-template", response_model=ParsedTemplateResult)
async def upload_template(
    file: UploadFile = File(...),
    use_sample: bool = Query(False),
):
    """Direct file upload endpoint for File 1 - Financial Data Input Template.xlsx."""
    content = await file.read()
    try:
        return parse_financial_template(content, use_sample=use_sample)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/statements/from-canonical")
def statements_from_canonical(payload: CanonicalSMEDataPayload):
    """Accepts Part 1 canonical data payload and computes balanced statements, ratios, CFS, budget, tax, and debt capacity."""
    if payload.currency and payload.currency.upper() != "MYR":
        raise HTTPException(
            status_code=400,
            detail=(
                f"Multi-Currency Consistency Enforcement: Currency '{payload.currency}' "
                "is not supported without an explicit foreign exchange rule (Test J). Expected 'MYR'."
            ),
        )

    income_statements: dict[str, IncomeStatement] = {}
    balance_sheets: dict[str, BalanceSheet] = {}
    cash_flow_statements: dict[str, CashFlowStatement] = {}
    ratios_dict: dict[str, FinancialRatios] = {}

    for p in payload.periods:
        is_in = payload.income_statement_inputs.get(p)
        if is_in:
            opex_total = sum(is_in.opex_lines.values())
            is_obj = calculate_income_statement(
                IncomeStatementInputs(
                    period=p,
                    revenue=is_in.revenue,
                    cogs=is_in.cogs,
                    operating_expenses=opex_total,
                    depreciation_amortisation=is_in.da,
                    finance_costs=is_in.finance_costs,
                    income_tax_expense=is_in.income_tax_expense,
                )
            )
            income_statements[p] = is_obj

        bs_in = payload.balance_sheet_inputs.get(p)
        if bs_in:
            bs_obj = calculate_balance_sheet(
                BalanceSheetInputs(
                    period=p,
                    cash=bs_in.cash,
                    accounts_receivable=bs_in.ar,
                    inventory=bs_in.inventory,
                    other_current_assets=bs_in.other_current_assets,
                    fixed_assets_at_cost=bs_in.fixed_assets_at_cost,
                    accumulated_depreciation=bs_in.accumulated_depreciation,
                    other_assets=bs_in.other_assets,
                    accounts_payable=bs_in.ap,
                    short_term_debt=bs_in.short_term_debt,
                    long_term_debt=bs_in.long_term_debt,
                    capital=bs_in.capital,
                    retained_earnings=bs_in.retained_earnings,
                    owner_drawings=bs_in.drawings,
                )
            )
            balance_sheets[p] = bs_obj

    for idx, curr_p in enumerate(payload.periods):
        prior_p = payload.periods[idx - 1] if idx > 0 else None
        curr_is = income_statements.get(curr_p)
        curr_bs = balance_sheets.get(curr_p)
        prior_bs = balance_sheets.get(prior_p) if prior_p else None

        if curr_is and curr_bs:
            ratios_dict[curr_p] = calculate_financial_ratios(curr_bs, curr_is, prior_bs)
            if prior_bs:
                capex = max(0.0, curr_bs.fixed_assets_at_cost - prior_bs.fixed_assets_at_cost)
                principal = max(
                    0.0,
                    (prior_bs.long_term_debt + prior_bs.short_term_debt)
                    - (curr_bs.long_term_debt + curr_bs.short_term_debt),
                )
                cfs_obj = calculate_cash_flow_statement(
                    CashFlowInputs(
                        period=curr_p,
                        opening_cash=prior_bs.cash,
                        net_profit=curr_is.net_profit,
                        depreciation_expense=curr_is.depreciation_amortisation,
                        prior_accounts_receivable=prior_bs.accounts_receivable,
                        current_accounts_receivable=curr_bs.accounts_receivable,
                        prior_inventory=prior_bs.inventory,
                        current_inventory=curr_bs.inventory,
                        prior_accounts_payable=prior_bs.accounts_payable,
                        current_accounts_payable=curr_bs.accounts_payable,
                        capital_expenditure=capex,
                        principal_repayments=principal,
                        drawings=curr_bs.owner_drawings,
                        balance_sheet_cash=curr_bs.cash,
                    )
                )
                cash_flow_statements[curr_p] = cfs_obj

    budget_res = None
    if payload.cash_budget_inputs:
        cb = payload.cash_budget_inputs
        sales_series = [
            (cb.cash_sales[i] if i < len(cb.cash_sales) else 0)
            + (cb.credit_sales[i] if i < len(cb.credit_sales) else 0)
            for i in range(12)
        ]
        purchases_series = [
            (cb.cash_purchases[i] if i < len(cb.cash_purchases) else 0)
            + (cb.credit_purchases[i] if i < len(cb.credit_purchases) else 0)
            for i in range(12)
        ]
        init_cash = (
            cb.opening_cash_m1
            if cb.opening_cash_m1 is not None
            else list(balance_sheets.values())[-1].cash
            if balance_sheets
            else 100_000
        )
        budget_res = calculate_12_month_cash_budget(
            CashBudgetInputs(
                initial_opening_cash=init_cash,
                minimum_cash_buffer=100_000,
                monthly_sales=sales_series,
                cash_sales_pct=20,
                collection_schedule=CollectionSchedule(
                    current_month_pct=50, one_month_later_pct=30, two_months_later_pct=20
                ),
                monthly_purchases=purchases_series,
                supplier_payment_current_pct=60,
                monthly_opex=cb.opex[:12] if cb.opex else [0] * 12,
            )
        )

    latest_is = list(income_statements.values())[-1] if income_statements else None
    tax_res = (
        calculate_malaysian_sme_tax(
            TaxInputs(tax_year=2024, accounting_profit=latest_is.profit_before_tax)
        )
        if latest_is
        else None
    )

    latest_bs = list(balance_sheets.values())[-1] if balance_sheets else None
    summary_res = None
    if latest_is and latest_bs:
        summary_res = get_financial_summary(
            FinancialSummaryInputs(
                cash_balance=latest_bs.cash,
                annual_revenue=latest_is.revenue,
                annual_opex=latest_is.cogs + latest_is.operating_expenses,
                annual_energy_cost=payload.energy.annual_electricity_cost,
                annual_fuel_cost=payload.energy.annual_fuel_cost,
                existing_annual_debt_service=latest_is.finance_costs,
                currency=payload.currency,
            )
        )

    audit = create_audit_record(
        tool="statements_from_canonical",
        inputs=payload,
        formulas=["canonical Part 1 -> Part 2 deterministic ingestion"],
        assumptions=[f"Periods processed: {', '.join(payload.periods)}"],
    )

    return {
        "success": True,
        "currency": payload.currency,
        "income_statements": income_statements,
        "balance_sheets": balance_sheets,
        "cash_flow_statements": cash_flow_statements,
        "ratios": ratios_dict,
        "cash_budget": budget_res,
        "tax_adjustment": tax_res,
        "financial_summary": summary_res,
        "audit": audit,
    }


@router.post("/income-statement")
def income_statement(payload: IncomeStatementInputs):
    return calculate_income_statement(payload)


@router.post("/balance-sheet")
def balance_sheet(payload: BalanceSheetInputs):
    return calculate_balance_sheet(payload)


@router.post("/cash-flow")
def cash_flow(payload: CashFlowInputs):
    return calculate_cash_flow_statement(payload)


@router.post("/ratios")
def ratios(payload: StatementsComputeRequest):
    income = calculate_income_statement(payload.income)
    bs = calculate_balance_sheet(payload.balance_sheet)
    prior = (
        calculate_balance_sheet(payload.prior_balance_sheet)
        if payload.prior_balance_sheet
        else None
    )
    return calculate_financial_ratios(bs, income, prior)


@router.post("/cash-budget")
def cash_budget(payload: CashBudgetInputs):
    return calculate_12_month_cash_budget(payload)


@router.post("/tax/sme-my")
def tax_sme(payload: TaxInputs):
    return calculate_malaysian_sme_tax(payload)


@router.post("/summary")
def summary(payload: FinancialSummaryInputs):
    return get_financial_summary(payload)


@router.post("/debt-capacity")
def debt_capacity(payload: DebtCapacityInputs):
    return calculate_debt_capacity(payload)


@router.post("/financing/simulate")
def financing(payload: FinancingSimulationParams):
    return simulate_financing(payload)


@router.post("/cash-flow/path")
def cash_flow_path(
    current_annual_revenue: float,
    current_annual_opex: float,
    annual_energy_savings: float,
    annual_loan_repayment: float,
    initial_equity_outlay: float,
    years: int = 7,
):
    return {
        "path": calculate_annual_cash_flow_path(
            current_annual_revenue,
            current_annual_opex,
            annual_energy_savings,
            annual_loan_repayment,
            initial_equity_outlay,
            years,
        )
    }


@router.post("/actions/generate")
def actions(payload: ScenarioSimulateRequest):
    summary_out = get_financial_summary(payload.financial)
    return {
        "actions": generate_decarbonisation_actions(payload.energy, summary_out),
        "summary": summary_out,
    }


@router.post("/options/compare")
def compare(payload: ScenarioSimulateRequest):
    if payload.financial.currency and payload.constraints.currency:
        if not currencies_compatible(payload.financial.currency, payload.constraints.currency):
            raise HTTPException(
                status_code=400,
                detail="Currency mismatch: refuse aggregation without an explicit FX rule.",
            )
    result = compare_transition_options(
        payload.financial,
        payload.energy,
        payload.constraints,
        payload.custom_bundles,
        payload.allow_stressed,
    )
    audit = create_audit_record(
        tool="compare_transition_options",
        inputs=payload,
        formulas=[result.scoring_formula],
        assumptions=[f"Recommended Option: {result.recommended_option_id}"],
    )
    return {
        "success": True,
        "result": result,
        "audit": audit,
    }


@router.post("/scenarios/simulate")
def simulate_scenario(payload: ScenarioSimulateRequest):
    """One-shot tool for Part 3 agent: summary + action catalog + ranked bundles."""
    summary_out = get_financial_summary(payload.financial)
    actions_out = generate_decarbonisation_actions(payload.energy, summary_out)
    comparison = compare_transition_options(
        payload.financial,
        payload.energy,
        payload.constraints,
        payload.custom_bundles,
        payload.allow_stressed,
    )
    audit = create_audit_record(
        tool="simulate_transition_scenario",
        inputs=payload,
        formulas=[comparison.scoring_formula],
        assumptions=[
            f"Recommended Option: {comparison.recommended_option_id}",
            f"Actions Generated: {len(actions_out)}",
        ],
    )
    return {
        "success": True,
        "summary": summary_out,
        "actions": actions_out,
        "comparison": comparison,
        "audit": audit,
    }
