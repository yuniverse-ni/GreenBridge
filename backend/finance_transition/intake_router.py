"""Capability-scoped FinanceResult from server-owned DataIntakeResult only."""

from fastapi import APIRouter, Header

from backend.agent.models import AnalysisRequest, FinancialToolResult, SMEObjective
from backend.data.intake.router import IntakeRegistry
from backend.runtime.services import build_production_services


def create_intake_finance_router(intakes: IntakeRegistry, *, services=None) -> APIRouter:
    router = APIRouter(prefix="/api/finance/intakes", tags=["intake-finance"])
    services = services if services is not None else build_production_services()

    @router.get("/{intake_id}/result", response_model=FinancialToolResult)
    def result(intake_id: str, authorization: str | None = Header(None)):
        intake, _ = intakes.resolve(intake_id, authorization)
        # Gate even deployment-supplied providers using the same graph readiness
        # checks. A result request cannot accept PARTIAL or bypass confirmation.
        ready = intake.readiness["financial_analysis"]
        if (intake.agent_next_action != "PROCEED" or intake.normalized_data is None
                or not ready.may_proceed or not intake.company.company_id
                or intake.company.reporting_year is None):
            return FinancialToolResult(missing_context=[
                "Review Data & Documents and resolve or explicitly accept the financial evidence limitations before analysis."])
        return services.get_financial_analysis(AnalysisRequest(
            intake=intake, objective=SMEObjective(mode="ASSESS_FINANCIAL")))

    return router
