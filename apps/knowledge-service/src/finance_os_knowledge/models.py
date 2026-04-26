from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .redaction import redact_value
from .schema import KnowledgeNodeType, KnowledgeRelationType, KnowledgeScope, NODE_TYPES, RELATION_TYPES


def utc_now() -> datetime:
    return datetime.now(UTC)


def stable_id(prefix: str) -> str:
    return f"{prefix}:{uuid4().hex}"


class KnowledgeBaseModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class Provenance(KnowledgeBaseModel):
    source: str
    source_type: str = Field(default="curated")
    source_ref: str | None = None
    source_url: str | None = None
    source_timestamp: datetime | None = None
    evidence_refs: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.75, ge=0, le=1)
    notes: str | None = None


class TemporalFields(KnowledgeBaseModel):
    observed_at: datetime | None = Field(default=None, alias="observedAt")
    valid_from: datetime | None = Field(default=None, alias="validFrom")
    valid_to: datetime | None = Field(default=None, alias="validTo")
    invalidated_at: datetime | None = Field(default=None, alias="invalidatedAt")
    superseded_by: str | None = Field(default=None, alias="supersededBy")
    source_timestamp: datetime | None = Field(default=None, alias="sourceTimestamp")
    ingestion_timestamp: datetime = Field(default_factory=utc_now, alias="ingestionTimestamp")


class KnowledgeEntity(TemporalFields):
    id: str
    type: KnowledgeNodeType
    label: str
    description: str = ""
    source: str = "finance-os"
    source_url: str | None = Field(default=None, alias="sourceUrl")
    source_ref: str | None = Field(default=None, alias="sourceRef")
    provenance: list[Provenance] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now, alias="createdAt")
    updated_at: datetime = Field(default_factory=utc_now, alias="updatedAt")
    confidence: float = Field(default=0.75, ge=0, le=1)
    severity: float | None = Field(default=None, ge=0, le=100)
    impact: float | None = Field(default=None, ge=0, le=100)
    tags: list[str] = Field(default_factory=list)
    scope: KnowledgeScope = "admin"
    hash: str | None = None
    dedupe_key: str | None = Field(default=None, alias="dedupeKey")
    raw_payload: dict[str, Any] | None = Field(default=None, alias="rawPayload")
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        if value not in NODE_TYPES:
            raise ValueError(f"Unsupported node type: {value}")
        return value

    @field_validator("raw_payload")
    @classmethod
    def redact_payload(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        return redact_value(value) if value is not None else None


class KnowledgeRelation(TemporalFields):
    id: str
    type: KnowledgeRelationType
    from_id: str = Field(alias="fromId")
    to_id: str = Field(alias="toId")
    label: str | None = None
    description: str = ""
    source: str = "finance-os"
    source_url: str | None = Field(default=None, alias="sourceUrl")
    source_ref: str | None = Field(default=None, alias="sourceRef")
    provenance: list[Provenance] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now, alias="createdAt")
    updated_at: datetime = Field(default_factory=utc_now, alias="updatedAt")
    confidence: float = Field(default=0.75, ge=0, le=1)
    weight: float = Field(default=1.0, ge=0, le=1)
    severity: float | None = Field(default=None, ge=0, le=100)
    impact: float | None = Field(default=None, ge=0, le=100)
    tags: list[str] = Field(default_factory=list)
    scope: KnowledgeScope = "admin"
    hash: str | None = None
    dedupe_key: str | None = Field(default=None, alias="dedupeKey")
    raw_payload: dict[str, Any] | None = Field(default=None, alias="rawPayload")
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        if value not in RELATION_TYPES:
            raise ValueError(f"Unsupported relation type: {value}")
        return value

    @field_validator("raw_payload")
    @classmethod
    def redact_payload(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        return redact_value(value) if value is not None else None


class KnowledgeObservation(KnowledgeBaseModel):
    id: str = Field(default_factory=lambda: stable_id("observation"))
    kind: Literal["event", "snapshot", "assumption", "contradiction", "evidence"]
    entity_ids: list[str] = Field(default_factory=list, alias="entityIds")
    relation_ids: list[str] = Field(default_factory=list, alias="relationIds")
    summary: str
    observed_at: datetime = Field(default_factory=utc_now, alias="observedAt")
    confidence: float = Field(default=0.75, ge=0, le=1)
    provenance: list[Provenance] = Field(default_factory=list)
    scope: KnowledgeScope = "admin"
    metadata: dict[str, Any] = Field(default_factory=dict)


class KnowledgeIngestRequest(KnowledgeBaseModel):
    mode: KnowledgeScope = "admin"
    source: str = "finance-os"
    entities: list[KnowledgeEntity] = Field(default_factory=list)
    relations: list[KnowledgeRelation] = Field(default_factory=list)
    observations: list[KnowledgeObservation] = Field(default_factory=list)
    rebuildable: bool = True


class KnowledgeIngestResponse(KnowledgeBaseModel):
    ok: bool = True
    request_id: str = Field(alias="requestId")
    inserted_entities: int = Field(alias="insertedEntities")
    updated_entities: int = Field(alias="updatedEntities")
    inserted_relations: int = Field(alias="insertedRelations")
    updated_relations: int = Field(alias="updatedRelations")
    dedupe_count: int = Field(alias="dedupeCount")
    superseded_count: int = Field(alias="supersededCount")
    contradiction_count: int = Field(alias="contradictionCount")


class KnowledgeQueryFilters(KnowledgeBaseModel):
    domain: list[str] | None = None
    entity_type: list[KnowledgeNodeType] | None = Field(default=None, alias="entityType")
    source: list[str] | None = None
    scope: KnowledgeScope | None = None
    tags: list[str] | None = None
    min_confidence: float | None = Field(default=None, alias="minConfidence", ge=0, le=1)
    from_time: datetime | None = Field(default=None, alias="from")
    to_time: datetime | None = Field(default=None, alias="to")
    include_historical: bool = Field(default=True, alias="includeHistorical")


class KnowledgeQueryRequest(KnowledgeBaseModel):
    query: str
    mode: KnowledgeScope = "admin"
    filters: KnowledgeQueryFilters = Field(default_factory=KnowledgeQueryFilters)
    max_results: int = Field(default=12, alias="maxResults", ge=1, le=64)
    max_path_depth: int | None = Field(default=None, alias="maxPathDepth", ge=0, le=5)
    retrieval_mode: Literal["hybrid", "graph", "vector", "fulltext"] | None = Field(
        default=None, alias="retrievalMode"
    )
    include_contradictions: bool = Field(default=True, alias="includeContradictions")
    include_evidence: bool = Field(default=True, alias="includeEvidence")


class RetrievalScore(KnowledgeBaseModel):
    total: float
    fulltext: float = 0
    vector: float = 0
    graph: float = 0
    temporal: float = 0
    confidence: float = 0
    provenance: float = 0
    relation_weight: float = Field(default=0, alias="relationWeight")


class KnowledgePathStep(KnowledgeBaseModel):
    entity: KnowledgeEntity
    via_relation: KnowledgeRelation | None = Field(default=None, alias="viaRelation")


class KnowledgePath(KnowledgeBaseModel):
    path_id: str = Field(alias="pathId")
    steps: list[KnowledgePathStep]
    score: float
    explanation: str


class KnowledgeHit(KnowledgeBaseModel):
    entity: KnowledgeEntity
    score: RetrievalScore
    why: list[str]
    relations: list[KnowledgeRelation] = Field(default_factory=list)
    paths: list[KnowledgePath] = Field(default_factory=list)
    evidence: list[KnowledgeEntity] = Field(default_factory=list)
    contradictory_evidence: list[KnowledgeEntity] = Field(
        default_factory=list, alias="contradictoryEvidence"
    )


class KnowledgeQueryResponse(KnowledgeBaseModel):
    ok: bool = True
    request_id: str = Field(alias="requestId")
    mode: KnowledgeScope
    query: str
    retrieval_mode: str = Field(alias="retrievalMode")
    generated_at: datetime = Field(default_factory=utc_now, alias="generatedAt")
    hits: list[KnowledgeHit]
    metrics: dict[str, Any]
    degraded: bool = False
    fallback_reason: str | None = Field(default=None, alias="fallbackReason")


class ContextBundleRequest(KnowledgeQueryRequest):
    max_tokens: int | None = Field(default=None, alias="maxTokens", ge=128, le=12000)
    advisor_task: str | None = Field(default=None, alias="advisorTask")


class CompactContextItem(KnowledgeBaseModel):
    id: str
    type: str
    title: str
    summary: str
    confidence: float
    recency: float
    provenance_refs: list[str] = Field(default_factory=list, alias="provenanceRefs")
    why: list[str] = Field(default_factory=list)


class KnowledgeContextBundle(KnowledgeBaseModel):
    request_id: str = Field(alias="requestId")
    mode: KnowledgeScope
    generated_at: datetime = Field(default_factory=utc_now, alias="generatedAt")
    query: str
    max_tokens: int = Field(alias="maxTokens")
    token_estimate: int = Field(alias="tokenEstimate")
    summary: str
    entities: list[CompactContextItem]
    relations: list[KnowledgeRelation]
    graph_paths: list[KnowledgePath] = Field(alias="graphPaths")
    evidence: list[CompactContextItem]
    contradictory_evidence: list[CompactContextItem] = Field(alias="contradictoryEvidence")
    assumptions: list[CompactContextItem]
    unknowns: list[str]
    retrieval_explanation: list[str] = Field(alias="retrievalExplanation")
    confidence: float
    recency: float
    provenance: list[Provenance]
    degraded: bool = False
    fallback_reason: str | None = Field(default=None, alias="fallbackReason")


class KnowledgeRebuildRequest(KnowledgeBaseModel):
    mode: KnowledgeScope = "admin"
    include_seed: bool = Field(default=True, alias="includeSeed")
    sources: list[str] = Field(default_factory=list)
    dry_run: bool = Field(default=False, alias="dryRun")


class KnowledgeRebuildResponse(KnowledgeBaseModel):
    ok: bool = True
    request_id: str = Field(alias="requestId")
    dry_run: bool = Field(alias="dryRun")
    started_at: datetime = Field(alias="startedAt")
    finished_at: datetime = Field(alias="finishedAt")
    duration_ms: int = Field(alias="durationMs")
    entity_count: int = Field(alias="entityCount")
    relation_count: int = Field(alias="relationCount")
    dedupe_count: int = Field(alias="dedupeCount")


class KnowledgeExplainRequest(KnowledgeBaseModel):
    id: str
    query: str | None = None
    mode: KnowledgeScope = "admin"


class KnowledgeExplainResponse(KnowledgeBaseModel):
    ok: bool = True
    request_id: str = Field(alias="requestId")
    id: str
    explanation: str
    score: RetrievalScore | None = None
    entity: KnowledgeEntity | None = None
    relation: KnowledgeRelation | None = None
    paths: list[KnowledgePath] = Field(default_factory=list)
    evidence: list[KnowledgeEntity] = Field(default_factory=list)
    contradictory_evidence: list[KnowledgeEntity] = Field(
        default_factory=list, alias="contradictoryEvidence"
    )


class HealthResponse(KnowledgeBaseModel):
    status: Literal["ok", "degraded", "unavailable"]
    service: str
    backend: str
    vector_enabled: bool = Field(alias="vectorEnabled")
    fulltext_enabled: bool = Field(alias="fulltextEnabled")
    temporal_enabled: bool = Field(alias="temporalEnabled")
    request_id: str = Field(alias="requestId")
    timestamp: datetime


class VersionResponse(KnowledgeBaseModel):
    service: str
    version: str
    schema_version: str = Field(alias="schemaVersion")
    graph_backend: str = Field(alias="graphBackend")
    vector_backend: str = Field(alias="vectorBackend")


class KnowledgeStatsResponse(KnowledgeBaseModel):
    ok: bool = True
    request_id: str = Field(alias="requestId")
    generated_at: datetime = Field(default_factory=utc_now, alias="generatedAt")
    backend: str
    vector_backend: str = Field(alias="vectorBackend")
    entity_count: int = Field(alias="entityCount")
    relation_count: int = Field(alias="relationCount")
    historical_entity_count: int = Field(alias="historicalEntityCount")
    historical_relation_count: int = Field(alias="historicalRelationCount")
    source_counts: dict[str, int] = Field(alias="sourceCounts")
    entity_type_counts: dict[str, int] = Field(alias="entityTypeCounts")
    relation_type_counts: dict[str, int] = Field(alias="relationTypeCounts")
    contradiction_count: int = Field(alias="contradictionCount")
    superseded_fact_count: int = Field(alias="supersededFactCount")
    dedupe_count: int = Field(alias="dedupeCount")
    ingest_count: int = Field(alias="ingestCount")
    last_ingest_at: datetime | None = Field(default=None, alias="lastIngestAt")
    last_successful_rebuild_at: datetime | None = Field(
        default=None, alias="lastSuccessfulRebuildAt"
    )
    last_failure_reason: str | None = Field(default=None, alias="lastFailureReason")
    query_latency_ms: float = Field(alias="queryLatencyMs")
    graph_traversal_latency_ms: float = Field(alias="graphTraversalLatencyMs")
    vector_retrieval_latency_ms: float = Field(alias="vectorRetrievalLatencyMs")
    fulltext_retrieval_latency_ms: float = Field(alias="fulltextRetrievalLatencyMs")
    context_bundle_token_estimate: int = Field(alias="contextBundleTokenEstimate")
    rebuild_duration_ms: int = Field(alias="rebuildDurationMs")
    fallback_usage_count: int = Field(alias="fallbackUsageCount")
    storage_size_bytes: int = Field(alias="storageSizeBytes")
