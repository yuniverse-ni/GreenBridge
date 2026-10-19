"""Shared Pydantic schemas between Part 1 (Data + Carbon), Part 2 (Finance + Transition), and Part 3 (AI Agent).

Canonical payload contract for SME ingestion and transition evaluation.
"""

from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


class CanonicalEnergyPayload(BaseModel):
    annual_kwh: float = 0
    annual_electricity_cost: float = 0
    annual_diesel_l: float = 0
    annual_fuel_cost: float = 0


class CanonicalCarbonBaselinePayload(BaseModel):
    total_tco2e: float = 0
    scope1: float = 0
    scope2: float = 0
    confidence_pct: float = 0


class CanonicalIncomeStatementPeriod(BaseModel):
    revenue: float = 0
    cogs: float = 0
    opex_lines: dict[str, float] = Field(default_factory=dict)
    da: float = 0
    finance_costs: float = 0
    income_tax_expense: float = 0


class CanonicalBalanceSheetPeriod(BaseModel):
    cash: float = 0
    ar: float = 0
    inventory: float = 0
    other_current_assets: float = 0
    fixed_assets_at_cost: float = 0
    accumulated_depreciation: float = 0
    other_assets: float = 0
    ap: float = 0
    short_term_debt: float = 0
    long_term_debt: float = 0
    capital: float = 0
    retained_earnings: float = 0
    drawings: float = 0


class CanonicalCashBudgetPayload(BaseModel):
    cash_sales: list[float] = Field(default_factory=list)
    credit_sales: list[float] = Field(default_factory=list)
    cash_purchases: list[float] = Field(default_factory=list)
    credit_purchases: list[float] = Field(default_factory=list)
    opex: list[float] = Field(default_factory=list)
    opening_cash_m1: Optional[float] = None


class CanonicalSMEDataPayload(BaseModel):
    """Canonical data contract produced by Part 1 (Data + Carbon) and consumed by Part 2."""

    currency: str = "MYR"
    periods: list[str] = Field(default_factory=lambda: ["FY2022", "FY2023", "FY2024"])
    income_statement_inputs: dict[str, CanonicalIncomeStatementPeriod] = Field(default_factory=dict)
    balance_sheet_inputs: dict[str, CanonicalBalanceSheetPeriod] = Field(default_factory=dict)
    cash_budget_inputs: Optional[CanonicalCashBudgetPayload] = None
    energy: CanonicalEnergyPayload = Field(default_factory=CanonicalEnergyPayload)
    carbon_baseline: CanonicalCarbonBaselinePayload = Field(
        default_factory=CanonicalCarbonBaselinePayload
    )
