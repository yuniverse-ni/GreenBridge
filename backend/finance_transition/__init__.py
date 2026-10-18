"""Finance + Transition: deterministic cash, debt, CAPEX and option comparison."""

from finance_transition.audit import AuditRecord, compute_inputs_hash, create_audit_record
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
    money,
)
from finance_transition.template_reader import (
    ParsedTemplateResult,
    parse_financial_template,
)
from finance_transition.transition_service import (
    calculate_annual_cash_flow_path,
    calculate_npv,
    compare_transition_options,
    generate_decarbonisation_actions,
    simulate_financing,
)

__all__ = [
    "calculate_income_statement",
    "calculate_balance_sheet",
    "calculate_cash_flow_statement",
    "calculate_financial_ratios",
    "calculate_12_month_cash_budget",
    "calculate_malaysian_sme_tax",
    "calculate_debt_capacity",
    "get_financial_summary",
    "get_standard_sme_financial_model",
    "simulate_financing",
    "generate_decarbonisation_actions",
    "compare_transition_options",
    "calculate_annual_cash_flow_path",
    "calculate_npv",
    "currencies_compatible",
    "parse_financial_template",
    "ParsedTemplateResult",
    "create_audit_record",
    "compute_inputs_hash",
    "AuditRecord",
    "money",
]
