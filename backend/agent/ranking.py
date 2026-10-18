"""Stable lexicographic ranking. LLM outputs are not inputs to this module."""

from .models import RankedPathway, RankingRequest, RankingResult


def rank_transition_pathways(request: RankingRequest) -> RankingResult:
    records = []
    for item in request.pathways:
        if item.pathway.pathway_id in request.excluded_pathway_ids:
            continue
        reasons = [f"{check.name}: {check.status} — {check.reason}" for check in item.constraints.checks]
        required = {"minimum_cash_reserve", "capex_limit", "funding", "positive_annual_cash_benefit"}
        if request.objective.constraints.carbon_reduction_target_pct is not None:
            required.add("carbon_target")
        elif request.objective.focus in {"CARBON", "BALANCED"}:
            required.add("positive_carbon_impact")
        if request.objective.constraints.maximum_payback_years is not None:
            required.add("maximum_payback")
        if (item.pathway.financing_principal is not None and item.pathway.financing_principal > 0) or request.objective.constraints.minimum_post_financing_dscr is not None:
            required.add("company_post_financing_dscr")
        if request.objective.constraints.maximum_annual_financing_payment is not None:
            required.add("financing_burden")
        if request.objective.funding.maximum_sme_contribution is not None:
            required.add("sme_contribution_limit")
        checks = {check.name: check for check in item.constraints.checks}
        present_and_pass = len(checks) == len(item.constraints.checks) and all(
            name in checks and checks[name].critical and checks[name].status == "PASS" for name in required)
        if not present_and_pass:
            reasons.append("Required critical checks are missing, duplicated or have not passed.")
        passes = present_and_pass and item.constraints.status == "PASS" and all(check.status == "PASS" for check in item.constraints.checks if check.critical)
        feasible = request.readiness_permits and passes
        if not request.readiness_permits:
            reasons.insert(0, "Required intake readiness does not permit analysis.")
        records.append(RankedPathway(**item.model_dump(), rank=1, feasible=feasible, reasons=reasons))

    def key(item):
        path = item.pathway
        carbon = path.annual_emissions_reduction_tco2e
        benefit = item.financing.net_annual_cash_flow if item.financing else path.annual_savings
        carbon = carbon if carbon is not None else float("-inf")
        benefit = benefit if benefit is not None else float("-inf")
        payback = path.simple_payback_years if path.simple_payback_years is not None else float("inf")
        metrics = (-carbon, -benefit, payback) if request.objective.focus == "CARBON" else (-benefit, payback, -carbon) if request.objective.focus == "COST" else (payback, -carbon, -benefit)
        return (not item.feasible, *metrics, path.capex, path.pathway_id)

    records.sort(key=key)
    for position, item in enumerate(records, 1):
        item.rank = position
    rule = {"CARBON": "highest carbon reduction, net annual benefit, shortest payback",
            "COST": "highest net annual benefit, shortest payback, carbon reduction",
            "BALANCED": "shortest payback, carbon reduction, net annual benefit"}[request.objective.focus]
    return RankingResult(pathways=records, selected_pathway_id=records[0].pathway.pathway_id if records and records[0].feasible else None,
                         rule=f"Feasibility first; then {rule}; lower CAPEX and pathway ID break ties.")
