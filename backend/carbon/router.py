"""CarbonResult for an authorized server-owned intake; no client numeric inputs."""
from fastapi import APIRouter, Header
from backend.agent.models import AnalysisRequest, CarbonToolResult, SMEObjective
from backend.data.intake.router import IntakeRegistry


def create_carbon_router(intakes: IntakeRegistry, *, services) -> APIRouter:
    router = APIRouter(prefix="/api/carbon/intakes", tags=["carbon"])

    @router.get("/{intake_id}/result", response_model=CarbonToolResult)
    def result(intake_id: str, authorization: str | None = Header(None)):
        intake, _ = intakes.resolve(intake_id, authorization)
        if intake.agent_next_action != "PROCEED" or not intake.readiness["carbon_analysis"].may_proceed:
            return CarbonToolResult(missing_context=["Review Data & Documents before Carbon analysis."])
        return services.get_carbon_analysis(AnalysisRequest(intake=intake, objective=SMEObjective(mode="ASSESS_CARBON")))

    return router
