"""Production AnalysisServices adapters. No fixtures, inference or Carbon math.

Optional providers are deployment-owned `module:function` callables with the
existing AnalysisRequest -> typed tool-result signature. They are never selected
by API callers. The graph and Carbon implementation need no mutual imports.
"""
import importlib
import os
from typing import Callable

from backend.agent.models import (
    CarbonToolResult, FinancialToolResult, TransitionOptionsResult,
)
from backend.finance_transition.intake_finance import financial_analysis
from backend.carbon.carbon_service import get_carbon_analysis


class ProductionAnalysisServices:
    """Stable DI boundary implementing backend.agent.tools.AnalysisServices."""
    def __init__(self, *, carbon: Callable | None = get_carbon_analysis, financial: Callable | None = financial_analysis,
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
        financial=_configured("financial", financial_analysis), transition=_configured("transition"))
