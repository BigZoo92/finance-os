from contextlib import asynccontextmanager
from datetime import UTC, datetime
import json
import logging
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import ORJSONResponse

from . import __version__
from .backends.factory import select_backend
from .backends.production_store import ProductionKnowledgeStore
from .config import get_settings
from .ingest import (
    AdvisorIngestRequest,
    CostLedgerIngestRequest,
    MarketsIngestRequest,
    NewsIngestRequest,
    SocialIngestRequest,
    TradingLabIngestRequest,
    build_advisor_ingest,
    build_cost_ledger_ingest,
    build_markets_ingest,
    build_news_ingest,
    build_social_ingest,
    build_trading_lab_ingest,
)
from .models import (
    ContextBundleRequest,
    KnowledgeExplainRequest,
    KnowledgeIngestRequest,
    KnowledgeQueryRequest,
    KnowledgeRebuildRequest,
    VersionResponse,
)
from .schema import NODE_TYPES, RELATION_TYPES, RELATION_WEIGHTS, SCHEMA_VERSION

logger = logging.getLogger("finance_os_knowledge")
logging.basicConfig(level=logging.INFO, format="%(message)s")


def _request_id(request: Request) -> str:
    candidate = request.headers.get("x-request-id", "").strip()
    return candidate or str(uuid4())


def _log(level: str, message: str, **fields: object) -> None:
    payload = {
        "level": level,
        "service": "knowledge-service",
        "msg": message,
        **fields,
    }
    logger.log(
        logging.ERROR
        if level == "error"
        else logging.WARNING
        if level == "warn"
        else logging.INFO,
        json.dumps(payload, default=str),
    )


def _safe_error(request_id: str, status_code: int, code: str, message: str) -> ORJSONResponse:
    return ORJSONResponse(
        {
            "ok": False,
            "code": code,
            "message": message,
            "requestId": request_id,
        },
        status_code=status_code,
        headers={"x-request-id": request_id, "cache-control": "no-store"},
    )


def _backend_health(store: Any) -> dict[str, Any] | None:
    if isinstance(store, ProductionKnowledgeStore):
        return store.health()
    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    try:
        store = select_backend(settings)
    except RuntimeError as exc:
        _log("error", "knowledge backend selection failed", errName=type(exc).__name__)
        raise

    try:
        store.load()
    except Exception as exc:
        _log("warn", "knowledge store load failed", errName=type(exc).__name__)

    needs_seed = False
    if isinstance(store, ProductionKnowledgeStore):
        needs_seed = settings.rebuild_on_start and not store.local.entities
    else:
        needs_seed = settings.rebuild_on_start and not store.entities  # type: ignore[attr-defined]

    if needs_seed:
        try:
            store.rebuild(
                KnowledgeRebuildRequest(mode="demo", includeSeed=True, dryRun=False),
                request_id="startup-rebuild",
            )
        except Exception as exc:
            _log(
                "error",
                "knowledge startup rebuild failed",
                errName=type(exc).__name__,
            )

    app.state.store = store
    try:
        yield
    finally:
        if isinstance(store, ProductionKnowledgeStore):
            store.close()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Finance-OS Knowledge Service",
        version=__version__,
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request_id = _request_id(request)
        started = datetime.now(UTC)
        try:
            response = await call_next(request)
        except Exception as exc:
            _log(
                "error",
                "knowledge request failed",
                requestId=request_id,
                route=request.url.path,
                method=request.method,
                errName=type(exc).__name__,
            )
            return _safe_error(
                request_id,
                500,
                "KNOWLEDGE_INTERNAL_ERROR",
                "Knowledge service failed with a safe internal error.",
            )

        duration_ms = int((datetime.now(UTC) - started).total_seconds() * 1000)
        response.headers["x-request-id"] = request_id
        response.headers["cache-control"] = "no-store"
        _log(
            "info",
            "knowledge request completed",
            requestId=request_id,
            route=request.url.path,
            method=request.method,
            status=response.status_code,
            durationMs=duration_ms,
        )
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ):
        request_id = _request_id(request)
        _log(
            "warn",
            "knowledge validation failed",
            requestId=request_id,
            route=request.url.path,
        )
        return _safe_error(request_id, 400, "INVALID_INPUT", "Invalid request payload.")

    def store():
        return app.state.store

    @app.get("/health")
    async def health(request: Request):
        request_id = _request_id(request)
        active = store()
        backend_health = _backend_health(active)
        production_configured = settings.production_backends_configured
        production_active = (
            backend_health.get("productionActive", False) if backend_health else False
        )
        degraded = (
            production_configured and not production_active
        ) or (settings.graph_backend != "local" and not production_configured)
        payload = {
            "status": "degraded" if degraded else "ok",
            "service": "knowledge-service",
            "backend": "neo4j"
            if (backend_health and backend_health["neo4j"]["available"])
            else settings.graph_backend,
            "vectorEnabled": settings.vector_enabled,
            "fulltextEnabled": settings.fulltext_enabled,
            "temporalEnabled": settings.temporal_enabled,
            "requestId": request_id,
            "timestamp": datetime.now(UTC).isoformat(),
            "productionConfigured": production_configured,
            "productionActive": production_active,
            "backends": backend_health,
        }
        return ORJSONResponse(payload, headers={"x-request-id": request_id})

    @app.get("/version", response_model=VersionResponse)
    async def version():
        active = store()
        backend_health = _backend_health(active)
        graph_backend = (
            "neo4j"
            if backend_health and backend_health["neo4j"]["available"]
            else settings.graph_backend
        )
        vector_backend = (
            "qdrant"
            if backend_health and backend_health["qdrant"]["available"]
            else "local-hashing"
        )
        return VersionResponse(
            service="knowledge-service",
            version=settings.app_version or __version__,
            schemaVersion=SCHEMA_VERSION,
            graphBackend=graph_backend,
            vectorBackend=vector_backend,
        )

    @app.post("/knowledge/ingest")
    async def ingest(request_body: KnowledgeIngestRequest, request: Request):
        request_id = _request_id(request)
        return store().ingest(request_body, request_id=request_id)

    @app.post("/knowledge/query")
    async def query(request_body: KnowledgeQueryRequest, request: Request):
        request_id = _request_id(request)
        return store().query(request_body, request_id=request_id)

    @app.post("/knowledge/context-bundle")
    async def context_bundle(request_body: ContextBundleRequest, request: Request):
        request_id = _request_id(request)
        return store().context_bundle(request_body, request_id=request_id)

    @app.post("/knowledge/rebuild")
    async def rebuild(request_body: KnowledgeRebuildRequest, request: Request):
        request_id = _request_id(request)
        return store().rebuild(request_body, request_id=request_id)

    @app.get("/knowledge/stats")
    async def stats(request: Request):
        request_id = _request_id(request)
        response = store().stats(request_id=request_id)
        payload = response.model_dump(by_alias=True, mode="json")
        backend_health = _backend_health(store())
        if backend_health:
            payload["backendHealth"] = backend_health
        return ORJSONResponse(payload, headers={"x-request-id": request_id})

    @app.get("/knowledge/schema")
    async def schema(request: Request):
        request_id = _request_id(request)
        return {
            "ok": True,
            "requestId": request_id,
            "schemaVersion": SCHEMA_VERSION,
            "nodeTypes": NODE_TYPES,
            "relationTypes": RELATION_TYPES,
            "relationWeights": RELATION_WEIGHTS,
            "temporalFields": [
                "observedAt",
                "validFrom",
                "validTo",
                "invalidatedAt",
                "supersededBy",
                "sourceTimestamp",
                "ingestionTimestamp",
            ],
            "scopes": ["demo", "admin", "internal"],
            "selectedProductionBackends": {
                "graph": "neo4j",
                "vector": "qdrant",
                "fullText": "neo4j full-text plus local BM25 fallback",
            },
        }

    @app.post("/knowledge/explain")
    async def explain(request_body: KnowledgeExplainRequest, request: Request):
        request_id = _request_id(request)
        return store().explain(
            request_body.id,
            query=request_body.query,
            mode=request_body.mode,
            request_id=request_id,
        )

    # Source-specific ingestion endpoints --------------------------------
    @app.post("/knowledge/ingest/markets")
    async def ingest_markets(request_body: MarketsIngestRequest, request: Request):
        request_id = _request_id(request)
        ingest_request = build_markets_ingest(request_body)
        return store().ingest(ingest_request, request_id=request_id)

    @app.post("/knowledge/ingest/news")
    async def ingest_news(request_body: NewsIngestRequest, request: Request):
        request_id = _request_id(request)
        ingest_request = build_news_ingest(request_body)
        return store().ingest(ingest_request, request_id=request_id)

    @app.post("/knowledge/ingest/advisor")
    async def ingest_advisor(request_body: AdvisorIngestRequest, request: Request):
        request_id = _request_id(request)
        ingest_request = build_advisor_ingest(request_body)
        return store().ingest(ingest_request, request_id=request_id)

    @app.post("/knowledge/ingest/social")
    async def ingest_social(request_body: SocialIngestRequest, request: Request):
        request_id = _request_id(request)
        ingest_request = build_social_ingest(request_body)
        return store().ingest(ingest_request, request_id=request_id)

    @app.post("/knowledge/ingest/cost-ledger")
    async def ingest_cost_ledger(
        request_body: CostLedgerIngestRequest, request: Request
    ):
        request_id = _request_id(request)
        ingest_request = build_cost_ledger_ingest(request_body)
        return store().ingest(ingest_request, request_id=request_id)

    @app.post("/knowledge/ingest/trading-lab")
    async def ingest_trading_lab(
        request_body: TradingLabIngestRequest, request: Request
    ):
        request_id = _request_id(request)
        ingest_request = build_trading_lab_ingest(request_body)
        return store().ingest(ingest_request, request_id=request_id)

    return app
