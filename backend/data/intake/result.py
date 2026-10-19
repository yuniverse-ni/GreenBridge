"""Convert private checkpoint state into a typed, JSON-safe public contract."""

from collections.abc import Mapping
from typing import Any

from ..models import NormalizedDataset, ParsedDocument, SMEMetadata
from .models import DataIntakeResult, ModuleReadiness, PartialAcceptance, ValueEvidence


def build_result(state: Mapping[str, Any]) -> DataIntakeResult:
    """No calculations, inference or downstream calls occur during export."""
    published = state.get("dataset")
    dataset = NormalizedDataset.model_validate(published) if published is not None else None
    # Do not expose provisional values from pending/failed extraction.
    evidence = []
    if dataset is not None:
        for raw_document in state.get("documents", []):
            for item in ParsedDocument.model_validate(raw_document).values:
                source = item.provenance
                evidence.append(ValueEvidence(
                    field=item.field, source_file=source.source_file, source_document_id=source.source_document_id,
                    original_column=source.column, original_metric=source.original_metric, row=source.row,
                    sheet=source.sheet, reporting_period=source.reporting_period,
                    original_value=source.original_value, original_unit=source.detected_unit,
                    normalized_value=item.value, normalized_unit=source.normalized_unit,
                    extraction_method=source.extraction_method, mapping_method=source.mapping_method,
                    mapping_confidence=source.mapping_confidence, semantic_confidence=source.semantic_confidence,
                    evidence_quality=source.evidence_quality, evidence_quality_basis=source.evidence_quality_basis,
                    confirmation_status=source.confirmation_status, confirmed_by=source.confirmed_by,
                    confirmed_at=source.confirmed_at,
                ))
    acceptances = [PartialAcceptance.model_validate(item) for item in state.get("partial_acceptances", [])]
    accepted = {module for item in acceptances for module in item.modules}
    readiness = {
        module: ModuleReadiness(**state.get("readiness", {}).get(module, {
            "status": "BLOCKED", "reasons": ["Readiness has not been assessed."]}),
            partial_accepted=dataset is not None and module in accepted
            and state.get("readiness", {}).get(module, {}).get("status") == "PARTIAL",
            may_proceed=dataset is not None and (state.get("readiness", {}).get(module, {}).get("status") == "READY"
                or state.get("readiness", {}).get(module, {}).get("status") == "PARTIAL" and module in accepted))
        for module in ("carbon_analysis", "financial_analysis", "transition_analysis")
    }
    requested = state.get("requested_modules", list(readiness))
    if state.get("status") == "CANCELLED":
        action = "BLOCK"
    elif state.get("pending_mappings") and not any(not item["stage"].startswith("human_") for item in state.get("errors", [])):
        action = "REQUEST_CONFIRMATION"
    elif any(readiness[module].status == "BLOCKED" for module in requested):
        action = "BLOCK"
    elif dataset is not None and all(readiness[module].may_proceed for module in requested):
        action = "PROCEED"
    else:
        action = "REQUEST_EVIDENCE"
    return DataIntakeResult(
        company=dataset.metadata if dataset is not None else NormalizedDataset.model_validate(state["candidate_dataset"]).metadata
        if state.get("candidate_dataset") is not None else SMEMetadata(),
        normalized_data=dataset, evidence=evidence, data_gaps=state.get("gaps", []), readiness=readiness,
        agent_next_action=action, requested_modules=requested, partial_acceptances=acceptances,
        mapping_requests=state.get("pending_mappings", []), suggestions=state.get("suggestions", []),
        errors=state.get("errors", []), notices=state.get("notices", []), intake_status=state.get("status", "PROCESSING"),
    )
