"""Combine parsed records into one company/reporting-year dataset.

Financial/metadata fields are snapshots: conflicting values fail. Energy values
are additive only across explicitly distinct, non-overlapping YYYY-MM periods.
A single annual energy total is also accepted. Duplicate/ambiguous imports fail
rather than silently double-count. No emissions, loan or EBITDA calculations.
"""

import re
from collections import defaultdict
from pathlib import Path
from typing import Iterable

from .models import FIELD_GROUPS, GROUP_MODELS, NormalizedDataset, ParsedDocument
from .parser import DataImportError, parse_file, parse_upload


def normalize_documents(documents: Iterable[ParsedDocument]) -> NormalizedDataset:
    grouped = defaultdict(list)
    mappings, unmapped_fields, warnings = [], [], []
    for document in documents:
        mappings.extend(document.mappings)
        unmapped_fields.extend(field for field in document.unmapped_fields if field not in unmapped_fields)
        warnings.extend(document.warnings)
        for item in document.values:
            # Revalidate even when callers construct ParsedDocument directly.
            GROUP_MODELS[FIELD_GROUPS[item.field]].model_validate({item.field: item.value})
            grouped[item.field].append(item)
    values = {group: {} for group in GROUP_MODELS}
    provenance = {}
    for field, items in grouped.items():
        group = FIELD_GROUPS[field]
        normalized = [getattr(GROUP_MODELS[group].model_validate({field: item.value}), field) for item in items]
        if group == "activity" and len(items) > 1:
            periods = [item.provenance.reporting_period for item in items]
            if (any(period is None or not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", period) for period in periods)
                    or len(set(periods)) != len(periods)):
                raise DataImportError(f"{field}: repeated activity requires distinct YYYY-MM reporting_period values")
            value = sum(normalized)
        else:
            if any(value != normalized[0] for value in normalized[1:]):
                raise DataImportError(f"{field}: conflicting snapshot values; split companies/years into separate datasets")
            value = normalized[0]
        values[group][field] = value
        provenance[field] = [item.provenance for item in items]
    year = values["metadata"].get("reporting_year")
    periods = [p.reporting_period for sources in provenance.values() for p in sources if p.reporting_period]
    # Explicit annual/monthly/ISO-date periods must refer to one reporting year.
    years = {int(period[:4]) for period in periods if re.fullmatch(r"\d{4}(?:-\d{2}(?:-\d{2})?)?", period)}
    if len(years) > 1 or year is not None and years and years != {year}:
        raise DataImportError("Reporting periods span or contradict the dataset reporting year")
    return NormalizedDataset(**values, provenance=provenance, mappings=mappings,
                             unmapped_fields=unmapped_fields, warnings=warnings)


def ingest_uploads(uploads: Iterable[tuple[str, bytes]]) -> NormalizedDataset:
    """In-memory entry point for a future upload endpoint; no storage or APIs."""
    return normalize_documents(parse_upload(content, filename) for filename, content in uploads)


def ingest_files(paths: Iterable[str | Path]) -> NormalizedDataset:
    return normalize_documents(parse_file(path) for path in paths)

