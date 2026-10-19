"""Tests for Transition, CAPEX, payback, financing, and scenario comparison.

Includes Tests T1, T2, T3.
"""

import pytest
from finance_transition.finance_models import (
    BusinessConstraints,
    DebtCapacityInputs,
    EnergyActivityInputs,
    FinancialSummaryInputs,
    FinancingSimulationParams,
    TransitionOptionBundle,
)
from finance_transition.finance_service import calculate_debt_capacity, get_financial_summary
from finance_transition.transition_service import (
    compare_transition_options,
    generate_decarbonisation_actions,
    simulate_financing,
)


def test_simulate_financing_payback_and_cash_positive():
    """Verifies loan amortisation, simple payback, and cash positive flag.

    Option LED + compressor VFD demo benchmark:
    CAPEX = RM 75,000, Annual savings = RM 21,000 -> Simple payback = 3.6 years.
    """
    sim = simulate_financing(
        FinancingSimulationParams(
            loan_amount=75_000,
            interest_rate_pct=3.75,
            tenure_years=7,
            subsidy_grant_pct=5,
            annual_opex_savings=21_000,
        )
    )

    assert sim.simple_payback_years == 3.6
    assert sim.grant_subsidy_amount == 3750  # 5% of 75k
    assert sim.loan_principal == 71_250  # 95% of 75k
    assert sim.equity_contribution_required == 7500  # 10% of gross
    assert sim.annual_savings == 21_000
    assert sim.annual_repayment > 0
    assert sim.net_annual_cash_flow_impact == 21_000 - round(sim.annual_repayment)
    assert sim.is_cash_flow_positive is True


def test_t3_loan_with_5_pct_grant():
    """Test T3: Loan with 5% grant.

    principal = 95% of CAPEX;
    equity = 10% of gross CAPEX unless documented otherwise (matches TS prototype).
    """
    capex = 100_000
    sim = simulate_financing(
        FinancingSimulationParams(
            loan_amount=capex,
            interest_rate_pct=4.0,
            tenure_years=5,
            subsidy_grant_pct=5,
            annual_opex_savings=30_000,
        )
    )

    assert sim.grant_subsidy_amount == 5_000
    assert sim.loan_principal == 95_000  # 95% of CAPEX
    assert sim.equity_contribution_required == 10_000  # 10% of gross CAPEX


def test_debt_capacity_and_dscr():
    """Verifies debt capacity mathematical simulation."""
    res = calculate_debt_capacity(
        DebtCapacityInputs(
            ebitda=500_000,
            existing_annual_debt_service=50_000,
            target_dscr=1.25,
            indicative_interest_rate_pct=4.0,
            indicative_tenure_years=7,
        )
    )

    # Max allowed ADS = 500,000 / 1.25 = 400,000
    # Available ADS = 400,000 - 50,000 = 350,000
    assert res.available_annual_debt_service == 350_000.0
    assert res.max_loan_amount > 0
    assert res.current_dscr == 10.0


def test_t1_combined_led_vfd():
    """Test T1: Combined LED+VFD bundle.

    CO₂% uses passed-in tons;
    payback = combined CAPEX / combined savings.
    """
    energy = EnergyActivityInputs(
        annual_kwh=120_000,
        annual_electricity_cost=60_000,
        total_tco2e=70.08,  # Passed-in total tons from Part 1
    )
    fin_inputs = FinancialSummaryInputs(
        cash_balance=250_000,
        annual_revenue=2_000_000,
        annual_opex=1_500_000,
        annual_energy_cost=60_000,
        existing_annual_debt_service=40_000,
    )
    bundle = TransitionOptionBundle(
        option_id="led_vfd",
        label="LED + compressor VFD",
        action_ids=["ACT-LED-02", "ACT-VFD-03"],
    )

    res = compare_transition_options(
        financial_inputs=fin_inputs,
        energy=energy,
        bundles=[bundle],
    )

    row = res.ranked[0]
    # Check payback = combined CAPEX / combined savings
    expected_payback = round(row.capex / row.annual_opex_savings, 1)
    assert row.simple_payback_years == expected_payback

    # Check CO2% uses passed-in tons
    expected_co2_pct = round((row.annual_co2e_reduction_t / energy.total_tco2e) * 100, 1)
    assert row.co2_reduction_pct == expected_co2_pct
    assert row.meets_15pct_reduction == (row.co2_reduction_pct >= 15.0)


def test_t2_solar_bundle_fails_affordability():
    """Test T2: Solar bundle fails affordability if buffer breach or DSCR < 1.25.

    Must hard-fail (status = 'not_affordable', low score <= 25) unless allow_stressed=True.
    Do not recommend Solar as 'best' if it fails cash or DSCR.
    """
    energy = EnergyActivityInputs(
        annual_kwh=120_000,
        annual_electricity_cost=60_000,
        total_tco2e=70.08,
    )
    # Stressed SME: cash balance is only RM 5,000, minimum buffer requirement is RM 50,000.
    # Solar capex ~140k requires ~14k equity, which immediately breaches the 50k buffer!
    tight_financial = FinancialSummaryInputs(
        cash_balance=5_000,
        annual_revenue=500_000,
        annual_opex=480_000,
        annual_energy_cost=60_000,
        existing_annual_debt_service=15_000,
    )
    constraints = BusinessConstraints(
        cash_balance=5_000,
        minimum_cash_buffer=50_000,  # Buffer breach!
        min_dscr_requirement=1.25,
        max_capex_budget=200_000,
        emission_reduction_target_pct=15,
    )

    res = compare_transition_options(
        financial_inputs=tight_financial,
        energy=energy,
        constraints=constraints,
        allow_stressed=False,
    )

    # Find the solar option in ranked results
    solar_row = next((r for r in res.ranked if "solar" in r.option_id), None)
    assert solar_row is not None
    assert solar_row.affordability_status == "not_affordable"
    assert solar_row.cash_shortfall is True
    assert solar_row.score <= 25

    # Solar must NOT be recommended when it fails affordability
    assert res.recommended_option_id != solar_row.option_id


def test_deterministic_ranking_reproducibility():
    """Ensures deterministic scoring formula produces exact same scores every run."""
    energy = EnergyActivityInputs(
        annual_kwh=120_000,
        annual_electricity_cost=60_000,
        total_tco2e=70.08,
    )
    fin_inputs = FinancialSummaryInputs(
        cash_balance=312_500,
        annual_revenue=3_200_000,
        annual_opex=2_600_000,
        annual_energy_cost=96_000,
        existing_annual_debt_service=77_000,
    )
    constraints = BusinessConstraints(
        cash_balance=312_500,
        minimum_cash_buffer=100_000,
        max_capex_budget=500_000,
        emission_reduction_target_pct=15,
    )

    run1 = compare_transition_options(fin_inputs, energy, constraints)
    run2 = compare_transition_options(fin_inputs, energy, constraints)

    assert run1.recommended_option_id == run2.recommended_option_id
    assert [r.score for r in run1.ranked] == [r.score for r in run2.ranked]
    assert [r.option_id for r in run1.ranked] == [r.option_id for r in run2.ranked]
