"""Transparent screening rules; PASS never means lender approval."""

from .financing import company_dscr
from .models import ConstraintCheck, ConstraintRequest, ConstraintResult


def reserve_floor(financial, objective):
    values = [value for value in (financial.minimum_cash_reserve, objective.constraints.minimum_cash_reserve) if value is not None]
    return max(values) if values else None


def check_transition_constraints(request: ConstraintRequest) -> ConstraintResult:
    path, financial, objective = request.pathway, request.financial, request.objective
    checks = []

    def compare(name, actual, limit, comparator, missing):
        if actual is None or limit is None:
            checks.append(ConstraintCheck(name=name, status="UNKNOWN", reason="Required measurement or limit is unavailable.", missing_fields=missing))
        else:
            passed = comparator(actual, limit)
            checks.append(ConstraintCheck(name=name, status="PASS" if passed else "FAIL",
                                          reason=f"Observed {actual:.6g}; required limit {limit:.6g}."))

    compare("minimum_cash_reserve", path.remaining_cash, reserve_floor(financial, objective),
            lambda actual, limit: actual >= limit, ["cash_balance", "minimum_cash_reserve", "funding_allocation"])
    limits = [value for value in (financial.capex_budget, objective.constraints.maximum_capex) if value is not None]
    compare("capex_limit", path.capex, min(limits) if limits else None,
            lambda actual, limit: actual <= limit, ["maximum_capex"])
    if objective.funding.maximum_sme_contribution is not None:
        compare("sme_contribution_limit", path.sme_contribution, objective.funding.maximum_sme_contribution,
                lambda actual, limit: actual <= limit, ["funding_allocation"])
    if objective.constraints.carbon_reduction_target_pct is not None:
        compare("carbon_target", path.carbon_reduction_pct, objective.constraints.carbon_reduction_target_pct,
                lambda actual, limit: actual >= limit, ["carbon_baseline", "action_emissions_impacts"])
    elif objective.focus in {"CARBON", "BALANCED"}:
        compare("positive_carbon_impact", path.annual_emissions_reduction_tco2e, 0,
                lambda actual, limit: actual > limit, ["action_emissions_impacts"])
    if objective.constraints.maximum_payback_years is not None:
        compare("maximum_payback", path.simple_payback_years, objective.constraints.maximum_payback_years,
                lambda actual, limit: actual <= limit, ["annual_savings", "payback"])
    principal = path.financing_principal
    simulation = request.financing
    if principal is None:
        checks.append(ConstraintCheck(name="funding", status="UNKNOWN", reason="Funding allocation is unknown.", missing_fields=path.missing_context))
        net_cash = None
    elif principal > 0 and simulation is None:
        checks.append(ConstraintCheck(name="funding", status="UNKNOWN", reason="Required financing has not been simulated.", missing_fields=["financing_terms"]))
        net_cash = None
    else:
        checks.append(ConstraintCheck(name="funding", status="PASS", reason="Funding reconciles; financing was simulated where needed."))
        net_cash = simulation.net_annual_cash_flow if simulation else path.annual_savings
    compare("positive_annual_cash_benefit", net_cash, 0, lambda actual, limit: actual > limit,
            ["annual_savings", "annual_financing_payment"])
    if (principal is not None and principal > 0) or objective.constraints.minimum_post_financing_dscr is not None:
        minimum = objective.constraints.minimum_post_financing_dscr
        if minimum is None:
            minimum = financial.minimum_dscr
        dscr = simulation.post_financing_dscr if simulation else company_dscr(
            financial.annual_cash_available_for_debt_service, path.annual_savings,
            financial.existing_annual_debt_service, 0 if principal == 0 else None)[0]
        compare("company_post_financing_dscr", dscr, minimum, lambda actual, limit: actual >= limit,
                ["annual_cash_available_for_debt_service", "existing_annual_debt_service", "minimum_post_financing_dscr"])
    if objective.constraints.maximum_annual_financing_payment is not None:
        payment = simulation.annual_debt_service if simulation else 0 if principal == 0 else None
        compare("financing_burden", payment, objective.constraints.maximum_annual_financing_payment,
                lambda actual, limit: actual <= limit, ["financing_terms"])
    status = "FAIL" if any(item.critical and item.status == "FAIL" for item in checks) else "UNKNOWN" if any(item.critical and item.status == "UNKNOWN" for item in checks) else "PASS"
    return ConstraintResult(pathway_id=path.pathway_id, checks=checks, status=status)
