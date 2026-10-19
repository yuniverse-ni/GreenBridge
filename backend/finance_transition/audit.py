"""Deterministic Audit Logging for Finance + Transition calculations.

Every computation writes an auditable record containing:
- tool: the deterministic calculation function or endpoint invoked
- inputs_hash: SHA-256 hash of the sanitized input data
- formulas: list of mathematical accounting formulas used
- assumptions: explicitly disclosed baseline and economic assumptions
- timestamp: ISO 8601 UTC timestamp
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Optional
from pydantic import BaseModel, Field


class AuditRecord(BaseModel):
    tool: str
    inputs_hash: str
    formulas: list[str]
    assumptions: list[str] = Field(default_factory=list)
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


def compute_inputs_hash(data: Any) -> str:
    """Computes a deterministic SHA-256 hash of any JSON-serializable structure or Pydantic model."""
    if hasattr(data, "model_dump"):
        data = data.model_dump(mode="json")
    elif hasattr(data, "dict"):
        data = data.dict()

    try:
        serialized = json.dumps(data, sort_keys=True, default=str)
    except Exception:
        serialized = str(data)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def create_audit_record(
    tool: str,
    inputs: Any,
    formulas: list[str],
    assumptions: Optional[list[str]] = None,
) -> AuditRecord:
    return AuditRecord(
        tool=tool,
        inputs_hash=compute_inputs_hash(inputs),
        formulas=formulas,
        assumptions=assumptions or [],
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
