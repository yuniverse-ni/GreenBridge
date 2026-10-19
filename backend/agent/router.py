"""HTTP lifecycle for the existing MainAgent graph; no graph/decision redesign."""
from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException
from langgraph.types import Command
from pydantic import BaseModel, ConfigDict, Field

from backend.data.intake.router import IntakeRegistry
from backend.runtime.services import build_production_services
from .graph import MainAgent
from .models import ContextResponse, HumanDecision, MainAgentInput, SMEObjective


class StartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    intake_id: str = Field(min_length=1)
    objective: SMEObjective


class ResumeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["RESUME", "CANCEL", "ACCEPT", "REJECT", "REQUEST_ALTERNATIVE"]
    reason: str = Field(min_length=1, pattern=r"\S")
    objective: SMEObjective | None = None
    # Stale UI decisions must not accidentally accept a newly reranked pathway.
    revision: int = Field(ge=0)


class AgentResponse(BaseModel):
    run_id: str
    intake_id: str
    revision: int
    awaiting: Literal["context", "human_review"] | None
    result: dict[str, Any]
    service_status: dict[str, str]
    interrupts: list[dict[str, Any]]


@dataclass
class Run:
    agent: MainAgent
    config: dict
    intake_id: str
    company_id: str | None
    reporting_year: int | None
    revision: int = 0
    lock: RLock = field(default_factory=RLock)


def create_agent_router(intakes: IntakeRegistry, *, services=None, assistant=None) -> APIRouter:
    router = APIRouter(prefix="/api/agent", tags=["main-agent"])
    runs: dict[str, Run] = {}
    runs_lock = RLock()
    services = services if services is not None else build_production_services()

    def public(run_id, run):
        snapshot = run.agent.graph.get_state(run.config)
        awaiting = "context" if "request_context" in snapshot.next else "human_review" if "human_review" in snapshot.next else None
        result = dict(snapshot.values)
        statuses = {}
        for tool in ("get_carbon_analysis", "get_financial_analysis", "get_transition_options"):
            value = result.get("tool_results", {}).get(tool)
            statuses[tool] = "NOT_CALLED" if value is None else "AVAILABLE" if value.get("data") is not None else "SERVICE_UNAVAILABLE"
        return AgentResponse(run_id=run_id, intake_id=run.intake_id, revision=run.revision,
            awaiting=awaiting, result=result, service_status=statuses,
            interrupts=[{"id": item.id, "value": item.value} for task in snapshot.tasks for item in task.interrupts])

    def lookup(run_id, authorization):
        with runs_lock:
            run = runs.get(run_id)
        if run is None:
            raise HTTPException(404, "Agent run unavailable or expired.")
        intake, reviewer = intakes.resolve(run.intake_id, authorization)
        if (run.company_id is not None and intake.company.company_id not in (None, run.company_id)
                or run.reporting_year is not None and intake.company.reporting_year not in (None, run.reporting_year)):
            raise HTTPException(409, "Intake company/period changed. Start a new agent run.")
        return run, intake, reviewer

    @router.post("/start", response_model=AgentResponse)
    def start(payload: StartRequest, authorization: str | None = Header(None)):
        intake, _ = intakes.resolve(payload.intake_id, authorization)
        run_id = uuid4().hex
        run = Run(MainAgent(services=services, assistant=assistant),
            {"configurable": {"thread_id": f"{intake.company.company_id or 'pending'}:{run_id}"}},
            payload.intake_id, intake.company.company_id, intake.company.reporting_year)
        run.agent.invoke(MainAgentInput(intake_result=intake, objective=payload.objective), run.config)
        with runs_lock:
            runs[run_id] = run
        return public(run_id, run)

    @router.get("/{run_id}/result", response_model=AgentResponse)
    def result(run_id: str, authorization: str | None = Header(None)):
        run, _, _ = lookup(run_id, authorization)
        with run.lock:
            return public(run_id, run)

    @router.post("/{run_id}/resume", response_model=AgentResponse)
    def resume(run_id: str, payload: ResumeRequest, authorization: str | None = Header(None)):
        run, intake, reviewer = lookup(run_id, authorization)
        with run.lock:
            current = public(run_id, run)
            if payload.revision != run.revision:
                raise HTTPException(409, "Agent run changed. Refresh before deciding.")
            if current.awaiting is None:
                raise HTTPException(409, "Agent run has finished. Start a new run.")
            if current.awaiting == "context":
                if payload.action not in ("RESUME", "CANCEL"):
                    raise HTTPException(409, "Supply context or cancel; no recommendation is ready for acceptance.")
                decision = ContextResponse(actor=reviewer, action=payload.action,
                    intake_result=intake if payload.action == "RESUME" else None, objective=payload.objective)
            else:
                if payload.action not in ("ACCEPT", "REJECT", "REQUEST_ALTERNATIVE") or payload.objective is not None:
                    raise HTTPException(409, "Review supports only ACCEPT, REJECT or REQUEST_ALTERNATIVE.")
                # A decision applies to the exact intake snapshot analyzed by the graph.
                if intake.model_dump(mode="json") != current.result["intake_result"]:
                    raise HTTPException(409, "Intake changed since analysis. Start a new run before accepting.")
                decision = HumanDecision(actor=reviewer, action=payload.action, reason=payload.reason)
            run.agent.invoke(Command(resume=decision.model_dump(mode="json")), run.config)
            run.revision += 1
            run.company_id = intake.company.company_id
            run.reporting_year = intake.company.reporting_year
            return public(run_id, run)

    return router
