"""Composite production store wrapping Neo4j + Qdrant.

The production store keeps the deterministic local store as a hot in-memory
cache for fast scoring (BM25, traversal). Durable persistence happens in
Neo4j and vector retrieval in Qdrant. If either backend becomes unavailable
the store reports a degraded reason and continues to serve queries from the
local cache.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from ..config import KnowledgeSettings
from ..models import (
    ContextBundleRequest,
    KnowledgeContextBundle,
    KnowledgeExplainResponse,
    KnowledgeIngestRequest,
    KnowledgeIngestResponse,
    KnowledgeQueryRequest,
    KnowledgeQueryResponse,
    KnowledgeRebuildRequest,
    KnowledgeRebuildResponse,
    KnowledgeStatsResponse,
)
from ..store import KnowledgeGraphStore
from .neo4j_adapter import Neo4jAdapter
from .qdrant_adapter import QdrantAdapter

logger = logging.getLogger("finance_os_knowledge.production_store")


@dataclass
class ProductionKnowledgeStore:
    settings: KnowledgeSettings
    local: KnowledgeGraphStore = field(init=False)
    neo4j: Neo4jAdapter = field(init=False)
    qdrant: QdrantAdapter = field(init=False)
    degraded_reasons: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.local = KnowledgeGraphStore(settings=self.settings)
        self.neo4j = Neo4jAdapter(settings=self.settings)
        self.qdrant = QdrantAdapter(settings=self.settings)

    # Connection lifecycle -------------------------------------------------
    def connect(self) -> None:
        if not self.neo4j.connect():
            self._degrade("neo4j_unavailable")
        else:
            self.neo4j.ensure_schema()
        if not self.qdrant.connect():
            self._degrade("qdrant_unavailable")
        else:
            self.qdrant.ensure_collection()

    def close(self) -> None:
        self.neo4j.close()
        self.qdrant.close()

    def _degrade(self, reason: str) -> None:
        if reason not in self.degraded_reasons:
            self.degraded_reasons.append(reason)

    @property
    def degraded(self) -> bool:
        return bool(self.degraded_reasons) or not self.neo4j.available or not self.qdrant.available

    @property
    def is_production_active(self) -> bool:
        return self.neo4j.available and self.qdrant.available

    # Loading --------------------------------------------------------------
    def load(self) -> None:
        self.local.load()
        if self.neo4j.available:
            try:
                nodes, relations = self.neo4j.fetch_all()
                if nodes or relations:
                    from ..models import KnowledgeEntity, KnowledgeRelation, Provenance
                    import json as _json

                    self.local.entities.clear()
                    self.local.relations.clear()
                    for raw in nodes:
                        try:
                            data = dict(raw)
                            if "provenanceJson" in data:
                                data["provenance"] = _json.loads(data.pop("provenanceJson") or "[]")
                            if "metadataJson" in data:
                                data["metadata"] = _json.loads(data.pop("metadataJson") or "{}")
                            entity = KnowledgeEntity.model_validate(data)
                            self.local.entities[entity.id] = entity
                        except Exception:
                            continue
                    for raw in relations:
                        try:
                            data = dict(raw)
                            if "provenanceJson" in data:
                                data["provenance"] = _json.loads(data.pop("provenanceJson") or "[]")
                            if "metadataJson" in data:
                                data["metadata"] = _json.loads(data.pop("metadataJson") or "{}")
                            rel = KnowledgeRelation.model_validate(data)
                            self.local.relations[rel.id] = rel
                        except Exception:
                            continue
                    _ = Provenance  # silence unused
            except Exception as exc:
                logger.warning("neo4j hydrate failed: %s", type(exc).__name__)
                self._degrade("neo4j_hydrate_failed")

    # Write paths ----------------------------------------------------------
    def ingest(
        self, request: KnowledgeIngestRequest, *, request_id: str
    ) -> KnowledgeIngestResponse:
        response = self.local.ingest(request, request_id=request_id)
        if self.neo4j.available:
            self.neo4j.upsert_entities(request.entities)
            self.neo4j.upsert_relations(request.relations)
            if not self.neo4j.available:
                self._degrade(self.neo4j.last_error or "neo4j_write_failed")
        else:
            self._degrade("neo4j_unavailable")

        if self.qdrant.available:
            self.qdrant.upsert_entities(request.entities)
            self.qdrant.upsert_relations(request.relations)
            if not self.qdrant.available:
                self._degrade(self.qdrant.last_error or "qdrant_write_failed")
        else:
            self._degrade("qdrant_unavailable")
        return response

    def rebuild(
        self, request: KnowledgeRebuildRequest, *, request_id: str
    ) -> KnowledgeRebuildResponse:
        if not request.dry_run:
            if self.neo4j.available:
                self.neo4j.reset()
            if self.qdrant.available:
                self.qdrant.reset()
        response = self.local.rebuild(request, request_id=request_id)
        if not request.dry_run:
            entities = list(self.local.entities.values())
            relations = list(self.local.relations.values())
            if self.neo4j.available:
                self.neo4j.upsert_entities(entities)
                self.neo4j.upsert_relations(relations)
            if self.qdrant.available:
                self.qdrant.upsert_entities(entities)
                self.qdrant.upsert_relations(relations)
        return response

    # Read paths -----------------------------------------------------------
    def query(self, request: KnowledgeQueryRequest, *, request_id: str) -> KnowledgeQueryResponse:
        response = self.local.query(request, request_id=request_id)
        # Merge Qdrant vector scores back into the response so production
        # admin queries actually exercise the Qdrant retrieval lane.
        if self.qdrant.available and request.retrieval_mode in (None, "hybrid", "vector"):
            qdrant_scores = self.qdrant.search_entities(
                request.query,
                limit=max(request.max_results * 2, 16),
                scope=request.mode if request.mode != "internal" else None,
                min_confidence=request.filters.min_confidence,
            )
            if qdrant_scores:
                seen_ids = {hit.entity.id for hit in response.hits}
                for entity_id, score in qdrant_scores.items():
                    if entity_id not in seen_ids:
                        entity = self.local.entities.get(entity_id)
                        if not entity:
                            continue
                        from ..models import KnowledgeHit, RetrievalScore

                        response.hits.append(
                            KnowledgeHit(
                                entity=entity,
                                score=RetrievalScore(
                                    total=round(0.6 * score, 4),
                                    fulltext=0,
                                    vector=round(score, 4),
                                    graph=0,
                                    temporal=0,
                                    confidence=entity.confidence,
                                    provenance=0,
                                    relationWeight=0,
                                ),
                                why=["qdrant vector match"],
                                relations=[],
                                paths=[],
                                evidence=[],
                                contradictoryEvidence=[],
                            )
                        )
                response.hits.sort(key=lambda hit: hit.score.total, reverse=True)
                response.hits = response.hits[: request.max_results]
                metrics = dict(response.metrics)
                metrics["qdrantHitCount"] = len(qdrant_scores)
                response.metrics = metrics
        if self.degraded:
            response.degraded = True
            response.fallback_reason = (
                ",".join(self.degraded_reasons[:4]) or response.fallback_reason
            )
        return response

    def context_bundle(
        self, request: ContextBundleRequest, *, request_id: str
    ) -> KnowledgeContextBundle:
        bundle = self.local.context_bundle(request, request_id=request_id)
        if self.degraded:
            bundle.degraded = True
            bundle.fallback_reason = ",".join(self.degraded_reasons[:4]) or bundle.fallback_reason
        return bundle

    def explain(
        self,
        entity_or_relation_id: str,
        *,
        query: str | None,
        mode: str,
        request_id: str,
    ) -> KnowledgeExplainResponse:
        return self.local.explain(
            entity_or_relation_id,
            query=query,
            mode=mode,
            request_id=request_id,
        )

    def stats(self, *, request_id: str) -> KnowledgeStatsResponse:
        response = self.local.stats(request_id=request_id)
        # Override backend reporting to reflect the real production state.
        response.backend = "neo4j" if self.neo4j.available else "local-fallback"
        response.vector_backend = "qdrant" if self.qdrant.available else "local-hashing"
        if self.neo4j.available:
            neo_stats = self.neo4j.stats()
            if neo_stats.get("available"):
                response.entity_count = max(response.entity_count, int(neo_stats.get("nodes", 0)))
                response.relation_count = max(
                    response.relation_count, int(neo_stats.get("relations", 0))
                )
        if self.degraded:
            response.last_failure_reason = ",".join(self.degraded_reasons[:4])
        return response

    def health(self) -> dict[str, Any]:
        return {
            "neo4j": {
                "available": self.neo4j.available,
                "lastError": self.neo4j.last_error,
                "database": self.neo4j.database,
            },
            "qdrant": {
                "available": self.qdrant.available,
                "lastError": self.qdrant.last_error,
                "collection": self.qdrant.collection,
            },
            "degradedReasons": list(self.degraded_reasons),
            "productionActive": self.is_production_active,
        }
