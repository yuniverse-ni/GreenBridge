"""Conditional intake subgraph with real LangGraph interrupt/resume boundaries.

Only backend callers may resume. They must authenticate/authorize the human;
actor strings are audit labels, not authentication. Never pass document/LLM
content as a resume payload. No Carbon/Finance/Transition tool is invoked.
"""

from datetime import datetime, timezone
from hashlib import sha256
from typing import Any

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt
from typing_extensions import TypedDict

from ..mapping import map_column
from ..models import ConfirmedMapping, NormalizedDataset, ParsedDocument
from ..parser import DataImportError
from ..service import normalize_documents
from . import tools
from .llm import GeminiMappingAssistant, MappingAssistant, suggest_schema_mapping
from .models import (
    ConfirmationResponse, EvidenceAssessment, EvidenceGap, EvidenceResponse, Inspection, IntakeInput,
    MappingRequest, Upload,
)


class IntakeState(TypedDict, total=False):
    uploads: list[dict]
    requested_modules: list[str]
    inspections: list[dict]
    classifications: dict[str, dict]
    strategies: dict[str, str]
    documents: list[dict]
    confirmations: list[dict]
    ignored_fields: list[dict]
    pending_mappings: list[dict]
    suggestions: list[dict]
    confidence: list[dict]
    gaps: list[dict]
    readiness: dict[str, dict]
    candidate_dataset: dict | None
    dataset: dict | None
    errors: list[dict]
    notices: list[str]
    decisions: list[dict]
    trace: list[str]
    status: str
    partial_acceptances: list[dict]


def _trace(state: IntakeState, node: str) -> list[str]:
    return [*state.get("trace", []), node]


def _scope_matches(scope: dict, *, file_id: str, column: str, row: int | None, sheet: str | None) -> bool:
    return (scope["file_id"] == file_id and scope["original_column"] == column
            and scope.get("row") in (None, row) and scope.get("sheet") == sheet)


def initialize(state: IntakeState) -> dict:
    inputs = IntakeInput.model_validate({"uploads": state.get("uploads", []),
                                         "requested_modules": state.get("requested_modules", ["carbon_analysis", "financial_analysis", "transition_analysis"])})
    ids = [item.file_id for item in inputs.uploads]
    if len(set(ids)) != len(ids):
        raise ValueError("Each upload must have a unique file_id")
    return {**inputs.model_dump(), "confirmations": [], "ignored_fields": [], "pending_mappings": [],
            "suggestions": [], "candidate_dataset": None, "dataset": None, "errors": [],
            "notices": [], "decisions": [], "partial_acceptances": [], "trace": ["initialize"], "status": "PROCESSING"}


def inspect_files(state: IntakeState) -> dict:
    return {"inspections": [tools.inspect_file(Upload.model_validate(item)).model_dump() for item in state["uploads"]],
            "trace": _trace(state, "inspect_files")}


def classify_documents(state: IntakeState) -> dict:
    return {"classifications": {item["file_id"]: tools.classify_document(Inspection.model_validate(item)).model_dump()
                                for item in state["inspections"]}, "trace": _trace(state, "classify_documents")}


def select_extraction_tool(state: IntakeState) -> dict:
    return {"strategies": {key: item["extraction_strategy"] for key, item in state["classifications"].items()},
            "trace": _trace(state, "select_extraction_tool")}


def extract_data(state: IntakeState) -> dict:
    documents, errors = [], []
    for raw in state["uploads"]:
        upload = Upload.model_validate(raw)
        decisions = [ConfirmedMapping.model_validate({key: value for key, value in item.items() if key != "file_id"})
                     for item in state["confirmations"] if item["file_id"] == upload.file_id]
        strategy = state["strategies"][upload.file_id]
        try:
            if strategy == "unsupported":
                raise DataImportError("Unsupported format; upload CSV/XLSX values instead.")
            tool = tools.parse_csv if strategy == "deterministic_csv" else tools.parse_excel
            document = tool(upload, decisions)
        except DataImportError as exc:
            document = exc.document or ParsedDocument(source_file=upload.filename)
            # Unknown fields are eligible for semantic suggestions, not acceptance.
            if not (str(exc).startswith(f"{upload.filename}: no populated supported fields") and document.unmapped_fields):
                errors.append({"stage": "extract_data", "file_id": upload.file_id, "message": str(exc)})
        ignored = state["ignored_fields"]
        document.values = [item for item in document.values if not any(_scope_matches(
            scope, file_id=upload.file_id, column=item.provenance.original_metric or item.provenance.column,
            row=item.provenance.row, sheet=item.provenance.sheet) for scope in ignored)]
        for item in document.values:
            item.provenance.source_document_id = upload.file_id
            item.provenance.evidence_quality = upload.evidence_quality
            item.provenance.evidence_quality_basis = upload.quality_basis
        documents.append(document.model_dump(mode="json"))
    return {"documents": documents, "errors": errors, "candidate_dataset": None, "dataset": None, "partial_acceptances": [],
            "trace": _trace(state, "extract_data"), "status": "PROCESSING"}


def map_to_schema(state: IntakeState) -> dict:
    pending = []
    for upload, raw_document in zip(state["uploads"], state["documents"]):
        document = ParsedDocument.model_validate(raw_document)
        for mapping_index, mapping in enumerate(document.mappings):
            uncertain = mapping.mapped_field is None or (mapping.mapping_method == "fuzzy" and (mapping.mapping_confidence or 0) < 0.98)
            if not uncertain:
                continue
            location = next((item for item in document.mapping_locations if item.mapping_index == mapping_index), None)
            sheet = location.sheet if location else next((item.provenance.sheet for item in document.values
                if item.provenance.row == mapping.row and (item.provenance.original_metric or item.provenance.column) == mapping.original_column), None)
            warnings = [item for item in document.warnings if item.original_column == mapping.original_column
                        and item.row == mapping.row and item.sheet == sheet]
            if any(_scope_matches(scope, file_id=upload["file_id"], column=mapping.original_column,
                                  row=mapping.row, sheet=sheet) for scope in state["ignored_fields"]):
                continue
            known = mapping.mapped_field
            if known is None and mapping.normalized_unit:
                known = map_column(mapping.original_column, mapping.normalized_unit)[0].mapped_field
            key = f"{upload['file_id']}|{sheet}|{mapping.row}|{mapping.original_column}"
            request = MappingRequest(
                request_id=sha256(key.encode()).hexdigest()[:24], file_id=upload["file_id"],
                original_column=mapping.original_column, row=mapping.row, sheet=sheet,
                detected_unit=mapping.detected_unit, deterministic_field=known,
                mapping_confidence=mapping.mapping_confidence,
                reason=warnings[0].message if warnings else "Close spelling match requires confirmation before acceptance.",
            )
            if request.request_id not in {item["request_id"] for item in pending}:
                pending.append(request.model_dump())
    return {"pending_mappings": pending, "suggestions": state["suggestions"] if pending else [],
            "trace": _trace(state, "map_to_schema")}


def validate_data(state: IntakeState) -> dict:
    errors = list(state["errors"])
    documents = [ParsedDocument.model_validate(item) for item in state["documents"]]
    duplicate_gaps = tools.detect_duplicate_evidence([Inspection.model_validate(item) for item in state["inspections"]], documents)
    candidate = None
    if not errors and not state["pending_mappings"] and not duplicate_gaps:
        try:
            dataset = normalize_documents(documents)
            tools.validate_financial_data(dataset)
            candidate = dataset.model_dump(mode="json")
        except ValueError as exc:
            errors.append({"stage": "validate_data", "file_id": None, "message": str(exc)})
    return {"candidate_dataset": candidate, "errors": errors, "gaps": [item.model_dump() for item in duplicate_gaps],
            "trace": _trace(state, "validate_data")}


def assess_confidence(state: IntakeState) -> dict:
    assessments = tools.assess_evidence_confidence(
        [Upload.model_validate(item) for item in state["uploads"]],
        [ParsedDocument.model_validate(item) for item in state["documents"]],
    )
    for request in state["pending_mappings"]:
        found = False
        for item in assessments:
            if item.file_id == request["file_id"] and item.row == request["row"] and item.column == request["original_column"] and item.sheet == request["sheet"]:
                found = True
                item.mapping_status = "DETERMINISTIC_UNCONFIRMED"
                item.confirmation_status = "REQUIRES_CONFIRMATION"
        if not found:
            upload = next(item for item in state["uploads"] if item["file_id"] == request["file_id"])
            suggestion = next((item for item in state["suggestions"] if item["request_id"] == request["request_id"]), {})
            ai_suggested = suggestion.get("mapping_method") == "ai_semantic_suggestion" and suggestion.get("suggested_field") is not None
            assessments.append(EvidenceAssessment(
                file_id=upload["file_id"], field=suggestion.get("suggested_field") or request["deterministic_field"] or request["original_column"],
                source_file=upload["filename"], row=request["row"], column=request["original_column"], sheet=request["sheet"],
                mapping_status="AI_MAPPED_UNCONFIRMED" if ai_suggested else "DETERMINISTIC_UNCONFIRMED",
                mapping_confidence=request["mapping_confidence"], semantic_confidence=suggestion.get("confidence"),
                evidence_quality=upload["evidence_quality"], quality_basis=upload["quality_basis"],
                confirmation_status="REQUIRES_CONFIRMATION",
            ))
    return {"confidence": [item.model_dump() for item in assessments],
            "readiness": {key: value.model_dump() for key, value in tools.assess_readiness(None, []).items()},
            "status": "REQUIRES_CONFIRMATION" if state["pending_mappings"] and not state["errors"] else "PROCESSING",
            "trace": _trace(state, "assess_confidence")}


def request_confirmation(state: IntakeState) -> dict:
    response = interrupt({"status": "REQUIRES_CONFIRMATION", "requests": state["pending_mappings"],
                          "suggestions": state["suggestions"], "errors": state["errors"],
                          "instruction": "Confirm/correct a field and its explicit input unit, or explicitly ignore it. No values will be invented."})
    try:
        human = ConfirmationResponse.model_validate(response)
        requests = {item["request_id"]: MappingRequest.model_validate(item) for item in state["pending_mappings"]}
        ids = [item.request_id for item in human.decisions]
        if len(set(ids)) != len(ids) or any(key not in requests for key in ids):
            raise ValueError("Confirm only current unique mapping request IDs")
        confirmations, ignored = list(state["confirmations"]), list(state["ignored_fields"])
        now = datetime.now(timezone.utc)
        for decision in human.decisions:
            request = requests[decision.request_id]
            scope = {"file_id": request.file_id, "original_column": request.original_column,
                     "row": request.row, "sheet": request.sheet}
            if decision.action == "ignore":
                ignored.append({**scope, "actor": human.actor, "decided_at": now.isoformat()})
            else:
                ai_matched = any(item["request_id"] == request.request_id and item.get("suggested_field") == decision.mapped_field
                                 and item.get("mapping_method") == "ai_semantic_suggestion" for item in state["suggestions"])
                semantic_score = next((item.get("confidence") for item in state["suggestions"] if ai_matched and item["request_id"] == request.request_id), None)
                confirmed = ConfirmedMapping(
                    **{key: value for key, value in scope.items() if key != "file_id"},
                    mapped_field=decision.mapped_field, unit=decision.unit, actor=human.actor,
                    decided_at=now, ai_suggested=ai_matched,
                    semantic_confidence=semantic_score,
                )
                tools.validate_units(confirmed)
                confirmations = [item for item in confirmations if not _scope_matches(item, **{
                    "file_id": request.file_id, "column": request.original_column, "row": request.row, "sheet": request.sheet})]
                confirmations.append({"file_id": request.file_id, **confirmed.model_dump(mode="json")})
        return {"confirmations": confirmations, "ignored_fields": ignored,
                "errors": [], "status": "PROCESSING", "trace": _trace(state, "request_confirmation"),
                "decisions": [*state["decisions"], {"kind": "mapping_confirmation", **human.model_dump(), "decided_at": now.isoformat()}]}
    except ValueError:
        return {"status": "REQUIRES_CONFIRMATION", "errors": [{"stage": "human_confirmation", "file_id": None,
                "message": "Invalid confirmation. Use current request IDs, an existing field and a compatible explicit input unit."}],
                "trace": _trace(state, "request_confirmation")}


def check_completeness(state: IntakeState) -> dict:
    gaps = [EvidenceGap.model_validate(item) for item in state["gaps"]]
    dataset = NormalizedDataset.model_validate(state["candidate_dataset"]) if state["candidate_dataset"] else None
    if dataset is not None:
        gaps.extend(tools.find_evidence_gaps(dataset, state["requested_modules"]))
    for error in state["errors"]:
        gaps.append(EvidenceGap(gap_type="INVALID_EVIDENCE", severity="ERROR", message=error["message"],
                                recommended_action="Correct/replace or remove the invalid source file; validation cannot be waived."))
    if dataset is None and not gaps:
        gaps.append(EvidenceGap(gap_type="NO_VALID_DATA", severity="ERROR", message="No validated dataset is available.",
                                recommended_action="Upload supported business records."))
    readiness = tools.assess_readiness(dataset, gaps, blocked=bool(state["errors"]))
    needs_evidence = bool(gaps) or any(readiness[module].status != "READY" for module in state["requested_modules"])
    return {"gaps": [item.model_dump() for item in gaps], "readiness": {key: item.model_dump() for key, item in readiness.items()},
            "status": "REQUIRES_EVIDENCE" if needs_evidence else "PROCESSING", "trace": _trace(state, "check_completeness")}


def _can_continue_partial(state: IntakeState) -> bool:
    return (state["candidate_dataset"] is not None
            and not any(not item["stage"].startswith("human_") for item in state["errors"])
            and all(state["readiness"][module]["status"] != "BLOCKED" for module in state["requested_modules"]))


def request_evidence(state: IntakeState) -> dict:
    response = interrupt({"status": "REQUIRES_EVIDENCE", "gaps": state["gaps"], "readiness": state["readiness"],
                          "errors": state["errors"], "can_continue_incomplete": _can_continue_partial(state),
                          "instruction": "Upload/replace evidence, cancel, or explicitly continue PARTIAL data. BLOCKED readiness cannot be overridden."})
    try:
        human = EvidenceResponse.model_validate(response)
        decision = {"kind": "evidence_response", **human.model_dump(exclude={"uploads"}),
                    "decided_at": datetime.now(timezone.utc).isoformat(), "acknowledged_gaps": state["gaps"]}
        decisions = [*state["decisions"], decision]
        if human.action == "cancel":
            return {"status": "CANCELLED", "dataset": None, "decisions": decisions}
        if human.action == "continue_incomplete":
            if not _can_continue_partial(state):
                raise ValueError("BLOCKED readiness, invalid data and duplicate evidence cannot be waived")
            partial_modules = [module for module in state["requested_modules"] if state["readiness"][module]["status"] == "PARTIAL"]
            acceptances = list(state["partial_acceptances"])
            if partial_modules:
                acceptances.append({"actor": human.actor, "reason": human.reason, "decided_at": decision["decided_at"],
                                    "modules": partial_modules, "acknowledged_gaps": state["gaps"]})
            return {"status": "CONTINUE_INCOMPLETE", "decisions": decisions, "errors": [], "partial_acceptances": acceptances}
        current_ids = {item["file_id"] for item in state["uploads"]}
        if not set(human.remove_file_ids) <= current_ids:
            raise ValueError("Unknown file IDs cannot be removed")
        uploads = [item for item in state["uploads"] if item["file_id"] not in human.remove_file_ids]
        uploads.extend(item.model_dump() for item in human.uploads)
        ids = [item["file_id"] for item in uploads]
        if len(set(ids)) != len(ids):
            raise ValueError("Remove an old file explicitly before replacing its ID")
        return {"uploads": uploads, "confirmations": [item for item in state["confirmations"] if item["file_id"] not in human.remove_file_ids],
                "ignored_fields": [item for item in state["ignored_fields"] if item["file_id"] not in human.remove_file_ids],
                "errors": [], "status": "PROCESSING", "candidate_dataset": None, "dataset": None,
                "decisions": decisions, "trace": _trace(state, "request_evidence")}
    except ValueError:
        return {"status": "REQUIRES_EVIDENCE", "errors": [*state["errors"], {"stage": "human_evidence", "file_id": None,
                "message": "Invalid evidence response; correct evidence errors before continuing."}]}


def complete(state: IntakeState) -> dict:
    if state["candidate_dataset"] is None or state["pending_mappings"] or state["errors"]:
        raise ValueError("Cannot publish data that has not passed deterministic validation")
    accepted = {module for item in state["partial_acceptances"] for module in item["modules"]}
    if any(state["readiness"][module]["status"] == "BLOCKED" or
           state["readiness"][module]["status"] == "PARTIAL" and module not in accepted
           for module in state["requested_modules"]):
        raise ValueError("Requested analysis is BLOCKED or PARTIAL without explicit acceptance")
    return {"dataset": state["candidate_dataset"], "status": "COMPLETE_PARTIAL" if state["gaps"] else "COMPLETE",
            "trace": _trace(state, "complete")}


def build_intake_graph(*, checkpointer: Any = None, assistant: MappingAssistant | None = None):
    """Default checkpoints live in memory. Inject a durable saver for persistence.

    Use a unique configurable.thread_id per intake, then Command(resume=...) with
    that same ID. Input is IntakeInput; derived state must not come from uploads.
    """
    helper = assistant if assistant is not None else GeminiMappingAssistant()

    def semantic_mapping(state: IntakeState) -> dict:
        requests = [MappingRequest.model_validate(item) for item in state["pending_mappings"] if item["deterministic_field"] is None]
        suggestions, notice = suggest_schema_mapping(requests, helper)
        return {"suggestions": [item.model_dump() for item in suggestions],
                "notices": [*state["notices"], *([notice] if notice else [])], "trace": _trace(state, "suggest_schema_mapping")}

    workflow = StateGraph(IntakeState)
    for name, node in {
        "initialize": initialize, "inspect_files": inspect_files, "classify_documents": classify_documents,
        "select_extraction_tool": select_extraction_tool, "extract_data": extract_data,
        "map_to_schema": map_to_schema, "suggest_schema_mapping": semantic_mapping,
        "validate_data": validate_data, "assess_confidence": assess_confidence,
        "request_confirmation": request_confirmation, "check_completeness": check_completeness,
        "request_evidence": request_evidence, "complete": complete,
    }.items():
        workflow.add_node(name, node)
    workflow.add_edge(START, "initialize")
    for left, right in [("initialize", "inspect_files"), ("inspect_files", "classify_documents"),
                        ("classify_documents", "select_extraction_tool"), ("select_extraction_tool", "extract_data"),
                        ("extract_data", "map_to_schema"), ("suggest_schema_mapping", "validate_data"),
                        ("validate_data", "assess_confidence")]:
        workflow.add_edge(left, right)
    workflow.add_conditional_edges("map_to_schema", lambda state: "suggest_schema_mapping" if state["pending_mappings"] and not state["errors"] else "validate_data")
    workflow.add_conditional_edges("assess_confidence", lambda state: "request_confirmation" if state["status"] == "REQUIRES_CONFIRMATION" else "check_completeness")
    workflow.add_conditional_edges("request_confirmation", lambda state: "request_confirmation" if state["status"] == "REQUIRES_CONFIRMATION" else "extract_data")
    workflow.add_conditional_edges("check_completeness", lambda state: "request_evidence" if state["status"] == "REQUIRES_EVIDENCE" else "complete")
    workflow.add_conditional_edges("request_evidence", lambda state: END if state["status"] == "CANCELLED" else "complete" if state["status"] == "CONTINUE_INCOMPLETE" else "request_evidence" if state["status"] == "REQUIRES_EVIDENCE" else "inspect_files")
    workflow.add_edge("complete", END)
    return workflow.compile(checkpointer=checkpointer if checkpointer is not None else InMemorySaver(), name="greenbridge_data_intake")
