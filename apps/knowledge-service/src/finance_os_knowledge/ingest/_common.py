from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Iterable

from ..models import Provenance


def stable_node_id(prefix: str, *parts: str | None) -> str:
    raw = "|".join(part or "" for part in parts) or prefix
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:24]
    return f"{prefix}:{digest}"


def stable_relation_id(rel_type: str, from_id: str, to_id: str, *extra: str | None) -> str:
    raw = "|".join([rel_type, from_id, to_id, *(part or "" for part in extra)])
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:24]
    return f"rel:{rel_type.lower()}:{digest}"


def base_provenance(
    *,
    source: str,
    source_type: str = "system",
    source_ref: str | None = None,
    source_url: str | None = None,
    confidence: float = 0.7,
    notes: str | None = None,
    source_timestamp: datetime | None = None,
    evidence_refs: Iterable[str] | None = None,
) -> Provenance:
    return Provenance(
        source=source,
        source_type=source_type,
        source_ref=source_ref,
        source_url=source_url,
        confidence=confidence,
        notes=notes,
        source_timestamp=source_timestamp,
        evidence_refs=list(evidence_refs or []),
    )


def clamp_text(value: str | None, *, max_length: int = 480) -> str:
    if not value:
        return ""
    cleaned = value.replace("\u0000", " ").strip()
    if len(cleaned) > max_length:
        return cleaned[: max_length - 1] + "…"
    return cleaned
