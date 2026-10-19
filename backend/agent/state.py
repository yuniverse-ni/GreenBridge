"""Plain checkpoint dictionaries; boundary/tool contracts live in models.py."""

from typing_extensions import TypedDict


class MainAgentState(TypedDict, total=False):
    company_id: str | None
    reporting_year: int | None
    intake_result: dict
    objective: dict
    readiness: dict
    tool_plan: list[str]
    tool_results: dict
    transition_candidates: list[dict]
    transition_pathways: list[dict]
    financing_results: dict
    constraint_results: dict
    ranked_pathways: list[dict]
    recommendation: dict | None
    llm_explanation: dict | None
    missing_context: list[str]
    warnings: list[str]
    execution_trace: list[dict]
    human_decision: dict | None
    human_history: list[dict]
    excluded_pathway_ids: list[str]
    errors: list[str]
    status: str
