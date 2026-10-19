"""Authoritative intake-to-finance adapter. No sample, tariff or forecast paths."""

from backend.agent.models import AnalysisRequest, FinanceResult, FinancialToolResult
from backend.data.intake.models import DataIntakeResult
from backend.finance_transition.finance_service import calculate_known_ratio, calculate_operating_profit


def analyse_intake_finance(intake: DataIntakeResult) -> FinancialToolResult:
    readiness = intake.readiness["financial_analysis"]
    if (intake.agent_next_action != "PROCEED" or intake.normalized_data is None
            or not readiness.may_proceed or not intake.company.company_id
            or intake.company.reporting_year is None):
        return FinancialToolResult(missing_context=[
            "Complete Data Intake and resolve or explicitly accept financial evidence limitations before analysis."])

    dataset = intake.normalized_data
    supplied = dataset.financial.model_copy(deep=True)
    if all(value is None for value in supplied.model_dump().values()):
        return FinancialToolResult(missing_context=["SERVICE_UNAVAILABLE:financial: no supplied financial values"])

    gross_profit, ebitda = calculate_operating_profit(supplied.revenue, supplied.cogs, supplied.operating_expenses)
    ratios = {
        "gross_profit_margin": (gross_profit, supplied.revenue, "percentage", "Gross profit margin", "(Revenue - COGS) / Revenue"),
        "ebitda_margin": (ebitda, supplied.revenue, "percentage", "EBITDA margin", "(Revenue - COGS - Operating expenses) / Revenue"),
        "cash_ratio": (supplied.cash_balance, supplied.current_liabilities, "multiple", "Cash ratio", "Cash balance / Current liabilities"),
        "ebitda_debt_service_coverage": (ebitda, supplied.annual_debt_service, "multiple", "EBITDA debt-service coverage", "EBITDA / Annual debt service"),
        "debt_to_ebitda": (supplied.total_debt, ebitda if ebitda is not None and ebitda > 0 else None,
                           "multiple", "Debt / EBITDA", "Total debt / Positive EBITDA"),
    }
    metrics = {name: calculate_known_ratio(*args).model_dump() for name, args in ratios.items()}
    limitations = [gap.message for gap in intake.data_gaps]
    limitations.extend([
        "EBITDA debt-service coverage is a screening ratio, not CFADS-based DSCR. Reported operating cash flow is not substituted for CFADS.",
        "CFADS, loan capacity, complete statements, tax and cash forecasts require additional sourced inputs and are unavailable.",
    ])
    for field, value in supplied.model_dump().items():
        if value is None:
            limitations.append(f"{field} was not supplied; dependent metrics remain unavailable.")
    return FinancialToolResult(data=FinanceResult(
        company_id=intake.company.company_id, reporting_year=intake.company.reporting_year,
        source="backend.finance_transition.finance_service:intake-finance/v1",
        inputs=supplied, gross_profit=gross_profit, ebitda=ebitda,
        cash_above_reserve=(None if supplied.cash_balance is None or supplied.minimum_cash_reserve is None
                            else supplied.cash_balance - supplied.minimum_cash_reserve),
        metrics=metrics, cash_balance=supplied.cash_balance, capex_budget=supplied.capex_budget,
        minimum_cash_reserve=supplied.minimum_cash_reserve,
        existing_annual_debt_service=supplied.annual_debt_service,
        annual_cash_available_for_debt_service=None, minimum_dscr=None,
        financial_provenance={key: value for key, value in dataset.provenance.items() if key in type(supplied).model_fields},
        evidence=[item for item in intake.evidence if item.field in type(supplied).model_fields],
        readiness=readiness.model_copy(deep=True),
        evidence_limitations=list(dict.fromkeys(limitations)),
    ))


def financial_analysis(request: AnalysisRequest) -> FinancialToolResult:
    """Stable AnalysisServices provider; objectives cannot alter financial facts."""
    return analyse_intake_finance(request.intake)
