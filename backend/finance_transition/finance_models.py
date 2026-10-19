"""Pydantic contracts for Finance + Transition deterministic engines."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class RatioValue(BaseModel):
    value: Optional[float] = None
    formatted: str
    is_calculable: bool
    status: Literal["healthy", "caution", "warning", "neutral", "not_calculable"]
    explanation: str
    formula: str


class IncomeStatement(BaseModel):
    period: str
    revenue: float
    cogs: float
    gross_profit: float
    operating_expenses: float
    ebitda: float
    depreciation_amortisation: float
    ebit: float
    finance_costs: float
    profit_before_tax: float
    income_tax_expense: float
    net_profit: float


class IncomeStatementInputs(BaseModel):
    period: str
    revenue: float
    cogs: float
    operating_expenses: float
    depreciation_amortisation: float
    finance_costs: float
    income_tax_expense: float = 0


class BalanceSheet(BaseModel):
    period: str
    cash: float
    accounts_receivable: float
    inventory: float
    other_current_assets: float
    current_assets: float
    fixed_assets_at_cost: float
    accumulated_depreciation: float
    net_fixed_assets: float
    other_assets: float
    total_assets: float
    accounts_payable: float
    short_term_debt: float
    other_current_liabilities: float
    current_liabilities: float
    long_term_debt: float
    other_liabilities: float
    total_liabilities: float
    capital: float
    retained_earnings: float
    owner_drawings: float
    other_equity: float
    total_equity: float
    total_liabilities_and_equity: float
    reconciliation_difference: float
    is_reconciled: bool


class BalanceSheetInputs(BaseModel):
    period: str
    cash: float
    accounts_receivable: float
    inventory: float
    other_current_assets: float = 0
    fixed_assets_at_cost: float
    accumulated_depreciation: float
    other_assets: float = 0
    accounts_payable: float
    short_term_debt: float
    other_current_liabilities: float = 0
    long_term_debt: float
    other_liabilities: float = 0
    capital: float
    retained_earnings: float
    owner_drawings: float = 0
    other_equity: float = 0


class CashFlowStatement(BaseModel):
    period: str
    opening_cash: float
    net_profit: float
    depreciation_add_back: float
    delta_accounts_receivable: float
    delta_inventory: float
    delta_accounts_payable: float
    other_operating_adjustments: float
    operating_cash_flow: float
    capital_expenditure: float
    asset_disposals: float
    investing_cash_flow: float
    new_borrowing: float
    principal_repayments: float
    equity_contributions: float
    drawings: float
    financing_cash_flow: float
    net_change_in_cash: float
    closing_cash: float
    balance_sheet_cash: float
    cash_reconciliation_difference: float
    is_reconciled: bool


class CashFlowInputs(BaseModel):
    period: str
    opening_cash: float
    net_profit: float
    depreciation_expense: float
    prior_accounts_receivable: float
    current_accounts_receivable: float
    prior_inventory: float
    current_inventory: float
    prior_accounts_payable: float
    current_accounts_payable: float
    other_operating_adjustments: float = 0
    capital_expenditure: float = 0
    asset_disposals: float = 0
    new_borrowing: float = 0
    principal_repayments: float = 0
    equity_contributions: float = 0
    drawings: float = 0
    balance_sheet_cash: float


class FinancialRatios(BaseModel):
    period: str
    current_ratio: RatioValue
    quick_ratio: RatioValue
    cash_ratio: RatioValue
    working_capital_value: float
    working_capital_formatted: str
    debt_to_equity_total: RatioValue
    debt_to_equity_interest_bearing: RatioValue
    debt_ratio: RatioValue
    interest_coverage: RatioValue
    equity_multiplier: RatioValue
    gross_profit_margin: RatioValue
    net_profit_margin: RatioValue
    ebitda_margin: RatioValue
    return_on_assets: RatioValue
    return_on_equity: RatioValue
    days_sales_outstanding: RatioValue
    days_inventory_outstanding: RatioValue
    days_payable_outstanding: RatioValue
    cash_conversion_cycle: RatioValue
    asset_turnover: RatioValue
    inventory_turnover: RatioValue


class CollectionSchedule(BaseModel):
    current_month_pct: float = 50
    one_month_later_pct: float = 30
    two_months_later_pct: float = 20


class CashBudgetInputs(BaseModel):
    initial_opening_cash: float
    minimum_cash_buffer: float
    monthly_sales: list[float]
    cash_sales_pct: float = 20
    collection_schedule: CollectionSchedule = Field(default_factory=CollectionSchedule)
    monthly_purchases: list[float]
    supplier_payment_current_pct: float = 60
    monthly_opex: list[float]
    monthly_tax_payments: Optional[list[float]] = None
    monthly_interest_payments: Optional[list[float]] = None
    monthly_principal_repayments: Optional[list[float]] = None
    monthly_capex: Optional[list[float]] = None
    monthly_new_borrowing: Optional[list[float]] = None
    month_labels: Optional[list[str]] = None


class CashBudgetMonth(BaseModel):
    month_index: int
    month_label: str
    opening_cash: float
    cash_sales: float
    collections_month_0: float
    collections_month_1: float
    collections_month_2: float
    total_collections: float
    other_receipts: float
    total_cash_receipts: float
    cash_purchases: float
    supplier_payments: float
    operating_expenses_paid: float
    tax_payments: float
    interest_payments: float
    principal_repayments: float
    capital_expenditure: float
    total_cash_disbursements: float
    new_borrowing: float
    net_change_in_cash: float
    closing_cash: float
    minimum_cash_buffer: float
    shortfall: float
    has_shortfall: bool


class RecommendedCashAction(BaseModel):
    action: str
    expected_cash_impact: float
    feasibility: Literal["High", "Medium", "Low"]
    timeframe: str


class CashShortfallAlert(BaseModel):
    first_shortfall_month: str
    month_index: int
    expected_closing_cash: float
    minimum_buffer: float
    shortfall_amount: float
    duration_months: int
    funding_needed_to_restore_buffer: float
    primary_drivers: list[str]
    recommended_actions: list[RecommendedCashAction]
    data_confidence_status: Literal["High", "Medium", "Low"] = "High"


class CashBudgetResult(BaseModel):
    months: list[CashBudgetMonth]
    shortfall_alert: Optional[CashShortfallAlert] = None
    minimum_closing_cash: float
    maximum_shortfall: float


class TaxInputs(BaseModel):
    tax_year: int
    entity_type: Literal["SME Company (Sdn Bhd)", "Sole Proprietorship", "Partnership"] = (
        "SME Company (Sdn Bhd)"
    )
    accounting_profit: float
    non_deductible_expenses: float = 0
    exempt_income: float = 0
    capital_allowances: float = 0
    losses_carried_forward: float = 0
    tax_installments_paid: float = 0


class TaxAdjustmentWorkflow(BaseModel):
    tax_year: int
    jurisdiction: str
    entity_type: str
    accounting_profit: float
    non_deductible_expenses: float
    exempt_income: float
    adjusted_business_income: float
    capital_allowances: float
    losses_carried_forward: float
    chargeable_income: float
    tier1_rate_pct: float
    tier2_rate_pct: float
    tier3_rate_pct: float
    calculated_tax_expense: float
    effective_tax_rate_pct: float
    tax_installments_paid: float
    estimated_balance_tax_payable: float
    notes: list[str]


class DebtCapacityInputs(BaseModel):
    ebitda: float
    existing_annual_debt_service: float
    target_dscr: float = 1.25
    indicative_interest_rate_pct: float = 4.0
    indicative_tenure_years: int = 7


class DebtCapacityResult(BaseModel):
    current_dscr: float
    available_annual_debt_service: float
    max_loan_amount: float
    assumptions: list[str]


class FinancialSummaryInputs(BaseModel):
    cash_balance: float = 0
    annual_revenue: float = 0
    annual_opex: float = 0
    annual_energy_cost: float = 0
    annual_fuel_cost: float = 0
    existing_annual_debt_service: float = 0
    min_dscr_requirement: float = 1.25
    currency: str = "MYR"


class FinancialSummary(BaseModel):
    cash_balance: float
    annual_revenue: float
    annual_opex: float
    annual_energy_cost: float
    annual_fuel_cost: float
    total_utility_cost: float
    energy_cost_pct_of_opex: float
    ebitda: float
    operating_cash_flow: float
    existing_debt_service: float
    current_dscr: float
    max_borrowing_capacity_at_target_dscr: float
    is_sufficient_data: bool
    data_completeness_notes: list[str]
    assumptions: list[str] = Field(default_factory=list)


class FinancingSimulationParams(BaseModel):
    loan_amount: float
    interest_rate_pct: float
    tenure_years: int
    subsidy_grant_pct: float = 0
    annual_opex_savings: float


class FinancingSimulationResult(BaseModel):
    loan_principal: float
    grant_subsidy_amount: float
    equity_contribution_required: float
    monthly_repayment: float
    annual_repayment: float
    total_interest_paid: float
    annual_savings: float
    net_annual_cash_flow_impact: float
    net_monthly_cash_flow_impact: float
    simple_payback_years: float
    post_intervention_dscr: float
    is_cash_flow_positive: bool
    cumulative_10_year_cash_benefit: float
    formula: str
    assumptions: list[str]


class EnergyActivityInputs(BaseModel):
    """Activity totals produced by Data + Carbon (or entered for simulation)."""

    annual_kwh: float = 0
    annual_electricity_cost: float = 0
    annual_diesel_liters: float = 0
    annual_fuel_cost: float = 0
    total_tco2e: float = 0
    grid_kg_per_kwh: float = 0.584
    diesel_kg_per_l: float = 2.6865
    grid_region: str = "Peninsular Malaysia"


class BusinessConstraints(BaseModel):
    currency: str = "MYR"
    cash_balance: float = 0
    annual_revenue: float = 0
    annual_opex: float = 0
    existing_annual_debt_service: float = 0
    min_dscr_requirement: float = 1.25
    max_capex_budget: float = 500000
    emission_reduction_target_pct: float = 15
    minimum_cash_buffer: float = 100000


class DecarbonisationAction(BaseModel):
    id: str
    title: str
    category: Literal["Renewable Energy", "Energy Efficiency", "Electrification", "Process Optimization"]
    description: str
    scope_target: str
    capex: float
    annual_energy_savings_unit: str
    annual_energy_savings_quantity: float
    annual_opex_savings: float
    annual_co2e_reduction_tons: float
    co2_reduction_pct: float
    payback_period_years: float
    ten_year_npv: float
    roi_pct: float
    marginal_abatement_cost: float
    feasibility_score: float
    recommended_priority: Literal["High", "Medium", "Low"]
    is_selected_for_plan: bool
    financing: FinancingSimulationResult
    implementation_time_months: int
    assumptions: list[str]
    regulatory_standards: list[str]


class TransitionOptionBundle(BaseModel):
    option_id: str
    label: str
    action_ids: list[str]


class OptionComparisonRow(BaseModel):
    option_id: str
    label: str
    capex: float
    annual_opex_savings: float
    annual_co2e_reduction_t: float
    co2_reduction_pct: float
    simple_payback_years: float
    npv_10y: float
    monthly_repayment: float
    net_monthly_cash: float
    post_dscr: float
    cash_shortfall: bool
    within_debt_capacity: bool
    meets_reduction_target: bool
    meets_15pct_reduction: bool = False
    within_capex_budget: bool
    affordability_status: Literal["ok", "cash_flow_pressure", "not_affordable"]
    score: float
    fail_reasons: list[str]
    assumptions: list[str]


class ScenarioCompareResult(BaseModel):
    currency: str
    ranked: list[OptionComparisonRow]
    recommended_option_id: Optional[str] = None
    scoring_formula: str
    notes: list[str]


class StatementsComputeRequest(BaseModel):
    income: IncomeStatementInputs
    balance_sheet: BalanceSheetInputs
    prior_balance_sheet: Optional[BalanceSheetInputs] = None
    cash_flow: Optional[CashFlowInputs] = None
    currency: str = "MYR"


class StatementsComputeResponse(BaseModel):
    currency: str
    income_statement: IncomeStatement
    balance_sheet: BalanceSheet
    prior_balance_sheet: Optional[BalanceSheet] = None
    cash_flow_statement: Optional[CashFlowStatement] = None
    ratios: FinancialRatios


class ScenarioSimulateRequest(BaseModel):
    financial: FinancialSummaryInputs
    energy: EnergyActivityInputs = Field(default_factory=EnergyActivityInputs)
    constraints: BusinessConstraints = Field(default_factory=BusinessConstraints)
    selected_action_ids: list[str] = Field(default_factory=list)
    custom_bundles: Optional[list[TransitionOptionBundle]] = None
    allow_stressed: bool = False
    interest_rate_pct: float = 3.75
    tenure_years: int = 7
    subsidy_grant_pct: float = 5
