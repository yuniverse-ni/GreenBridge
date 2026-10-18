"""CAPEX, loan simulation, decarbonisation option comparison.

Carbon tons may be supplied by Data + Carbon. Electricity/diesel factors here
are documented fallbacks used only to size option CO2 when baseline tons are given
as totals, not activity-level abatement.
"""

from __future__ import annotations

from typing import Optional

from finance_transition.finance_models import (
    BusinessConstraints,
    DecarbonisationAction,
    EnergyActivityInputs,
    FinancialSummary,
    FinancialSummaryInputs,
    FinancingSimulationParams,
    FinancingSimulationResult,
    OptionComparisonRow,
    ScenarioCompareResult,
    TransitionOptionBundle,
)
from finance_transition.finance_service import calculate_debt_capacity, get_financial_summary, money
from finance_transition.finance_models import DebtCapacityInputs


def calculate_npv(capex: float, annual_cash_flow: float, years: int, discount_rate: float) -> float:
    npv = -capex
    for t in range(1, years + 1):
        npv += annual_cash_flow / ((1 + discount_rate) ** t)
    return npv


def simulate_financing(params: FinancingSimulationParams) -> FinancingSimulationResult:
    grant = round(params.loan_amount * (params.subsidy_grant_pct / 100))
    principal = max(0.0, params.loan_amount - grant)
    equity = round(params.loan_amount * 0.10)

    monthly_rate = (params.interest_rate_pct / 100) / 12
    total_months = params.tenure_years * 12
    monthly = 0.0
    if monthly_rate > 0 and total_months > 0:
        monthly = (
            principal
            * (monthly_rate * (1 + monthly_rate) ** total_months)
            / ((1 + monthly_rate) ** total_months - 1)
        )
    elif total_months > 0:
        monthly = principal / total_months

    annual_repay = monthly * 12
    total_interest = max(0.0, (monthly * total_months) - principal)
    net_annual = round(params.annual_opex_savings - annual_repay)
    payback = (
        money(params.loan_amount / params.annual_opex_savings, "0.1")
        if params.annual_opex_savings > 0
        else 99.0
    )
    dscr = money(params.annual_opex_savings / (annual_repay or 1))
    cum10 = round(
        (params.annual_opex_savings * 10) - (monthly * total_months) - equity
    )

    return FinancingSimulationResult(
        loan_principal=round(principal),
        grant_subsidy_amount=grant,
        equity_contribution_required=equity,
        monthly_repayment=money(monthly),
        annual_repayment=money(annual_repay),
        total_interest_paid=money(total_interest),
        annual_savings=round(params.annual_opex_savings),
        net_annual_cash_flow_impact=net_annual,
        net_monthly_cash_flow_impact=round(net_annual / 12),
        simple_payback_years=payback,
        post_intervention_dscr=dscr,
        is_cash_flow_positive=net_annual > 0,
        cumulative_10_year_cash_benefit=cum10,
        formula=(
            "M = P × [r(1+r)^n] / [(1+r)^n − 1]; "
            "net annual cash = energy savings − annual repayment; "
            "simple payback = CAPEX / annual savings"
        ),
        assumptions=[
            f"Interest {params.interest_rate_pct}% p.a., tenure {params.tenure_years} years.",
            f"Grant/subsidy {params.subsidy_grant_pct}% of gross CAPEX.",
            "Borrower equity contribution modeled at 10% of gross CAPEX.",
            "Not a bank offer; concessionary green-loan illustration only.",
        ],
    )


def calculate_annual_cash_flow_path(
    current_annual_revenue: float,
    current_annual_opex: float,
    annual_energy_savings: float,
    annual_loan_repayment: float,
    initial_equity_outlay: float,
    years: int = 7,
) -> list[dict]:
    results = []
    cumulative = -initial_equity_outlay
    for y in range(1, years + 1):
        baseline_net = current_annual_revenue - current_annual_opex
        post_opex = (current_annual_opex - annual_energy_savings) + annual_loan_repayment
        post_net = current_annual_revenue - post_opex
        incremental = annual_energy_savings - annual_loan_repayment
        cumulative += incremental
        results.append(
            {
                "year": y,
                "baseline_net_cash": round(baseline_net),
                "post_intervention_net_cash": round(post_net),
                "net_incremental_benefit": round(incremental),
                "cumulative_cash_gain": round(cumulative),
            }
        )
    return results


def generate_decarbonisation_actions(
    energy: EnergyActivityInputs,
    financial: FinancialSummary,
) -> list[DecarbonisationAction]:
    annual_kwh = energy.annual_kwh or 0
    elec_spend = energy.annual_electricity_cost or 0
    avg_tariff = elec_spend / annual_kwh if annual_kwh > 0 else 0.50
    diesel_l = energy.annual_diesel_liters or 0
    diesel_spend = energy.annual_fuel_cost or 0
    grid = energy.grid_kg_per_kwh
    diesel_ef = energy.diesel_kg_per_l
    baseline_t = energy.total_tco2e
    actions: list[DecarbonisationAction] = []

    def reduction_pct(tons: float) -> float:
        if baseline_t > 0:
            return money((tons / baseline_t) * 100, "0.1")
        return 0.0

    if annual_kwh > 30000:
        target_kwh = round(annual_kwh * 0.50)
        kwp = max(25, min(300, round(target_kwh / 1350)))
        gen = kwp * 1350
        capex = kwp * 3200
        savings = round(gen * avg_tariff)
        tons = money((gen * grid) / 1000, "0.1")
        fin = simulate_financing(
            FinancingSimulationParams(
                loan_amount=capex,
                interest_rate_pct=3.75,
                tenure_years=7,
                subsidy_grant_pct=5,
                annual_opex_savings=savings,
            )
        )
        npv = round(calculate_npv(capex, savings, 10, 0.08))
        mac = money((capex / 10 - savings) / (tons or 1))
        actions.append(
            DecarbonisationAction(
                id="ACT-SOLAR-01",
                title=f"{kwp} kWp Commercial Rooftop Solar PV System",
                category="Renewable Energy",
                description=(
                    f"Install a grid-connected {kwp} kWp solar PV system. "
                    "Self-consumes daytime power to offset peak grid electricity bills."
                ),
                scope_target="Scope 2",
                capex=capex,
                annual_energy_savings_unit="kWh/year",
                annual_energy_savings_quantity=gen,
                annual_opex_savings=savings,
                annual_co2e_reduction_tons=tons,
                co2_reduction_pct=reduction_pct(tons) or 28.0,
                payback_period_years=money(capex / savings, "0.1") if savings else 99,
                ten_year_npv=npv,
                roi_pct=round((npv / capex) * 100) if capex else 0,
                marginal_abatement_cost=mac,
                feasibility_score=92,
                recommended_priority="High",
                is_selected_for_plan=True,
                financing=fin,
                implementation_time_months=4,
                assumptions=[
                    f"Sized at {kwp} kWp with 1,350 kWh/kWp specific yield.",
                    f"Tariff offset RM {avg_tariff:.2f}/kWh from uploaded utility cost.",
                    f"Grid factor {grid} kgCO2e/kWh ({energy.grid_region}).",
                    "Eligible for GTFS / BNM LCTF illustration.",
                ],
                regulatory_standards=[
                    "Suruhanjaya Tenaga NEM 3.0 / Self-Consumption (SelCo)",
                    "IEC 61215 PV Module Standards",
                ],
            )
        )

    if annual_kwh > 20000:
        lighting_kwh = round(annual_kwh * 0.18)
        saved = round(lighting_kwh * 0.60)
        savings = round(saved * avg_tariff)
        capex = max(12000, round(savings * 1.8))
        tons = money((saved * grid) / 1000, "0.1")
        fin = simulate_financing(
            FinancingSimulationParams(
                loan_amount=capex,
                interest_rate_pct=4.25,
                tenure_years=3,
                subsidy_grant_pct=0,
                annual_opex_savings=savings,
            )
        )
        npv = round(calculate_npv(capex, savings, 10, 0.08))
        actions.append(
            DecarbonisationAction(
                id="ACT-LED-02",
                title="Smart Industrial LED High-Bay & Occupancy Retrofit",
                category="Energy Efficiency",
                description=(
                    "Replace metal-halide/fluorescent high-bays with high-efficacy LEDs "
                    "and occupancy sensors."
                ),
                scope_target="Scope 2",
                capex=capex,
                annual_energy_savings_unit="kWh/year",
                annual_energy_savings_quantity=saved,
                annual_opex_savings=savings,
                annual_co2e_reduction_tons=tons,
                co2_reduction_pct=reduction_pct(tons) or 8.0,
                payback_period_years=money(capex / savings, "0.1") if savings else 99,
                ten_year_npv=npv,
                roi_pct=round((npv / capex) * 100) if capex else 0,
                marginal_abatement_cost=-45.0,
                feasibility_score=96,
                recommended_priority="High",
                is_selected_for_plan=True,
                financing=fin,
                implementation_time_months=1,
                assumptions=[
                    "Lighting assumed ~18% of site kWh; 60% savings vs legacy fixtures.",
                    "Typical simple payback under 2 years.",
                ],
                regulatory_standards=["MS 1525", "IEC 60598-1"],
            )
        )

    if annual_kwh > 50000:
        motor_kwh = round(annual_kwh * 0.35)
        saved = round(motor_kwh * 0.22)
        savings = round(saved * avg_tariff)
        capex = round(savings * 2.4)
        tons = money((saved * grid) / 1000, "0.1")
        fin = simulate_financing(
            FinancingSimulationParams(
                loan_amount=capex,
                interest_rate_pct=4.0,
                tenure_years=5,
                subsidy_grant_pct=5,
                annual_opex_savings=savings,
            )
        )
        npv = round(calculate_npv(capex, savings, 10, 0.08))
        actions.append(
            DecarbonisationAction(
                id="ACT-VFD-03",
                title="Variable Frequency Drives (VFDs) on Pumps & Air Compressors",
                category="Process Optimization",
                description=(
                    "Fit VFDs onto pumps, blowers and rotary screw compressors "
                    "to cut throttling losses."
                ),
                scope_target="Scope 2",
                capex=capex,
                annual_energy_savings_unit="kWh/year",
                annual_energy_savings_quantity=saved,
                annual_opex_savings=savings,
                annual_co2e_reduction_tons=tons,
                co2_reduction_pct=reduction_pct(tons) or 12.0,
                payback_period_years=money(capex / savings, "0.1") if savings else 99,
                ten_year_npv=npv,
                roi_pct=round((npv / capex) * 100) if capex else 0,
                marginal_abatement_cost=-22.5,
                feasibility_score=88,
                recommended_priority="Medium",
                is_selected_for_plan=False,
                financing=fin,
                implementation_time_months=2,
                assumptions=[
                    "Motor systems assumed ~35% of site kWh; 22% savings with VFD + IE4.",
                ],
                regulatory_standards=["IEC 60034-30-1 (IE4)"],
            )
        )

    if diesel_l > 5000:
        replace_l = round(diesel_l * 0.45)
        diesel_saved = round(replace_l * (diesel_spend / diesel_l if diesel_l else 2.15))
        ev_elec_cost = round(diesel_saved * 0.32)
        net_save = diesel_saved - ev_elec_cost
        capex = 160000
        tons = money((replace_l * diesel_ef * 0.65) / 1000, "0.1")
        fin = simulate_financing(
            FinancingSimulationParams(
                loan_amount=capex,
                interest_rate_pct=3.50,
                tenure_years=5,
                subsidy_grant_pct=10,
                annual_opex_savings=net_save,
            )
        )
        npv = round(calculate_npv(capex, net_save, 10, 0.08))
        actions.append(
            DecarbonisationAction(
                id="ACT-EV-04",
                title="Fleet Electrification: 2x Commercial Electric Delivery Vans",
                category="Electrification",
                description=(
                    "Replace 2 diesel vans with electric vans and 22 kW on-site charging."
                ),
                scope_target="Scope 1",
                capex=capex,
                annual_energy_savings_unit="liters diesel avoided",
                annual_energy_savings_quantity=replace_l,
                annual_opex_savings=net_save,
                annual_co2e_reduction_tons=tons,
                co2_reduction_pct=reduction_pct(tons) or 14.0,
                payback_period_years=money(capex / (net_save or 1), "0.1"),
                ten_year_npv=npv,
                roi_pct=round((npv / capex) * 100) if capex else 0,
                marginal_abatement_cost=18.0,
                feasibility_score=82,
                recommended_priority="Medium",
                is_selected_for_plan=False,
                financing=fin,
                implementation_time_months=3,
                assumptions=[
                    "Displaces ~45% of annual diesel (two delivery vans).",
                    "EV electricity cost modeled at 32% of displaced diesel spend.",
                    f"Diesel factor {diesel_ef} kgCO2e/L with 0.65 net after grid charging.",
                ],
                regulatory_standards=["UN ECE R100", "ISO 15118"],
            )
        )

    if annual_kwh > 40000:
        hvac_kwh = round(annual_kwh * 0.28)
        saved = round(hvac_kwh * 0.30)
        savings = round(saved * avg_tariff)
        capex = round(savings * 3.5)
        tons = money((saved * grid) / 1000, "0.1")
        fin = simulate_financing(
            FinancingSimulationParams(
                loan_amount=capex,
                interest_rate_pct=4.0,
                tenure_years=5,
                subsidy_grant_pct=5,
                annual_opex_savings=savings,
            )
        )
        npv = round(calculate_npv(capex, savings, 10, 0.08))
        actions.append(
            DecarbonisationAction(
                id="ACT-HVAC-05",
                title="Inverter Magnetic-Bearing Chiller & Heat Recovery Upgrade",
                category="Energy Efficiency",
                description=(
                    "Replace a legacy chiller with an oil-free inverter chiller and heat recovery."
                ),
                scope_target="Scope 2",
                capex=capex,
                annual_energy_savings_unit="kWh/year",
                annual_energy_savings_quantity=saved,
                annual_opex_savings=savings,
                annual_co2e_reduction_tons=tons,
                co2_reduction_pct=reduction_pct(tons) or 9.0,
                payback_period_years=money(capex / savings, "0.1") if savings else 99,
                ten_year_npv=npv,
                roi_pct=round((npv / capex) * 100) if capex else 0,
                marginal_abatement_cost=5.0,
                feasibility_score=84,
                recommended_priority="Medium",
                is_selected_for_plan=False,
                financing=fin,
                implementation_time_months=4,
                assumptions=[
                    "HVAC assumed ~28% of site kWh; 30% savings on that share.",
                ],
                regulatory_standards=["ASHRAE 90.1-2022"],
            )
        )

    return actions


DEFAULT_BUNDLES = [
    TransitionOptionBundle(option_id="led", label="LED retrofit", action_ids=["ACT-LED-02"]),
    TransitionOptionBundle(
        option_id="led_vfd",
        label="LED + compressor VFD",
        action_ids=["ACT-LED-02", "ACT-VFD-03"],
    ),
    TransitionOptionBundle(
        option_id="solar_upgrades",
        label="Solar + upgrades",
        action_ids=["ACT-SOLAR-01", "ACT-LED-02", "ACT-VFD-03"],
    ),
]

SCORING_FORMULA = (
    "score = 0.30×affordability + 0.25×cash_safety + 0.25×CO2_vs_target + 0.20×NPV_rank; "
    "hard-fail if cash shortfall or DSCR < 1.25 unless allow_stressed"
)


def _combine_actions(selected: list[DecarbonisationAction]) -> dict:
    capex = sum(a.capex for a in selected)
    savings = sum(a.annual_opex_savings for a in selected)
    tons = sum(a.annual_co2e_reduction_tons for a in selected)
    npv = sum(a.ten_year_npv for a in selected)
    monthly = sum(a.financing.monthly_repayment for a in selected)
    annual_repay = sum(a.financing.annual_repayment for a in selected)
    equity = sum(a.financing.equity_contribution_required for a in selected)
    return {
        "capex": capex,
        "savings": savings,
        "tons": tons,
        "npv": npv,
        "monthly": monthly,
        "annual_repay": annual_repay,
        "equity": equity,
    }


def compare_transition_options(
    financial_inputs: FinancialSummaryInputs,
    energy: EnergyActivityInputs,
    constraints: Optional[BusinessConstraints] = None,
    bundles: Optional[list[TransitionOptionBundle]] = None,
    allow_stressed: bool = False,
) -> ScenarioCompareResult:
    constraints = constraints or BusinessConstraints()
    summary = get_financial_summary(financial_inputs)
    actions = generate_decarbonisation_actions(energy, summary)
    by_id = {a.id: a for a in actions}
    use_bundles = bundles or DEFAULT_BUNDLES

    rows: list[OptionComparisonRow] = []
    npvs: list[float] = []

    for bundle in use_bundles:
        selected = [by_id[i] for i in bundle.action_ids if i in by_id]
        if not selected:
            continue
        agg = _combine_actions(selected)
        combined_fin = simulate_financing(
            FinancingSimulationParams(
                loan_amount=agg["capex"],
                interest_rate_pct=3.75,
                tenure_years=7,
                subsidy_grant_pct=5,
                annual_opex_savings=agg["savings"],
            )
        )
        co2_pct = (
            money((agg["tons"] / energy.total_tco2e) * 100, "0.1")
            if energy.total_tco2e > 0
            else money(sum(a.co2_reduction_pct for a in selected), "0.1")
        )
        capacity = calculate_debt_capacity(
            DebtCapacityInputs(
                ebitda=summary.ebitda,
                existing_annual_debt_service=summary.existing_debt_service,
                target_dscr=constraints.min_dscr_requirement,
            )
        )
        post_dscr = combined_fin.post_intervention_dscr
        # Portfolio DSCR uses EBITDA + savings vs existing ADS + new repayment
        new_ads = summary.existing_debt_service + combined_fin.annual_repayment
        portfolio_dscr = money((summary.ebitda + agg["savings"]) / new_ads) if new_ads else 50.0

        cash_shortfall = (
            constraints.cash_balance - combined_fin.equity_contribution_required
            < constraints.minimum_cash_buffer
        ) or not combined_fin.is_cash_flow_positive
        within_capacity = agg["capex"] <= capacity.max_loan_amount + constraints.cash_balance
        within_budget = agg["capex"] <= constraints.max_capex_budget
        meets_target = co2_pct >= constraints.emission_reduction_target_pct

        fail: list[str] = []
        if cash_shortfall:
            fail.append("Cash-flow pressure: net annual cash is not positive or equity drains the buffer.")
        if portfolio_dscr < constraints.min_dscr_requirement:
            fail.append(
                f"Post-intervention DSCR {portfolio_dscr:.2f}x is below {constraints.min_dscr_requirement}x."
            )
        if not within_capacity:
            fail.append("CAPEX exceeds indicative debt capacity plus cash.")
        if not within_budget:
            fail.append("CAPEX exceeds declared maximum CapEx budget.")
        if not meets_target:
            fail.append(
                f"CO₂ reduction {co2_pct}% is below the {constraints.emission_reduction_target_pct}% target."
            )

        hard_fail = (cash_shortfall or portfolio_dscr < constraints.min_dscr_requirement) and not allow_stressed
        if hard_fail:
            status = "not_affordable"
        elif fail:
            status = "cash_flow_pressure"
        else:
            status = "ok"

        rows.append(
            OptionComparisonRow(
                option_id=bundle.option_id,
                label=bundle.label,
                capex=agg["capex"],
                annual_opex_savings=agg["savings"],
                annual_co2e_reduction_t=money(agg["tons"], "0.1"),
                co2_reduction_pct=co2_pct,
                simple_payback_years=combined_fin.simple_payback_years,
                npv_10y=agg["npv"],
                monthly_repayment=combined_fin.monthly_repayment,
                net_monthly_cash=combined_fin.net_monthly_cash_flow_impact,
                post_dscr=portfolio_dscr,
                cash_shortfall=cash_shortfall,
                within_debt_capacity=within_capacity,
                meets_reduction_target=meets_target,
                meets_15pct_reduction=co2_pct >= 15.0,
                within_capex_budget=within_budget,
                affordability_status=status,
                score=0,
                fail_reasons=fail,
                assumptions=combined_fin.assumptions
                + [f"Bundle actions: {', '.join(a.id for a in selected)}"],
            )
        )
        npvs.append(agg["npv"])

    max_npv = max(npvs) if npvs else 1
    min_npv = min(npvs) if npvs else 0
    npv_span = max(max_npv - min_npv, 1)

    scored: list[OptionComparisonRow] = []
    for row in rows:
        afford = 100 if row.affordability_status == "ok" else 40 if row.affordability_status == "cash_flow_pressure" else 0
        cash_safety = 0 if row.cash_shortfall else 100
        if constraints.emission_reduction_target_pct > 0:
            co2_score = min(100, (row.co2_reduction_pct / constraints.emission_reduction_target_pct) * 100)
        else:
            co2_score = 0
        npv_rank = ((row.npv_10y - min_npv) / npv_span) * 100
        score = 0.30 * afford + 0.25 * cash_safety + 0.25 * co2_score + 0.20 * npv_rank
        if row.affordability_status == "not_affordable":
            score = min(score, 25)
        scored.append(row.model_copy(update={"score": money(score, "0.1")}))

    ranked = sorted(scored, key=lambda r: r.score, reverse=True)
    recommended = next((r.option_id for r in ranked if r.affordability_status == "ok"), None)
    if recommended is None and ranked:
        recommended = ranked[0].option_id

    return ScenarioCompareResult(
        currency=constraints.currency,
        ranked=ranked,
        recommended_option_id=recommended,
        scoring_formula=SCORING_FORMULA,
        notes=[
            "Ranking is deterministic. The agent must not reorder options without these scores.",
            "CO₂ tons use documented grid/diesel factors unless Data + Carbon overrides energy.total_tco2e / factors.",
        ],
    )
