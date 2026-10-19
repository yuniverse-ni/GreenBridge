"""HTTP transport for DataIntakeAgent; no extraction or downstream calculations.

Intakes/checkpoints are process-local. A random bearer capability isolates each
intake; reviewer is an audit label, not a production identity provider. Restarting
the backend expires these sessions. Raw uploads never appear in public results.
"""

import json
import secrets
from dataclasses import dataclass, field
from threading import RLock
from uuid import uuid4

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from langgraph.types import Command
from pydantic import BaseModel, ValidationError

from ..mapping import EXPECTED_UNITS
from ..models import FIELD_GROUPS
from .agent import DataIntakeAgent
from .models import ConfirmationResponse, DataIntakeResult, EvidenceResponse, IntakeInput, Upload

MAX_FILE_BYTES = 30 * 1024 * 1024


class IntakeResponse(BaseModel):
    intake_id: str
    access_token: str
    reviewer: str
    result: DataIntakeResult
    awaiting: str | None
    can_continue_incomplete: bool
    files: list[dict]
    schema_fields: dict[str, str | None]


@dataclass
class Session:
    agent: DataIntakeAgent
    config: dict
    token: str
    reviewer: str
    lock: RLock = field(default_factory=RLock)


class IntakeRegistry:
    """Shared server capability: return agent-owned results, never caller JSON."""
    def __init__(self):
        self.sessions: dict[str, Session] = {}
        self.lock = RLock()

    def authorized(self, intake_id: str, authorization: str | None) -> Session:
        with self.lock:
            session = self.sessions.get(intake_id)
        supplied = authorization.removeprefix("Bearer ") if authorization else ""
        if session is None or not secrets.compare_digest(session.token.encode(), supplied.encode()):
            raise HTTPException(404, "Intake unavailable or session expired. Start a new upload.")
        return session

    def resolve(self, intake_id: str, authorization: str | None) -> tuple[DataIntakeResult, str]:
        session = self.authorized(intake_id, authorization)
        with session.lock:
            return session.agent.get_result(session.config).model_copy(deep=True), session.reviewer


def create_intake_router(registry: IntakeRegistry | None = None) -> APIRouter:
    router = APIRouter(prefix="/api/intake", tags=["data-intake"])
    registry = registry if registry is not None else IntakeRegistry()
    sessions, sessions_lock = registry.sessions, registry.lock

    def uploads_from(files, quality, basis):
        if len(files) > 10:
            raise HTTPException(413, "Upload at most 10 files per request.")
        uploads = []
        try:
            for source in files:
                content = source.file.read(MAX_FILE_BYTES + 1)
                if len(content) > MAX_FILE_BYTES:
                    raise HTTPException(413, "Each file must be at most 30 MB.")
                uploads.append(Upload(file_id=uuid4().hex, filename=source.filename or "upload",
                                      content=content, evidence_quality=quality, quality_basis=basis))
        finally:
            for source in files:
                source.file.close()
        return uploads

    def authorized(intake_id, authorization):
        return registry.authorized(intake_id, authorization)

    def public(intake_id, session):
        snapshot = session.agent.graph.get_state(session.config)
        pending = [item.value for task in snapshot.tasks for item in task.interrupts]
        awaiting = ("mapping" if "request_confirmation" in snapshot.next else
                    "evidence" if "request_evidence" in snapshot.next else None)
        return IntakeResponse(
            intake_id=intake_id, access_token=session.token, reviewer=session.reviewer,
            result=session.agent.get_result(session.config), awaiting=awaiting,
            can_continue_incomplete=any(item.get("can_continue_incomplete", False) for item in pending),
            files=[{"file_id": item["file_id"], "filename": item["filename"], "size": len(item["content"])}
                   for item in snapshot.values.get("uploads", [])],
            schema_fields={key: EXPECTED_UNITS.get(key) for key in FIELD_GROUPS},
        )

    @router.post("/start", response_model=IntakeResponse)
    def start(files: list[UploadFile] = File(...), reviewer: str = Form(...),
              requested_modules: str = Form('["carbon_analysis","financial_analysis","transition_analysis"]'),
              evidence_quality: str = Form("UNKNOWN"), quality_basis: str | None = Form(None)):
        if not reviewer.strip():
            raise HTTPException(422, "Enter a reviewer name for the intake audit record.")
        try:
            uploads = uploads_from(files, evidence_quality, quality_basis)
            inputs = IntakeInput(uploads=uploads, requested_modules=json.loads(requested_modules))
        except (ValueError, ValidationError):
            raise HTTPException(422, "Invalid modules or evidence declaration; declared quality requires a basis.")
        intake_id = uuid4().hex
        session = Session(DataIntakeAgent(), {"configurable": {"thread_id": intake_id}},
                          secrets.token_urlsafe(32), reviewer.strip())
        session.agent.invoke(inputs, session.config)
        with sessions_lock:
            sessions[intake_id] = session
        return public(intake_id, session)

    @router.get("/{intake_id}/result", response_model=IntakeResponse)
    def result(intake_id: str, authorization: str | None = Header(None)):
        session = authorized(intake_id, authorization)
        with session.lock:
            return public(intake_id, session)

    @router.post("/{intake_id}/resume", response_model=IntakeResponse)
    def resume(intake_id: str, response: str = Form(...), files: list[UploadFile] = File(default=[]),
               evidence_quality: str = Form("UNKNOWN"), quality_basis: str | None = Form(None),
               authorization: str | None = Header(None)):
        session = authorized(intake_id, authorization)
        with session.lock:
            current = public(intake_id, session)
            if current.awaiting is None:
                raise HTTPException(409, "This intake has finished; start a new upload.")
            try:
                payload = json.loads(response)
                if not isinstance(payload, dict):
                    raise ValueError("Expected an object")
                # Documents cannot impersonate the reviewer or inject checkpoint data.
                payload["actor"] = session.reviewer
                if current.awaiting == "mapping":
                    if files:
                        raise ValueError("Resolve mapping before adding evidence")
                    decision = ConfirmationResponse.model_validate(payload)
                else:
                    if "uploads" in payload:
                        raise ValueError("Upload original files using multipart")
                    if payload.get("action") == "continue_incomplete" and not current.can_continue_incomplete:
                        raise HTTPException(409, "BLOCKED readiness cannot be overridden; correct the evidence first.")
                    payload["uploads"] = uploads_from(files, evidence_quality, quality_basis)
                    decision = EvidenceResponse.model_validate(payload)
            except (ValueError, ValidationError):
                raise HTTPException(422, "Invalid clarification. Supply current mapping decisions or an evidence action and reason.")
            session.agent.invoke(Command(resume=decision.model_dump()), session.config)
            return public(intake_id, session)

    return router


intake_registry = IntakeRegistry()
router = create_intake_router(intake_registry)
