"""Fixed-rate monthly amortisation only; no lending eligibility decisions."""

from math import expm1, isfinite, log1p

from .models import FinancingRequest, FinancingSimulation


def company_dscr(base_cash_flow, annual_savings, existing_debt_service, new_debt_service):
    if any(value is None for value in (base_cash_flow, annual_savings, existing_debt_service, new_debt_service)):
        return None, ["Company DSCR unavailable: CFADS, savings and existing/new debt service are all required."]
    denominator = existing_debt_service + new_debt_service
    if denominator == 0:
        return None, ["Company DSCR is not applicable when total debt service is zero."]
    value = (base_cash_flow + annual_savings) / denominator
    if not isfinite(value):
        raise ValueError("Company DSCR exceeds supported numeric range")
    return value, []


def simulate_financing(request: FinancingRequest) -> FinancingSimulation:
    request = FinancingRequest.model_validate(request.model_dump())
    months = request.terms.tenure_years * 12
    rate = request.terms.annual_interest_rate_pct / 1200
    payment = request.principal / months if rate == 0 else request.principal * rate / -expm1(-months * log1p(rate))
    annual = payment * 12
    total = payment * months
    if not all(isfinite(value) for value in (payment, annual, total)):
        raise ValueError("Financing inputs exceed supported numeric range")
    dscr, warnings = company_dscr(request.annual_cash_available_for_debt_service, request.annual_savings,
                                   request.existing_annual_debt_service, annual)
    return FinancingSimulation(
        capex=request.capex, sme_contribution=request.sme_contribution, grant=request.grant, principal=request.principal,
        monthly_repayment=payment, annual_debt_service=annual, total_repayment=total,
        total_interest=max(0, total - request.principal),
        net_annual_cash_flow=None if request.annual_savings is None else request.annual_savings - annual,
        post_financing_dscr=dscr, terms=request.terms,
        assumptions=["Equal monthly payments at a fixed nominal annual rate; no fees, tax or balloon payment.",
                     "CFADS is service-supplied baseline cash available for debt service before incremental pathway savings.",
                     "CAPEX equals SME contribution plus grant plus financing principal. No lender offer or credit approval."],
        warnings=warnings,
    )
