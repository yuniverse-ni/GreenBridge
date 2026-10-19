"""MainAgent AnalysisServices adapter for the authoritative Carbon Engine."""

from backend.agent.models import AnalysisRequest, CarbonToolResult

from .carbon_service import calculate_carbon_result


def get_carbon_analysis(request: AnalysisRequest) -> CarbonToolResult:
    """Adapt the server-resolved intake snapshot; never accept client calculations."""
    return CarbonToolResult(data=calculate_carbon_result(request.intake))
