"""Service-facing tool contracts for the GreenBridge AI agent.

TEMPORARY MOCK IMPLEMENTATIONS: these functions do not read uploaded records,
call teammate services, or determine actual lending eligibility. Replace each
function's mock implementation with a service call while preserving its inputs
and response contract. All responses are JSON-serializable dictionaries.
"""

from math import expm1, isfinite, log1p
from typing import List, Literal

from typing_extensions import TypedDict


class MockMetadata(TypedDict):
    is_mock: Literal[True]
    source: Literal["temporary_agent_mock"]
    notice: str


class CarbonAnalysis(TypedDict):
    company_id: str
    reporting_year: int
    scope_1_tco2e: float
    scope_2_tco2e: float
    scope_3_tco2e: None
    total_tco2e: float
    included_scopes: List[str]
    assumptions: List[str]
    metadata: MockMetadata


class FinancialAnalysis(TypedDict):
    company_id: str
    reporting_year: int
    currency: Literal["MYR"]
    annual_revenue: float
    annual_operating_expenses: float
    ebitda: float
    cash_balance: float
    existing_annual_debt_service: float
    current_dscr: float
    max_capex_budget: float
    assumptions: List[str]
    metadata: MockMetadata


class TransitionScenario(TypedDict):
    scenario_id: str
    name: str
    scope_target: str
    capex: float
    annual_savings: float
    annual_emissions_reduction_tco2e: float
    assumptions: List[str]


class TransitionScenarios(TypedDict):
    company_id: str
    reporting_year: int
    currency: Literal["MYR"]
    scenarios: List[TransitionScenario]
    metadata: MockMetadata


class FinancingSimulation(TypedDict):
    currency: Literal["MYR"]
    loan_amount: float
    annual_interest_rate_pct: float
    tenure_years: int
    annual_savings: float
    monthly_repayment: float
    annual_debt_service: float
    total_repayment: float
    total_interest: float
    net_annual_cash_flow: float
    assumptions: List[str]
    metadata: MockMetadata


def _mock_metadata() -> MockMetadata:
    return {
        "is_mock": True,
        "source": "temporary_agent_mock",
        "notice": (
            "TEMPORARY MOCK: illustrative output only; not based on company "
            "uploads, verified service analysis, or lender terms."
        ),
    }


def _validate_company_period(company_id: str, reporting_year: int) -> None:
    if not isinstance(company_id, str) or not company_id.strip():
        raise ValueError("company_id must be a non-empty string")
    if type(reporting_year) is not int or not 1900 <= reporting_year <= 9999:
        raise ValueError("reporting_year must be an integer between 1900 and 9999")


def get_carbon_analysis(company_id: str, reporting_year: int) -> CarbonAnalysis:
    """Return annual emissions in tonnes CO2e for a company.

    TEMPORARY MOCK: replace with carbon.carbon_service analysis. Every company
    receives the same illustrative figures; Scope 3 is unavailable, not zero.
    """
    _validate_company_period(company_id, reporting_year)
    return {
        "company_id": company_id,
        "reporting_year": reporting_year,
        "scope_1_tco2e": 82.0,
        "scope_2_tco2e": 133.0,
        "scope_3_tco2e": None,
        "total_tco2e": 215.0,
        "included_scopes": ["Scope 1", "Scope 2"],
        "assumptions": [
            "Fixed demonstration values; no activity records were retrieved.",
            "Total includes Scope 1 and Scope 2 only; Scope 3 is not assessed.",
        ],
        "metadata": _mock_metadata(),
    }


def get_financial_analysis(company_id: str, reporting_year: int) -> FinancialAnalysis:
    """Return annual financial metrics, with monetary amounts in MYR.

    TEMPORARY MOCK: replace with finance_transition.finance_service analysis.
    DSCR means EBITDA divided by existing annual debt service in this fixture.
    """
    _validate_company_period(company_id, reporting_year)
    return {
        "company_id": company_id,
        "reporting_year": reporting_year,
        "currency": "MYR",
        "annual_revenue": 4850000.0,
        "annual_operating_expenses": 3950000.0,
        "ebitda": 900000.0,
        "cash_balance": 420000.0,
        "existing_annual_debt_service": 120000.0,
        "current_dscr": 7.5,
        "max_capex_budget": 600000.0,
        "assumptions": [
            "Fixed demonstration values; no financial records were retrieved.",
            "Operating expenses exclude depreciation, interest, and tax.",
        ],
        "metadata": _mock_metadata(),
    }


def get_transition_scenarios(company_id: str, reporting_year: int) -> TransitionScenarios:
    """Return independent candidate actions with MYR costs and annual impacts.

    TEMPORARY MOCK: replace with finance_transition.transition_service scenarios.
    Candidates are alternatives for review; combined savings are not validated.
    """
    _validate_company_period(company_id, reporting_year)
    return {
        "company_id": company_id,
        "reporting_year": reporting_year,
        "currency": "MYR",
        "scenarios": [
            {
                "scenario_id": "MOCK-SOLAR-01",
                "name": "Rooftop solar installation",
                "scope_target": "Scope 2",
                "capex": 240000.0,
                "annual_savings": 48000.0,
                "annual_emissions_reduction_tco2e": 55.0,
                "assumptions": ["Illustrative sizing; roof suitability is unverified."],
            },
            {
                "scenario_id": "MOCK-LED-02",
                "name": "LED lighting retrofit",
                "scope_target": "Scope 2",
                "capex": 24000.0,
                "annual_savings": 12000.0,
                "annual_emissions_reduction_tco2e": 14.0,
                "assumptions": ["Illustrative savings; no lighting audit performed."],
            },
        ],
        "metadata": _mock_metadata(),
    }


def simulate_financing(
    loan_amount: float,
    annual_interest_rate_pct: float,
    tenure_years: int,
    annual_savings: float,
) -> FinancingSimulation:
    """Return a temporary local, fixed-rate loan illustration in MYR.

    TEMPORARY MOCK: replace with the finance service's simulation call. Unlike
    the fixed analysis fixtures, this illustration responds to supplied inputs.
    It assumes equal monthly payments and excludes fees, grants, and tax. It
    does not assess creditworthiness or represent an offer. Invalid inputs raise
    ValueError; callers should surface errors rather than invent fallback data.
    """
    for name, value in (
        ("loan_amount", loan_amount),
        ("annual_interest_rate_pct", annual_interest_rate_pct),
        ("annual_savings", annual_savings),
    ):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{name} must be a finite non-negative number")
        if not isfinite(value) or value < 0:
            raise ValueError(f"{name} must be a finite non-negative number")
    if type(tenure_years) is not int or not 1 <= tenure_years <= 50:
        raise ValueError("tenure_years must be an integer between 1 and 50")

    months = tenure_years * 12
    monthly_rate = annual_interest_rate_pct / 100 / 12
    if monthly_rate == 0:
        monthly_payment = loan_amount / months
    else:
        monthly_payment = loan_amount * (
            monthly_rate / -expm1(-months * log1p(monthly_rate))
        )
    total_repayment = monthly_payment * months
    annual_debt_service = monthly_payment * 12
    if not all(isfinite(v) for v in (monthly_payment, total_repayment, annual_debt_service)):
        raise ValueError("Financing inputs exceed the supported numeric range")

    return {
        "currency": "MYR",
        "loan_amount": float(loan_amount),
        "annual_interest_rate_pct": float(annual_interest_rate_pct),
        "tenure_years": tenure_years,
        "annual_savings": float(annual_savings),
        "monthly_repayment": round(monthly_payment, 2),
        "annual_debt_service": round(annual_debt_service, 2),
        "total_repayment": round(total_repayment, 2),
        "total_interest": round(total_repayment - loan_amount, 2),
        "net_annual_cash_flow": round(annual_savings - annual_debt_service, 2),
        "assumptions": [
            "Fixed nominal annual interest rate with monthly amortisation.",
            "Savings remain constant; fees, grants, taxes, and rounding adjustments excluded.",
        ],
        "metadata": _mock_metadata(),
    }
