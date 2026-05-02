"""AI Advisor recommendation/assumption ingestion.

Maps deterministic advisor recommendations and the assumptions/evidence
that justify them into Recommendation/Assumption/Evidence nodes with
JUSTIFIES/REQUIRES_ASSUMPTION/SUPPORTED_BY relations.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from ..models import (
    KnowledgeEntity,
    KnowledgeIngestRequest,
    KnowledgeRelation,
    KnowledgeScope,
    utc_now,
)
from ._common import base_provenance, clamp_text, stable_node_id, stable_relation_id


class AdvisorAssumptionInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    summary: str
    confidence: float = 0.7


class AdvisorEvidenceInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    summary: str
    source: str = "finance-os-advisor"
    confidence: float = 0.75


class AdvisorRecommendationInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    title: str
    summary: str = ""
    category: str
    severity: float | None = None
    confidence: float = 0.7
    generated_at: datetime | None = Field(default=None, alias="generatedAt")
    assumptions: list[AdvisorAssumptionInput] = Field(default_factory=list)
    evidence: list[AdvisorEvidenceInput] = Field(default_factory=list)
    contradicting_evidence: list[AdvisorEvidenceInput] = Field(
        default_factory=list, alias="contradictingEvidence"
    )
    tags: list[str] = Field(default_factory=list)


class AdvisorIngestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    mode: KnowledgeScope = "admin"
    source: str = "finance-os-advisor"
    snapshot_id: str | None = Field(default=None, alias="snapshotId")
    recommendations: list[AdvisorRecommendationInput] = Field(default_factory=list)


def _evidence_node(
    item: AdvisorEvidenceInput, mode: KnowledgeScope, *, kind: str
) -> KnowledgeEntity:
    node_id = stable_node_id("advisor:evidence", item.id, item.summary)
    return KnowledgeEntity(
        id=node_id,
        type="Evidence",
        label=clamp_text(item.summary, max_length=160),
        description=clamp_text(item.summary, max_length=480),
        source=item.source,
        confidence=item.confidence,
        scope=mode,
        tags=["evidence", kind],
        observedAt=utc_now(),
        provenance=[
            base_provenance(
                source=item.source,
                source_type="evidence",
                source_ref=f"evidence:{item.id}",
                confidence=item.confidence,
            )
        ],
    )


def _assumption_node(item: AdvisorAssumptionInput, mode: KnowledgeScope) -> KnowledgeEntity:
    node_id = stable_node_id("advisor:assumption", item.id, item.summary)
    return KnowledgeEntity(
        id=node_id,
        type="Assumption",
        label=clamp_text(item.summary, max_length=160),
        description=clamp_text(item.summary, max_length=480),
        source="finance-os-advisor",
        confidence=item.confidence,
        scope=mode,
        tags=["assumption", "advisor"],
        observedAt=utc_now(),
        provenance=[
            base_provenance(
                source="finance-os-advisor",
                source_type="assumption",
                source_ref=f"assumption:{item.id}",
                confidence=item.confidence,
            )
        ],
    )


def build_advisor_ingest(request: AdvisorIngestRequest) -> KnowledgeIngestRequest:
    entities: list[KnowledgeEntity] = []
    relations: list[KnowledgeRelation] = []
    seen: set[str] = set()

    for recommendation in request.recommendations:
        rec_id = stable_node_id("advisor:rec", recommendation.id, recommendation.title)
        rec = KnowledgeEntity(
            id=rec_id,
            type="Recommendation",
            label=clamp_text(recommendation.title, max_length=160),
            description=clamp_text(recommendation.summary, max_length=480),
            source="finance-os-advisor",
            confidence=recommendation.confidence,
            severity=recommendation.severity,
            scope=request.mode,
            tags=[*recommendation.tags, recommendation.category, "advisor"],
            observedAt=recommendation.generated_at or utc_now(),
            sourceTimestamp=recommendation.generated_at,
            provenance=[
                base_provenance(
                    source="finance-os-advisor",
                    source_type="recommendation",
                    source_ref=f"rec:{recommendation.id}",
                    confidence=recommendation.confidence,
                    source_timestamp=recommendation.generated_at,
                )
            ],
            metadata={"category": recommendation.category, "snapshotId": request.snapshot_id},
        )
        if rec.id not in seen:
            entities.append(rec)
            seen.add(rec.id)

        for assumption in recommendation.assumptions:
            assumption_node = _assumption_node(assumption, request.mode)
            if assumption_node.id not in seen:
                entities.append(assumption_node)
                seen.add(assumption_node.id)
            rel_id = stable_relation_id("REQUIRES_ASSUMPTION", rec.id, assumption_node.id)
            relations.append(
                KnowledgeRelation(
                    id=rel_id,
                    type="REQUIRES_ASSUMPTION",
                    fromId=rec.id,
                    toId=assumption_node.id,
                    label=f"{rec.label} requires assumption",
                    description="",
                    source="finance-os-advisor",
                    confidence=assumption.confidence,
                    weight=0.86,
                    scope=request.mode,
                    tags=["advisor", "assumption"],
                    observedAt=utc_now(),
                    provenance=[
                        base_provenance(
                            source="finance-os-advisor",
                            source_type="assumption",
                            source_ref=f"rec_assumption:{rec.id}->{assumption_node.id}",
                            confidence=assumption.confidence,
                        )
                    ],
                )
            )

        for ev in recommendation.evidence:
            ev_node = _evidence_node(ev, request.mode, kind="supporting")
            if ev_node.id not in seen:
                entities.append(ev_node)
                seen.add(ev_node.id)
            rel_id = stable_relation_id("SUPPORTED_BY", rec.id, ev_node.id)
            relations.append(
                KnowledgeRelation(
                    id=rel_id,
                    type="SUPPORTED_BY",
                    fromId=rec.id,
                    toId=ev_node.id,
                    label=f"{rec.label} supported by evidence",
                    description="",
                    source="finance-os-advisor",
                    confidence=ev.confidence,
                    weight=1.0,
                    scope=request.mode,
                    tags=["advisor", "evidence", "supporting"],
                    observedAt=utc_now(),
                    provenance=[
                        base_provenance(
                            source="finance-os-advisor",
                            source_type="evidence",
                            source_ref=f"rec_evidence:{rec.id}->{ev_node.id}",
                            confidence=ev.confidence,
                        )
                    ],
                )
            )

        for ev in recommendation.contradicting_evidence:
            ev_node = _evidence_node(ev, request.mode, kind="contradicting")
            if ev_node.id not in seen:
                entities.append(ev_node)
                seen.add(ev_node.id)
            rel_id = stable_relation_id("CONTRADICTED_BY", rec.id, ev_node.id)
            relations.append(
                KnowledgeRelation(
                    id=rel_id,
                    type="CONTRADICTED_BY",
                    fromId=rec.id,
                    toId=ev_node.id,
                    label=f"{rec.label} contradicted by evidence",
                    description="",
                    source="finance-os-advisor",
                    confidence=ev.confidence,
                    weight=0.98,
                    scope=request.mode,
                    tags=["advisor", "evidence", "contradicting"],
                    observedAt=utc_now(),
                    provenance=[
                        base_provenance(
                            source="finance-os-advisor",
                            source_type="evidence",
                            source_ref=f"rec_contra:{rec.id}->{ev_node.id}",
                            confidence=ev.confidence,
                        )
                    ],
                )
            )

    return KnowledgeIngestRequest(
        mode=request.mode,
        source=request.source,
        entities=entities,
        relations=relations,
        observations=[],
    )
