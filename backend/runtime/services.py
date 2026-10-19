"""Production AnalysisServices adapters. No fixtures, inference or Carbon math.

Optional providers are deployment-owned `module:function` callables with the
existing AnalysisRequest -> typed tool-result signature. They are never selected
by API callers. The graph and Carbon implementation need no mutual imports.
"""
import importlib
import os
from typing import Callable

from backend.agent.models import (
    AnalysisRequest, CarbonToolResult, FinancialAnalysis, FinancialToolResult, TransitionOptionsResult,
)
from backend.carbon.agent_adapter import get_carbon_analysis


def financial_snapshot(request: AnalysisRequest) -> FinancialToolResult:
    """Adapt real supplied snapshots; do not substitute EBITDA or a budget for CFADS.

The existing finance engine requires richer statements/cost inputs than intake
publishes. Only these directly evidenced fields can currently cross this boundary.
"""
    dataset = request.intake.normalized_data
    if dataset is None:
        return FinancialToolResult(missing_context=["SERVICE_UNAVAILABLE:financial: no published financial snapshot"])
    source = dataset.financial
    if all(value is None for value in source.model_dump().values()):
        return FinancialToolResult(missing_context=["SERVICE_UNAVAILABLE:financial: no supplied financial values"])
    return FinancialToolResult(data=FinancialAnalysis(
        company_id=request.intake.company.company_id,
        reporting_year=request.intake.company.reporting_year,
        source="backend.data.intake:published-financial-snapshot/v1",
        cash_balance=source.cash_balance, capex_budget=source.capex_budget,
        minimum_cash_reserve=source.minimum_cash_reserve,
        existing_annual_debt_service=source.annual_debt_service,
        annual_cash_available_for_debt_service=None, minimum_dscr=None,
        evidence_limitations=[
            "Supplied financial snapshot only; financial statement and CFADS analysis are unavailable for this intake schema.",
            "Revenue minus expenses is not substituted for CFADS. Missing amounts remain unknown.",
            *[gap.message for gap in request.intake.data_gaps],
        ],
    ))


class ProductionAnalysisServices:
    """Stable DI boundary implementing backend.agent.tools.AnalysisServices."""
    def __init__(self, *, carbon: Callable | None = get_carbon_analysis, financial: Callable | None = financial_snapshot,
                 transition: Callable | None = None):
        self.providers = {"carbon": carbon, "financial": financial, "transition": transition}

    def _invoke(self, name, request, contract, reason):
        provider = self.providers[name]
        if provider is None:
            return contract(missing_context=[f"SERVICE_UNAVAILABLE:{name}: {reason}"])
        try:
            raw = provider(request.model_copy(deep=True))
            result = contract.model_validate(raw.model_dump() if hasattr(raw, "model_dump") else raw)
            if result.data is not None:
                if result.data.origin != "SERVICE":
                    raise ValueError("Demonstration facts are not production service results")
                if (result.data.company_id, result.data.reporting_year) != (
                        request.intake.company.company_id, request.intake.company.reporting_year):
                    raise ValueError("Company/period mismatch")
            elif not result.missing_context:
                return contract(missing_context=[f"SERVICE_UNAVAILABLE:{name}: provider returned no analysis"])
            return result
        except Exception:
            # Do not leak provider internals, credentials, or substitute sample data.
            return contract(missing_context=[f"SERVICE_UNAVAILABLE:{name}: provider failed or returned an invalid scoped result"])

    def get_carbon_analysis(self, request):
        return self._invoke("carbon", request, CarbonToolResult, "authoritative Carbon adapter is not configured")

    def get_financial_analysis(self, request):
        return self._invoke("financial", request, FinancialToolResult, "financial adapter is not configured")

    def get_transition_options(self, request):
        return self._invoke("transition", request, TransitionOptionsResult,
            "no sourced impact-group catalog adapter; legacy generator requires costs/factors absent from intake")


def _configured(name, default=None):
    path = os.environ.get(f"GREENBRIDGE_{name.upper()}_SERVICE")
    if not path:
        return default
    try:
        module, attribute = path.split(":", 1)
        provider = getattr(importlib.import_module(module), attribute)
        if not callable(provider):
            raise ValueError("Provider must be callable")
        return provider
    except Exception:
        # Misconfigured services remain explicitly unavailable, with no fallback.
        return None


def build_production_services() -> ProductionAnalysisServices:
    return ProductionAnalysisServices(carbon=_configured("carbon", get_carbon_analysis),
        financial=_configured("financial", financial_snapshot), transition=_configured("transition"))
