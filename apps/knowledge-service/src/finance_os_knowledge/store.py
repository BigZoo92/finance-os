from __future__ import annotations

import hashlib
import json
import math
import re
import time
from collections import Counter, defaultdict, deque
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .config import KnowledgeSettings
from .models import (
    CompactContextItem,
    ContextBundleRequest,
    KnowledgeContextBundle,
    KnowledgeEntity,
    KnowledgeExplainResponse,
    KnowledgeHit,
    KnowledgeIngestRequest,
    KnowledgeIngestResponse,
    KnowledgePath,
    KnowledgePathStep,
    KnowledgeQueryRequest,
    KnowledgeQueryResponse,
    KnowledgeRelation,
    KnowledgeRebuildRequest,
    KnowledgeRebuildResponse,
    KnowledgeStatsResponse,
    Provenance,
    RetrievalScore,
    utc_now,
)
from .schema import RELATION_WEIGHTS, SCHEMA_VERSION
from .seed import build_seed_ingest

TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9_\-+.]*", re.IGNORECASE)
VECTOR_DIMS = 256


def _tokens(value: str) -> list[str]:
    return [match.group(0).lower() for match in TOKEN_RE.finditer(value)]


def _entity_text(entity: KnowledgeEntity) -> str:
    metadata_text = " ".join(str(value) for value in entity.metadata.values() if value is not None)
    return " ".join([entity.id, entity.type, entity.label, entity.description, *entity.tags, metadata_text])


def _relation_text(relation: KnowledgeRelation) -> str:
    return " ".join([relation.id, relation.type, relation.label or "", relation.description, *relation.tags])


def _hash_payload(value: dict[str, Any]) -> str:
    encoded = json.dumps(value, sort_keys=True, default=str, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _content_hash(model: KnowledgeEntity | KnowledgeRelation) -> str:
    return _hash_payload(
        model.model_dump(
            by_alias=True,
            mode="json",
            exclude={
                "created_at",
                "updated_at",
                "ingestion_timestamp",
                "hash",
                "dedupe_key",
            },
        )
    )


def _cosine_from_tokens(left: list[str], right: list[str]) -> float:
    if not left or not right:
        return 0

    left_vector = [0.0] * VECTOR_DIMS
    right_vector = [0.0] * VECTOR_DIMS

    for token in left:
        left_vector[int(hashlib.blake2b(token.encode(), digest_size=2).hexdigest(), 16) % VECTOR_DIMS] += 1

    for token in right:
        right_vector[int(hashlib.blake2b(token.encode(), digest_size=2).hexdigest(), 16) % VECTOR_DIMS] += 1

    dot = sum(a * b for a, b in zip(left_vector, right_vector, strict=True))
    left_norm = math.sqrt(sum(a * a for a in left_vector))
    right_norm = math.sqrt(sum(b * b for b in right_vector))
    if left_norm == 0 or right_norm == 0:
        return 0

    return dot / (left_norm * right_norm)


def _now_ms() -> float:
    return time.perf_counter() * 1000


def _temporal_anchor(entity: KnowledgeEntity | KnowledgeRelation) -> datetime:
    return (
        entity.observed_at
        or entity.source_timestamp
        or entity.valid_from
        or entity.updated_at
        or entity.ingestion_timestamp
    )


def _recency_score(value: KnowledgeEntity | KnowledgeRelation, *, half_life_days: float) -> float:
    anchor = _temporal_anchor(value)
    age_days = max((utc_now() - anchor).total_seconds() / 86400, 0)
    if half_life_days <= 0:
        return 1
    return math.pow(0.5, age_days / half_life_days)


@dataclass
class StoreMetrics:
    ingest_count: int = 0
    dedupe_count: int = 0
    contradiction_count: int = 0
    superseded_fact_count: int = 0
    fallback_usage_count: int = 0
    last_ingest_at: datetime | None = None
    last_successful_rebuild_at: datetime | None = None
    last_failure_reason: str | None = None
    query_latency_ms: float = 0
    graph_traversal_latency_ms: float = 0
    vector_retrieval_latency_ms: float = 0
    fulltext_retrieval_latency_ms: float = 0
    context_bundle_token_estimate: int = 0
    rebuild_duration_ms: int = 0
    query_count: int = 0


@dataclass
class KnowledgeGraphStore:
    settings: KnowledgeSettings
    entities: dict[str, KnowledgeEntity] = field(default_factory=dict)
    relations: dict[str, KnowledgeRelation] = field(default_factory=dict)
    historical_entities: list[KnowledgeEntity] = field(default_factory=list)
    historical_relations: list[KnowledgeRelation] = field(default_factory=list)
    observations: list[dict[str, Any]] = field(default_factory=list)
    metrics: StoreMetrics = field(default_factory=StoreMetrics)

    def storage_file(self) -> Path:
        return self.settings.graph_storage_path / "graph.json"

    def load(self) -> None:
        path = self.storage_file()
        if not path.exists():
            return

        data = json.loads(path.read_text(encoding="utf-8"))
        self.entities = {
            item["id"]: KnowledgeEntity.model_validate(item) for item in data.get("entities", [])
        }
        self.relations = {
            item["id"]: KnowledgeRelation.model_validate(item) for item in data.get("relations", [])
        }
        self.historical_entities = [
            KnowledgeEntity.model_validate(item) for item in data.get("historicalEntities", [])
        ]
        self.historical_relations = [
            KnowledgeRelation.model_validate(item) for item in data.get("historicalRelations", [])
        ]
        self.observations = data.get("observations", [])

    def save(self) -> None:
        self.settings.graph_storage_path.mkdir(parents=True, exist_ok=True)
        payload = {
            "schemaVersion": SCHEMA_VERSION,
            "savedAt": utc_now().isoformat(),
            "entities": [item.model_dump(by_alias=True, mode="json") for item in self.entities.values()],
            "relations": [item.model_dump(by_alias=True, mode="json") for item in self.relations.values()],
            "historicalEntities": [
                item.model_dump(by_alias=True, mode="json") for item in self.historical_entities
            ],
            "historicalRelations": [
                item.model_dump(by_alias=True, mode="json") for item in self.historical_relations
            ],
            "observations": self.observations,
        }
        self.storage_file().write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")

    def reset(self) -> None:
        self.entities.clear()
        self.relations.clear()
        self.historical_entities.clear()
        self.historical_relations.clear()
        self.observations.clear()

    def ingest(self, request: KnowledgeIngestRequest, *, request_id: str) -> KnowledgeIngestResponse:
        inserted_entities = 0
        updated_entities = 0
        inserted_relations = 0
        updated_relations = 0
        dedupe_count = 0
        superseded_count = 0
        contradiction_count = 0

        for entity in request.entities:
            entity_hash = entity.hash or _content_hash(entity)
            entity.hash = entity_hash
            existing = self.entities.get(entity.id)
            if existing and existing.hash == entity_hash:
                dedupe_count += 1
                continue
            if existing:
                historical = existing.model_copy(deep=True)
                historical.valid_to = entity.valid_from or entity.observed_at or utc_now()
                historical.invalidated_at = entity.invalidated_at
                historical.superseded_by = entity.id
                self.historical_entities.append(historical)
                updated_entities += 1
                superseded_count += 1
            else:
                inserted_entities += 1

            entity.updated_at = utc_now()
            self.entities[entity.id] = entity

        for relation in request.relations:
            relation_hash = relation.hash or _content_hash(relation)
            relation.hash = relation_hash
            existing = self.relations.get(relation.id)
            if existing and existing.hash == relation_hash:
                dedupe_count += 1
                continue
            if existing:
                historical = existing.model_copy(deep=True)
                historical.valid_to = relation.valid_from or relation.observed_at or utc_now()
                historical.invalidated_at = relation.invalidated_at
                historical.superseded_by = relation.id
                self.historical_relations.append(historical)
                updated_relations += 1
                superseded_count += 1
            else:
                inserted_relations += 1

            if relation.type == "CONTRADICTED_BY":
                contradiction_count += 1
            relation.updated_at = utc_now()
            self.relations[relation.id] = relation

        for observation in request.observations:
            payload = observation.model_dump(by_alias=True, mode="json")
            self.observations.append(payload)
            if observation.kind == "contradiction":
                contradiction_count += 1

        self.metrics.ingest_count += 1
        self.metrics.dedupe_count += dedupe_count
        self.metrics.superseded_fact_count += superseded_count
        self.metrics.contradiction_count += contradiction_count
        self.metrics.last_ingest_at = utc_now()
        self.save()

        return KnowledgeIngestResponse(
            requestId=request_id,
            insertedEntities=inserted_entities,
            updatedEntities=updated_entities,
            insertedRelations=inserted_relations,
            updatedRelations=updated_relations,
            dedupeCount=dedupe_count,
            supersededCount=superseded_count,
            contradictionCount=contradiction_count,
        )

    def rebuild(self, request: KnowledgeRebuildRequest, *, request_id: str) -> KnowledgeRebuildResponse:
        started = utc_now()
        start_ms = _now_ms()
        snapshot = (self.entities.copy(), self.relations.copy(), list(self.historical_entities), list(self.historical_relations))

        try:
            if not request.dry_run:
                self.reset()

            if request.include_seed:
                target = self if not request.dry_run else KnowledgeGraphStore(settings=self.settings)
                target.ingest(build_seed_ingest(request.mode), request_id=request_id)
                entity_count = len(target.entities)
                relation_count = len(target.relations)
                dedupe_count = target.metrics.dedupe_count
            else:
                entity_count = len(self.entities)
                relation_count = len(self.relations)
                dedupe_count = 0

            finished = utc_now()
            duration_ms = int(_now_ms() - start_ms)
            if not request.dry_run:
                self.metrics.last_successful_rebuild_at = finished
                self.metrics.rebuild_duration_ms = duration_ms
                self.save()

            return KnowledgeRebuildResponse(
                requestId=request_id,
                dryRun=request.dry_run,
                startedAt=started,
                finishedAt=finished,
                durationMs=duration_ms,
                entityCount=entity_count,
                relationCount=relation_count,
                dedupeCount=dedupe_count,
            )
        except Exception as exc:
            self.metrics.last_failure_reason = "rebuild_failed"
            if not request.dry_run:
                self.entities, self.relations, self.historical_entities, self.historical_relations = snapshot
            raise exc

    def _filter_entities(self, request: KnowledgeQueryRequest) -> list[KnowledgeEntity]:
        filters = request.filters
        candidates = list(self.entities.values())
        if filters.include_historical:
            candidates += self.historical_entities

        def allowed(entity: KnowledgeEntity) -> bool:
            if entity.scope not in (request.mode, "demo"):
                return False
            if filters.scope and entity.scope != filters.scope:
                return False
            if filters.entity_type and entity.type not in filters.entity_type:
                return False
            if filters.source and entity.source not in filters.source:
                return False
            if filters.tags and not set(filters.tags).intersection(entity.tags):
                return False
            if filters.domain and not set(filters.domain).intersection(entity.tags):
                return False
            if filters.min_confidence is not None and entity.confidence < filters.min_confidence:
                return False
            if filters.from_time and _temporal_anchor(entity) < filters.from_time:
                return False
            if filters.to_time and _temporal_anchor(entity) > filters.to_time:
                return False
            return True

        return [entity for entity in candidates if allowed(entity)]

    def _bm25_scores(self, query_tokens: list[str], entities: list[KnowledgeEntity]) -> dict[str, float]:
        if not query_tokens or not entities:
            return {}

        document_tokens = {entity.id: _tokens(_entity_text(entity)) for entity in entities}
        avg_len = sum(len(tokens) for tokens in document_tokens.values()) / max(len(document_tokens), 1)
        doc_freq = Counter()
        for tokens in document_tokens.values():
            doc_freq.update(set(tokens))

        scores: dict[str, float] = {}
        k1 = 1.4
        b = 0.72
        for entity_id, tokens in document_tokens.items():
            term_freq = Counter(tokens)
            score = 0.0
            length = max(len(tokens), 1)
            for token in query_tokens:
                if token not in term_freq:
                    continue
                idf = math.log(1 + (len(document_tokens) - doc_freq[token] + 0.5) / (doc_freq[token] + 0.5))
                numerator = term_freq[token] * (k1 + 1)
                denominator = term_freq[token] + k1 * (1 - b + b * length / max(avg_len, 1))
                score += idf * numerator / denominator
            scores[entity_id] = min(score / max(len(query_tokens), 1), 1.0)
        return scores

    def _vector_scores(self, query_tokens: list[str], entities: list[KnowledgeEntity]) -> dict[str, float]:
        return {
            entity.id: _cosine_from_tokens(query_tokens, _tokens(_entity_text(entity)))
            for entity in entities
        }

    def _neighbors(self, entity_id: str) -> list[tuple[KnowledgeRelation, str]]:
        result: list[tuple[KnowledgeRelation, str]] = []
        for relation in self.relations.values():
            if relation.from_id == entity_id:
                result.append((relation, relation.to_id))
            elif relation.to_id == entity_id:
                result.append((relation, relation.from_id))
        return result

    def _traverse_paths(
        self,
        seed_ids: list[str],
        *,
        max_depth: int,
        query_tokens: list[str],
    ) -> tuple[dict[str, float], dict[str, list[KnowledgePath]]]:
        graph_scores: dict[str, float] = defaultdict(float)
        paths_by_entity: dict[str, list[KnowledgePath]] = defaultdict(list)
        queue: deque[tuple[str, list[KnowledgePathStep], float, int]] = deque()

        for seed_id in seed_ids:
            entity = self.entities.get(seed_id)
            if entity:
                queue.append((seed_id, [KnowledgePathStep(entity=entity)], 1.0, 0))

        seen: set[tuple[str, int]] = set()
        while queue:
            current_id, steps, path_score, depth = queue.popleft()
            if (current_id, depth) in seen or depth >= max_depth:
                continue
            seen.add((current_id, depth))

            for relation, neighbor_id in self._neighbors(current_id):
                neighbor = self.entities.get(neighbor_id)
                if not neighbor:
                    continue

                relation_weight = RELATION_WEIGHTS.get(relation.type, relation.weight)
                semantic_bonus = _cosine_from_tokens(query_tokens, _tokens(_entity_text(neighbor)))
                next_score = path_score * relation_weight * (0.68 + 0.32 * semantic_bonus)
                graph_scores[neighbor_id] = max(graph_scores[neighbor_id], next_score)

                next_steps = [*steps, KnowledgePathStep(entity=neighbor, viaRelation=relation)]
                path = KnowledgePath(
                    pathId=f"path:{hashlib.sha1('|'.join(step.entity.id for step in next_steps).encode()).hexdigest()[:16]}",
                    steps=next_steps,
                    score=round(next_score, 4),
                    explanation=f"Reached through {relation.type} with relation weight {relation_weight:.2f}.",
                )
                paths_by_entity[neighbor_id].append(path)
                queue.append((neighbor_id, next_steps, next_score, depth + 1))

        return graph_scores, paths_by_entity

    def query(self, request: KnowledgeQueryRequest, *, request_id: str) -> KnowledgeQueryResponse:
        started_ms = _now_ms()
        query_tokens = _tokens(request.query)
        retrieval_mode = request.retrieval_mode or self.settings.retrieval_mode
        max_depth = request.max_path_depth if request.max_path_depth is not None else self.settings.max_path_depth
        min_confidence = request.filters.min_confidence or self.settings.min_confidence
        scoped_request = request.model_copy(
            update={"filters": request.filters.model_copy(update={"min_confidence": min_confidence})}
        )
        entities = self._filter_entities(scoped_request)

        fulltext_started = _now_ms()
        bm25 = self._bm25_scores(query_tokens, entities) if retrieval_mode in ("hybrid", "fulltext") else {}
        self.metrics.fulltext_retrieval_latency_ms = _now_ms() - fulltext_started

        vector_started = _now_ms()
        vectors = self._vector_scores(query_tokens, entities) if retrieval_mode in ("hybrid", "vector") and self.settings.vector_enabled else {}
        self.metrics.vector_retrieval_latency_ms = _now_ms() - vector_started

        initial_scores: dict[str, float] = {}
        for entity in entities:
            fulltext = bm25.get(entity.id, 0)
            vector = vectors.get(entity.id, 0)
            initial_scores[entity.id] = max(fulltext, vector, (0.55 * fulltext + 0.45 * vector))

        seed_ids = [
            entity_id
            for entity_id, score in sorted(initial_scores.items(), key=lambda item: item[1], reverse=True)
            if score > 0
        ][: max(request.max_results, 4)]

        graph_started = _now_ms()
        graph_scores, paths_by_entity = (
            self._traverse_paths(seed_ids, max_depth=max_depth, query_tokens=query_tokens)
            if retrieval_mode in ("hybrid", "graph") and max_depth > 0
            else ({}, {})
        )
        self.metrics.graph_traversal_latency_ms = _now_ms() - graph_started

        hits: list[KnowledgeHit] = []
        candidates_by_id = {entity.id: entity for entity in entities}
        for entity_id in set(initial_scores) | set(graph_scores):
            entity = candidates_by_id.get(entity_id) or self.entities.get(entity_id)
            if not entity:
                continue

            fulltext = bm25.get(entity_id, 0)
            vector = vectors.get(entity_id, 0)
            graph = graph_scores.get(entity_id, 0)
            temporal = _recency_score(entity, half_life_days=self.settings.recency_half_life_days)
            confidence = entity.confidence
            provenance = min(len(entity.provenance) / 2, 1.0)
            relation_weight = max((path.score for path in paths_by_entity.get(entity_id, [])), default=0)

            total = (
                0.28 * fulltext
                + 0.24 * vector
                + 0.2 * graph
                + 0.12 * temporal
                + 0.12 * confidence
                + 0.04 * provenance
            )
            if retrieval_mode == "graph":
                total = 0.62 * graph + 0.16 * temporal + 0.16 * confidence + 0.06 * provenance
            elif retrieval_mode == "fulltext":
                total = 0.74 * fulltext + 0.1 * temporal + 0.12 * confidence + 0.04 * provenance
            elif retrieval_mode == "vector":
                total = 0.74 * vector + 0.1 * temporal + 0.12 * confidence + 0.04 * provenance

            why = []
            if fulltext > 0:
                why.append("keyword/full-text match")
            if vector > 0:
                why.append("semantic hashing similarity")
            if graph > 0:
                why.append("relation-weighted graph traversal")
            if temporal > 0.5:
                why.append("recent or currently valid fact")
            if confidence >= 0.75:
                why.append("high-confidence curated provenance")

            relations = [
                relation
                for relation in self.relations.values()
                if relation.from_id == entity_id or relation.to_id == entity_id
            ][:16]
            evidence = [
                self.entities[relation.to_id]
                for relation in relations
                if relation.type == "SUPPORTED_BY" and relation.to_id in self.entities
            ]
            contradictory = [
                self.entities[relation.to_id]
                for relation in relations
                if relation.type in ("CONTRADICTED_BY", "WEAKENS", "INVALIDATES") and relation.to_id in self.entities
            ]

            hits.append(
                KnowledgeHit(
                    entity=entity,
                    score=RetrievalScore(
                        total=round(total, 4),
                        fulltext=round(fulltext, 4),
                        vector=round(vector, 4),
                        graph=round(graph, 4),
                        temporal=round(temporal, 4),
                        confidence=round(confidence, 4),
                        provenance=round(provenance, 4),
                        relationWeight=round(relation_weight, 4),
                    ),
                    why=why or ["fallback candidate"],
                    relations=relations,
                    paths=paths_by_entity.get(entity_id, [])[:5],
                    evidence=evidence,
                    contradictoryEvidence=contradictory,
                )
            )

        hits.sort(key=lambda hit: hit.score.total, reverse=True)
        hits = hits[: request.max_results]
        duration = _now_ms() - started_ms
        self.metrics.query_latency_ms = duration
        self.metrics.query_count += 1

        return KnowledgeQueryResponse(
            requestId=request_id,
            mode=request.mode,
            query=request.query,
            retrievalMode=retrieval_mode,
            hits=hits,
            metrics={
                "queryLatencyMs": round(duration, 2),
                "fulltextRetrievalLatencyMs": round(self.metrics.fulltext_retrieval_latency_ms, 2),
                "vectorRetrievalLatencyMs": round(self.metrics.vector_retrieval_latency_ms, 2),
                "graphTraversalLatencyMs": round(self.metrics.graph_traversal_latency_ms, 2),
                "hitCount": len(hits),
                "candidateCount": len(entities),
                "maxPathDepth": max_depth,
            },
            degraded=False,
            fallbackReason=None,
        )

    def context_bundle(self, request: ContextBundleRequest, *, request_id: str) -> KnowledgeContextBundle:
        query_response = self.query(request, request_id=request_id)
        max_tokens = request.max_tokens or self.settings.max_context_tokens
        hits = query_response.hits

        def compact(entity: KnowledgeEntity, why: list[str] | None = None) -> CompactContextItem:
            refs = [
                ref
                for provenance in entity.provenance
                for ref in [provenance.source_ref or provenance.source_url or provenance.source]
                if ref
            ]
            return CompactContextItem(
                id=entity.id,
                type=entity.type,
                title=entity.label,
                summary=entity.description[:420],
                confidence=entity.confidence,
                recency=round(_recency_score(entity, half_life_days=self.settings.recency_half_life_days), 4),
                provenanceRefs=refs[:5],
                why=why or [],
            )

        entities = [compact(hit.entity, hit.why) for hit in hits]
        relations = []
        paths = []
        evidence: list[CompactContextItem] = []
        contradictory: list[CompactContextItem] = []
        assumptions: list[CompactContextItem] = []
        provenance: list[Provenance] = []

        for hit in hits:
            relations.extend(hit.relations[:6])
            paths.extend(hit.paths[:3])
            evidence.extend(compact(item, ["supporting evidence"]) for item in hit.evidence)
            contradictory.extend(
                compact(item, ["contradictory or weakening evidence"])
                for item in hit.contradictory_evidence
            )
            if hit.entity.type == "Assumption" or "assumption" in hit.entity.tags:
                assumptions.append(compact(hit.entity, hit.why))
            provenance.extend(hit.entity.provenance)

        unknowns = []
        if not hits:
            unknowns.append("No matching graph memory was found for this query.")
        if not contradictory:
            unknowns.append("No contradictory evidence was retrieved; absence is not proof none exists.")
        if request.mode == "demo":
            unknowns.append("Demo mode uses deterministic seed fixtures only.")

        summary_lines = [
            f"{item.title}: {item.summary}" for item in entities[:6]
        ]
        summary = " ".join(summary_lines) if summary_lines else "No graph context available."
        token_estimate = max(1, math.ceil(len(summary) / 4))
        if token_estimate > max_tokens:
            summary = summary[: max_tokens * 4]
            token_estimate = max_tokens

        confidence = (
            sum(item.confidence for item in entities) / len(entities)
            if entities
            else 0
        )
        recency = (
            sum(item.recency for item in entities) / len(entities)
            if entities
            else 0
        )
        self.metrics.context_bundle_token_estimate = token_estimate

        return KnowledgeContextBundle(
            requestId=request_id,
            mode=request.mode,
            query=request.query,
            maxTokens=max_tokens,
            tokenEstimate=token_estimate,
            summary=summary,
            entities=entities,
            relations=relations[:24],
            graphPaths=paths[:12],
            evidence=evidence[:12],
            contradictoryEvidence=contradictory[:12],
            assumptions=assumptions[:8],
            unknowns=unknowns,
            retrievalExplanation=[
                f"Retrieval mode: {query_response.retrieval_mode}.",
                "Scores combine BM25, deterministic semantic hashing, graph traversal, temporal recency, confidence and provenance.",
                "Deterministic finance-engine output remains primary; graph context is enrichment and challenge material.",
            ],
            confidence=round(confidence, 4),
            recency=round(recency, 4),
            provenance=provenance[:12],
            degraded=query_response.degraded,
            fallbackReason=query_response.fallback_reason,
        )

    def explain(self, entity_or_relation_id: str, *, query: str | None, mode: str, request_id: str) -> KnowledgeExplainResponse:
        entity = self.entities.get(entity_or_relation_id)
        relation = self.relations.get(entity_or_relation_id)
        if not entity and not relation:
            self.metrics.fallback_usage_count += 1
            return KnowledgeExplainResponse(
                requestId=request_id,
                id=entity_or_relation_id,
                explanation="No current node or relation with this id exists in the graph.",
                score=None,
            )

        paths: list[KnowledgePath] = []
        evidence: list[KnowledgeEntity] = []
        contradictory: list[KnowledgeEntity] = []
        score = None
        if entity:
            request = KnowledgeQueryRequest(
                query=query or entity.label,
                mode=mode,  # type: ignore[arg-type]
                maxResults=10,
                maxPathDepth=self.settings.max_path_depth,
            )
            response = self.query(request, request_id=request_id)
            matching = next((hit for hit in response.hits if hit.entity.id == entity.id), None)
            if matching:
                paths = matching.paths
                evidence = matching.evidence
                contradictory = matching.contradictory_evidence
                score = matching.score

        explanation_subject = entity.label if entity else relation.label or relation.type
        return KnowledgeExplainResponse(
            requestId=request_id,
            id=entity_or_relation_id,
            explanation=(
                f"{explanation_subject} was returned because it matched query terms, semantic features, "
                "or relation-weighted graph paths. Scores are adjusted by confidence, provenance count "
                "and temporal recency."
            ),
            score=score,
            entity=entity,
            relation=relation,
            paths=paths,
            evidence=evidence,
            contradictoryEvidence=contradictory,
        )

    def stats(self, *, request_id: str) -> KnowledgeStatsResponse:
        source_counts = Counter(entity.source for entity in self.entities.values())
        entity_type_counts = Counter(entity.type for entity in self.entities.values())
        relation_type_counts = Counter(relation.type for relation in self.relations.values())
        storage_size = self.storage_file().stat().st_size if self.storage_file().exists() else 0

        return KnowledgeStatsResponse(
            requestId=request_id,
            backend=self.settings.graph_backend,
            vectorBackend="qdrant" if self.settings.graph_backend != "local" else "local-hashing",
            entityCount=len(self.entities),
            relationCount=len(self.relations),
            historicalEntityCount=len(self.historical_entities),
            historicalRelationCount=len(self.historical_relations),
            sourceCounts=dict(source_counts),
            entityTypeCounts=dict(entity_type_counts),
            relationTypeCounts=dict(relation_type_counts),
            contradictionCount=self.metrics.contradiction_count,
            supersededFactCount=self.metrics.superseded_fact_count,
            dedupeCount=self.metrics.dedupe_count,
            ingestCount=self.metrics.ingest_count,
            lastIngestAt=self.metrics.last_ingest_at,
            lastSuccessfulRebuildAt=self.metrics.last_successful_rebuild_at,
            lastFailureReason=self.metrics.last_failure_reason,
            queryLatencyMs=round(self.metrics.query_latency_ms, 2),
            graphTraversalLatencyMs=round(self.metrics.graph_traversal_latency_ms, 2),
            vectorRetrievalLatencyMs=round(self.metrics.vector_retrieval_latency_ms, 2),
            fulltextRetrievalLatencyMs=round(self.metrics.fulltext_retrieval_latency_ms, 2),
            contextBundleTokenEstimate=self.metrics.context_bundle_token_estimate,
            rebuildDurationMs=self.metrics.rebuild_duration_ms,
            fallbackUsageCount=self.metrics.fallback_usage_count,
            storageSizeBytes=storage_size,
        )
