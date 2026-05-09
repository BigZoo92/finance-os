"""AI Advisor recommendation/assumption ingestion.

Maps deterministic advisor recommendations and the assumptions/evidence
that justify them into Recommendation/Assumption/Evidence nodes with
JUSTIFIES/REQUIRES_ASSUMPTION/SUPPORTED_BY relations.

PR8 also accepts DecisionPoint nodes (one per Postgres advisor_decision_journal
row) and LearningAction nodes (one per persisted advisor_post_mortem learning
action). All advisor-learning-loop nodes carry scope='advisory-only' as a tag
so downstream retrieval can never mistake them for execution directives.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from ..models import (
    KnowledgeEntity,
    KnowledgeIngestRequest,
    KnowledgeRelation,
    KnowledgeScope,
    utc_now,
)
from ._common import base_provenance, clamp_text, stable_node_id, stable_relation_id

ADVISORY_ONLY = "advisory-only"
FREE_NOTE_MAX = 480


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


DecisionKind = Literal["accepted", "rejected", "deferred", "ignored"]
LearningActionStatus = Literal["validates_recommendation", "invalidates_recommendation", "neutral"]


class AdvisorDecisionPointInput(BaseModel):
    """One row from advisor_decision_journal projected into the graph.

    `decision_id` is the canonical Postgres id and drives the stable graph id.
    `recommendation_key` is the advisor-side semantic key (preferred over the
    transient numeric `recommendationId` so DecisionPoint <-> Recommendation
    edges remain stable across recommendation regenerations).
    """

    model_config = ConfigDict(populate_by_name=True)
    decision_id: int = Field(alias="decisionId")
    decision: DecisionKind
    reason_code: str = Field(alias="reasonCode")
    decided_at: datetime = Field(alias="decidedAt")
    decided_by: str | None = Field(default=None, alias="decidedBy")
    expected_outcome_at: datetime | None = Field(default=None, alias="expectedOutcomeAt")
    recommendation_id: int | None = Field(default=None, alias="recommendationId")
    recommendation_key: str | None = Field(default=None, alias="recommendationKey")
    run_id: int | None = Field(default=None, alias="runId")
    free_note_excerpt: str | None = Field(default=None, alias="freeNoteExcerpt")


class AdvisorLearningActionInput(BaseModel):
    """One advisor learning action emitted by a completed post-mortem.

    Identity is derived from `(post_mortem_id, action_index)` so re-ingest of the
    same post-mortem is idempotent and so two distinct post-mortems with similar
    titles never collide.
    """

    model_config = ConfigDict(populate_by_name=True)
    post_mortem_id: int = Field(alias="postMortemId")
    action_index: int = Field(alias="actionIndex", ge=0)
    title: str
    description: str = ""
    applies_to: list[str] = Field(default_factory=list, alias="appliesTo")
    status: LearningActionStatus = "neutral"
    confidence: float = Field(default=0.6, ge=0, le=1)
    recommendation_id: int | None = Field(default=None, alias="recommendationId")
    recommendation_key: str | None = Field(default=None, alias="recommendationKey")
    decision_id: int | None = Field(default=None, alias="decisionId")
    run_id: int | None = Field(default=None, alias="runId")
    evaluated_at: datetime | None = Field(default=None, alias="evaluatedAt")


class AdvisorIngestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    mode: KnowledgeScope = "admin"
    source: str = "finance-os-advisor"
    snapshot_id: str | None = Field(default=None, alias="snapshotId")
    recommendations: list[AdvisorRecommendationInput] = Field(default_factory=list)
    decision_points: list[AdvisorDecisionPointInput] = Field(
        default_factory=list, alias="decisionPoints"
    )
    learning_actions: list[AdvisorLearningActionInput] = Field(
        default_factory=list, alias="learningActions"
    )


def recommendation_node_id(key_or_id: str | int) -> str:
    """Stable Recommendation node id, derived from the semantic key/id only.

    Title is intentionally excluded — titles can drift across re-generations
    while the recommendation_key remains stable. Journal and post-mortem
    hooks recompute this same id without needing the title.
    """

    return stable_node_id("advisor:rec", str(key_or_id))


def decision_point_node_id(decision_id: int) -> str:
    return stable_node_id("advisor:decision", str(decision_id))


def learning_action_node_id(post_mortem_id: int, action_index: int) -> str:
    return stable_node_id("advisor:learning-action", str(post_mortem_id), str(action_index))


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
        rec_id = recommendation_node_id(recommendation.id)
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

    for dp in request.decision_points:
        node_id = decision_point_node_id(dp.decision_id)
        label = clamp_text(
            f"Decision: {dp.decision} ({dp.reason_code})",
            max_length=160,
        )
        description_parts = [f"Decision {dp.decision} via reason `{dp.reason_code}`."]
        if dp.free_note_excerpt:
            description_parts.append(clamp_text(dp.free_note_excerpt, max_length=FREE_NOTE_MAX))
        decision_node = KnowledgeEntity(
            id=node_id,
            type="DecisionPoint",
            label=label,
            description=clamp_text(" ".join(description_parts), max_length=480),
            source="finance-os-advisor",
            confidence=0.85,
            scope=request.mode,
            tags=["advisor", "decision-journal", dp.decision, ADVISORY_ONLY],
            observedAt=dp.decided_at,
            sourceTimestamp=dp.decided_at,
            provenance=[
                base_provenance(
                    source="finance-os-advisor",
                    source_type="decision-journal",
                    source_ref=f"decision:{dp.decision_id}",
                    confidence=0.85,
                    source_timestamp=dp.decided_at,
                )
            ],
            metadata={
                "decision": dp.decision,
                "reasonCode": dp.reason_code,
                "decidedBy": dp.decided_by,
                "expectedOutcomeAt": (
                    dp.expected_outcome_at.isoformat() if dp.expected_outcome_at else None
                ),
                "recommendationKey": dp.recommendation_key,
                "recommendationId": dp.recommendation_id,
                "runId": dp.run_id,
                "scope": ADVISORY_ONLY,
            },
        )
        if decision_node.id not in seen:
            entities.append(decision_node)
            seen.add(decision_node.id)

        rec_pointer = dp.recommendation_key or (
            str(dp.recommendation_id) if dp.recommendation_id is not None else None
        )
        if rec_pointer:
            rec_id = recommendation_node_id(rec_pointer)
            rel_id = stable_relation_id("LEADS_TO", rec_id, decision_node.id)
            relations.append(
                KnowledgeRelation(
                    id=rel_id,
                    type="LEADS_TO",
                    fromId=rec_id,
                    toId=decision_node.id,
                    label="recommendation led to decision",
                    description="",
                    source="finance-os-advisor",
                    confidence=0.8,
                    weight=0.85,
                    scope=request.mode,
                    tags=["advisor", "decision-journal", ADVISORY_ONLY],
                    observedAt=dp.decided_at,
                    provenance=[
                        base_provenance(
                            source="finance-os-advisor",
                            source_type="decision-journal",
                            source_ref=f"rec->decision:{rec_pointer}->{dp.decision_id}",
                            confidence=0.8,
                            source_timestamp=dp.decided_at,
                        )
                    ],
                )
            )

    for la in request.learning_actions:
        node_id = learning_action_node_id(la.post_mortem_id, la.action_index)
        observed_at = la.evaluated_at or utc_now()
        action_node = KnowledgeEntity(
            id=node_id,
            type="LearningAction",
            label=clamp_text(la.title, max_length=160),
            description=clamp_text(la.description, max_length=FREE_NOTE_MAX),
            source="finance-os-advisor",
            confidence=la.confidence,
            scope=request.mode,
            tags=[
                "advisor",
                "post-mortem",
                "learning-action",
                la.status,
                ADVISORY_ONLY,
            ],
            observedAt=observed_at,
            sourceTimestamp=observed_at,
            provenance=[
                base_provenance(
                    source="finance-os-advisor",
                    source_type="post-mortem",
                    source_ref=f"post_mortem:{la.post_mortem_id}#{la.action_index}",
                    confidence=la.confidence,
                    source_timestamp=observed_at,
                )
            ],
            metadata={
                "postMortemId": la.post_mortem_id,
                "actionIndex": la.action_index,
                "status": la.status,
                "appliesTo": la.applies_to[:8],
                "decisionId": la.decision_id,
                "recommendationKey": la.recommendation_key,
                "recommendationId": la.recommendation_id,
                "runId": la.run_id,
                "scope": ADVISORY_ONLY,
            },
        )
        if action_node.id not in seen:
            entities.append(action_node)
            seen.add(action_node.id)

        rec_pointer = la.recommendation_key or (
            str(la.recommendation_id) if la.recommendation_id is not None else None
        )
        if rec_pointer:
            rec_id = recommendation_node_id(rec_pointer)
            if la.status == "validates_recommendation":
                rel_type = "VALIDATED_BY"
                weight = 0.94
                label = "recommendation validated by learning action"
            elif la.status == "invalidates_recommendation":
                rel_type = "INVALIDATED_BY"
                weight = 0.94
                label = "recommendation invalidated by learning action"
            else:
                rel_type = "SUPPORTS"
                weight = 0.7
                label = "learning action supports recommendation"
            from_id, to_id = (
                (rec_id, action_node.id)
                if rel_type in ("VALIDATED_BY", "INVALIDATED_BY")
                else (action_node.id, rec_id)
            )
            rel_id = stable_relation_id(rel_type, from_id, to_id)
            relations.append(
                KnowledgeRelation(
                    id=rel_id,
                    type=rel_type,
                    fromId=from_id,
                    toId=to_id,
                    label=label,
                    description="",
                    source="finance-os-advisor",
                    confidence=la.confidence,
                    weight=weight,
                    scope=request.mode,
                    tags=["advisor", "post-mortem", la.status, ADVISORY_ONLY],
                    observedAt=observed_at,
                    provenance=[
                        base_provenance(
                            source="finance-os-advisor",
                            source_type="post-mortem",
                            source_ref=f"learning_action->rec:{la.post_mortem_id}#{la.action_index}->{rec_pointer}",
                            confidence=la.confidence,
                            source_timestamp=observed_at,
                        )
                    ],
                )
            )

        if la.decision_id is not None:
            decision_id = decision_point_node_id(la.decision_id)
            rel_id = stable_relation_id("LEADS_TO", decision_id, action_node.id)
            relations.append(
                KnowledgeRelation(
                    id=rel_id,
                    type="LEADS_TO",
                    fromId=decision_id,
                    toId=action_node.id,
                    label="decision led to learning action",
                    description="",
                    source="finance-os-advisor",
                    confidence=la.confidence,
                    weight=0.7,
                    scope=request.mode,
                    tags=["advisor", "post-mortem", "learning-action", ADVISORY_ONLY],
                    observedAt=observed_at,
                    provenance=[
                        base_provenance(
                            source="finance-os-advisor",
                            source_type="post-mortem",
                            source_ref=f"decision->learning_action:{la.decision_id}->{la.post_mortem_id}#{la.action_index}",
                            confidence=la.confidence,
                            source_timestamp=observed_at,
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
