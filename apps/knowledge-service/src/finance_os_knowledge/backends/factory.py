"""Selects the appropriate knowledge store backend.

Admin mode prefers the production store (Neo4j + Qdrant). Demo, tests, or
missing configuration fall back to the deterministic local store. We never
raise from selection: callers can always trust they receive a usable store.
"""
from __future__ import annotations

import logging
from typing import Protocol, runtime_checkable

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
from .production_store import ProductionKnowledgeStore

logger = logging.getLogger("finance_os_knowledge.backend_factory")


@runtime_checkable
class KnowledgeBackend(Protocol):
    settings: KnowledgeSettings

    def load(self) -> None: ...
    def ingest(
        self, request: KnowledgeIngestRequest, *, request_id: str
    ) -> KnowledgeIngestResponse: ...
    def query(
        self, request: KnowledgeQueryRequest, *, request_id: str
    ) -> KnowledgeQueryResponse: ...
    def context_bundle(
        self, request: ContextBundleRequest, *, request_id: str
    ) -> KnowledgeContextBundle: ...
    def rebuild(
        self, request: KnowledgeRebuildRequest, *, request_id: str
    ) -> KnowledgeRebuildResponse: ...
    def explain(
        self,
        entity_or_relation_id: str,
        *,
        query: str | None,
        mode: str,
        request_id: str,
    ) -> KnowledgeExplainResponse: ...
    def stats(self, *, request_id: str) -> KnowledgeStatsResponse: ...


def select_backend(settings: KnowledgeSettings) -> KnowledgeBackend:
    """Pick the backend to use.

    Production backends are activated when:
    * `KNOWLEDGE_USE_PRODUCTION_BACKENDS=true`, AND
    * Neo4j credentials are present, AND
    * Qdrant URL is present.

    If `KNOWLEDGE_REQUIRE_PRODUCTION_BACKENDS_IN_ADMIN=true` and a backend
    fails to connect, we honour the contract by raising so deployments can
    detect misconfiguration. Otherwise we degrade to the local store and
    surface the reason in stats/health.
    """
    if not settings.production_backends_configured:
        if settings.require_production_backends_in_admin:
            logger.error(
                "knowledge service requires production backends but none configured"
            )
        return KnowledgeGraphStore(settings=settings)

    production = ProductionKnowledgeStore(settings=settings)
    production.connect()

    if production.is_production_active:
        return production

    if settings.require_production_backends_in_admin:
        if not settings.allow_local_fallback_in_admin:
            raise RuntimeError(
                "Knowledge service required production backends but at least one is unavailable: "
                + ",".join(production.degraded_reasons)
            )

    # Either fallback is allowed or strict mode is off — keep the production
    # wrapper because it still tracks degraded reasons and will route to the
    # local cache for queries.
    return production
