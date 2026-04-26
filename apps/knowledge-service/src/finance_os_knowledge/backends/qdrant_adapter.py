"""Qdrant vector retrieval adapter for the Finance-OS knowledge graph.

Stores compact embeddings for entities, relations and evidence so the
hybrid retrieval pipeline can ask Qdrant for the vector lane while the
deterministic local store handles BM25 and traversal scoring.

The adapter is fail-soft: missing config or connectivity flips
`available=False` and the parent store routes vector retrieval back to the
local hashing implementation rather than dropping requests.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Iterable

from ..config import KnowledgeSettings
from ..models import KnowledgeEntity, KnowledgeRelation
from .embeddings import EmbeddingProvider, build_embedding_provider

logger = logging.getLogger("finance_os_knowledge.qdrant")


def _entity_text(entity: KnowledgeEntity) -> str:
    parts = [
        entity.label or "",
        entity.description or "",
        " ".join(entity.tags or []),
    ]
    return " ".join(part for part in parts if part).strip()


def _relation_text(relation: KnowledgeRelation) -> str:
    parts = [
        relation.label or "",
        relation.description or "",
        relation.type,
    ]
    return " ".join(part for part in parts if part).strip()


def _entity_payload(entity: KnowledgeEntity) -> dict[str, Any]:
    return {
        "id": entity.id,
        "kind": "entity",
        "graphNodeId": entity.id,
        "type": entity.type,
        "label": entity.label,
        "source": entity.source,
        "confidence": float(entity.confidence),
        "scope": entity.scope,
        "tags": list(entity.tags),
        "observedAt": entity.observed_at.isoformat() if entity.observed_at else None,
        "validFrom": entity.valid_from.isoformat() if entity.valid_from else None,
        "validTo": entity.valid_to.isoformat() if entity.valid_to else None,
    }


def _relation_payload(relation: KnowledgeRelation) -> dict[str, Any]:
    return {
        "id": relation.id,
        "kind": "relation",
        "graphRelationId": relation.id,
        "type": relation.type,
        "fromId": relation.from_id,
        "toId": relation.to_id,
        "label": relation.label,
        "source": relation.source,
        "confidence": float(relation.confidence),
        "scope": relation.scope,
        "tags": list(relation.tags),
        "observedAt": relation.observed_at.isoformat() if relation.observed_at else None,
        "validFrom": relation.valid_from.isoformat() if relation.valid_from else None,
        "validTo": relation.valid_to.isoformat() if relation.valid_to else None,
    }


@dataclass
class QdrantAdapter:
    settings: KnowledgeSettings
    _client: Any = field(default=None, init=False, repr=False)
    _models: Any = field(default=None, init=False, repr=False)
    _available: bool = field(default=False, init=False)
    _last_error: str | None = field(default=None, init=False)
    _embedding_provider: EmbeddingProvider | None = field(default=None, init=False)
    _initialized: bool = field(default=False, init=False)

    @property
    def available(self) -> bool:
        return self._available

    @property
    def last_error(self) -> str | None:
        return self._last_error

    @property
    def collection(self) -> str:
        return self.settings.qdrant_collection

    @property
    def embedding_provider(self) -> EmbeddingProvider:
        if self._embedding_provider is None:
            self._embedding_provider = build_embedding_provider(self.settings)
        return self._embedding_provider

    def connect(self) -> bool:
        if not self.settings.qdrant_url:
            self._available = False
            self._last_error = "qdrant_not_configured"
            return False
        try:
            from qdrant_client import QdrantClient  # type: ignore[import-not-found]
            from qdrant_client.http import models as qmodels  # type: ignore[import-not-found]
        except Exception as exc:  # pragma: no cover - optional dep missing
            self._available = False
            self._last_error = f"qdrant_client_missing:{type(exc).__name__}"
            return False
        try:
            client = QdrantClient(
                url=self.settings.qdrant_url,
                api_key=self.settings.qdrant_api_key,
                timeout=10,
            )
            client.get_collections()
            self._client = client
            self._models = qmodels
            self._available = True
            self._last_error = None
            return True
        except Exception as exc:
            self._client = None
            self._available = False
            self._last_error = f"qdrant_connect_failed:{type(exc).__name__}"
            logger.warning("qdrant connection failed: %s", type(exc).__name__)
            return False

    def close(self) -> None:
        if self._client is not None:
            try:
                self._client.close()
            except Exception:  # pragma: no cover
                pass
            self._client = None
            self._available = False

    def ensure_collection(self) -> None:
        if not self._client or not self._models:
            return
        try:
            collections = {
                col.name for col in self._client.get_collections().collections
            }
            if self.collection in collections:
                self._initialized = True
                return
            self._client.recreate_collection(
                collection_name=self.collection,
                vectors_config=self._models.VectorParams(
                    size=self.settings.embedding_dimensions,
                    distance=self._models.Distance.COSINE,
                ),
            )
            self._initialized = True
        except Exception as exc:
            self._available = False
            self._last_error = f"qdrant_collection_failed:{type(exc).__name__}"
            logger.warning("qdrant collection setup failed: %s", type(exc).__name__)

    def ping(self) -> bool:
        if not self._client:
            return self.connect()
        try:
            self._client.get_collections()
            self._available = True
            self._last_error = None
            return True
        except Exception as exc:
            self._available = False
            self._last_error = f"qdrant_ping_failed:{type(exc).__name__}"
            return False

    def _point_id(self, raw_id: str) -> str:
        # Qdrant accepts uuid strings or integers; entity ids contain colons
        # which Qdrant rejects. We hash to a stable hex string.
        import hashlib

        return hashlib.sha1(raw_id.encode("utf-8")).hexdigest()

    def upsert_entities(self, entities: Iterable[KnowledgeEntity]) -> int:
        if not self._client or not self._models:
            return 0
        provider = self.embedding_provider
        points: list[Any] = []
        for entity in entities:
            text = _entity_text(entity)
            if not text:
                continue
            try:
                vector = provider.embed(text)
            except Exception:
                vector = build_embedding_provider(self.settings).embed(text)
            payload = _entity_payload(entity)
            points.append(
                self._models.PointStruct(
                    id=self._point_id(entity.id),
                    vector=vector,
                    payload=payload,
                )
            )
        if not points:
            return 0
        try:
            self._client.upsert(collection_name=self.collection, points=points)
            return len(points)
        except Exception as exc:
            self._available = False
            self._last_error = f"qdrant_upsert_entities_failed:{type(exc).__name__}"
            logger.warning("qdrant entity upsert failed: %s", type(exc).__name__)
            return 0

    def upsert_relations(self, relations: Iterable[KnowledgeRelation]) -> int:
        if not self._client or not self._models:
            return 0
        provider = self.embedding_provider
        points: list[Any] = []
        for relation in relations:
            text = _relation_text(relation)
            if not text:
                continue
            try:
                vector = provider.embed(text)
            except Exception:
                vector = build_embedding_provider(self.settings).embed(text)
            payload = _relation_payload(relation)
            points.append(
                self._models.PointStruct(
                    id=self._point_id(f"rel:{relation.id}"),
                    vector=vector,
                    payload=payload,
                )
            )
        if not points:
            return 0
        try:
            self._client.upsert(collection_name=self.collection, points=points)
            return len(points)
        except Exception as exc:
            self._available = False
            self._last_error = f"qdrant_upsert_relations_failed:{type(exc).__name__}"
            logger.warning("qdrant relation upsert failed: %s", type(exc).__name__)
            return 0

    def search_entities(
        self,
        query: str,
        *,
        limit: int = 16,
        scope: str | None = None,
        min_confidence: float | None = None,
    ) -> dict[str, float]:
        if not self._client or not self._models:
            return {}
        if not query:
            return {}
        try:
            provider = self.embedding_provider
            vector = provider.embed(query)
            must = [self._models.FieldCondition(key="kind", match=self._models.MatchValue(value="entity"))]
            if scope:
                must.append(
                    self._models.FieldCondition(
                        key="scope", match=self._models.MatchValue(value=scope)
                    )
                )
            qfilter = self._models.Filter(must=must)
            response = self._client.search(
                collection_name=self.collection,
                query_vector=vector,
                limit=limit,
                with_payload=True,
                query_filter=qfilter,
            )
            scores: dict[str, float] = {}
            for hit in response:
                payload = hit.payload or {}
                entity_id = payload.get("graphNodeId") or payload.get("id")
                if not entity_id:
                    continue
                if min_confidence is not None and payload.get("confidence", 0) < min_confidence:
                    continue
                scores[entity_id] = float(hit.score)
            return scores
        except Exception as exc:
            self._available = False
            self._last_error = f"qdrant_search_failed:{type(exc).__name__}"
            logger.warning("qdrant search failed: %s", type(exc).__name__)
            return {}

    def reset(self) -> None:
        if not self._client or not self._models:
            return
        try:
            self._client.delete_collection(collection_name=self.collection)
        except Exception:  # pragma: no cover
            pass
        self.ensure_collection()

    def stats(self) -> dict[str, Any]:
        if not self._client:
            return {"available": False, "error": self._last_error}
        try:
            info = self._client.get_collection(collection_name=self.collection)
            count = self._client.count(
                collection_name=self.collection, exact=False
            ).count
            return {
                "available": True,
                "vectors": int(count),
                "collection": self.collection,
                "status": getattr(info, "status", "unknown"),
            }
        except Exception as exc:
            self._available = False
            self._last_error = f"qdrant_stats_failed:{type(exc).__name__}"
            return {"available": False, "error": self._last_error}
