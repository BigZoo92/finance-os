from contextlib import asynccontextmanager
from datetime import UTC, datetime
import json
import logging
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import ORJSONResponse

from . import __version__
from .config import get_settings
from .models import (
    ContextBundleRequest,
    HealthResponse,
    KnowledgeExplainRequest,
    KnowledgeIngestRequest,
    KnowledgeQueryRequest,
    KnowledgeRebuildRequest,
    VersionResponse,
)
from .schema import NODE_TYPES, RELATION_TYPES, RELATION_WEIGHTS, SCHEMA_VERSION
from .store import KnowledgeGraphStore

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
    logger.log(logging.ERROR if level == "error" else logging.WARNING if level == "warn" else logging.INFO, json.dumps(payload, default=str))


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    store = KnowledgeGraphStore(settings=settings)
    try:
        store.load()
    except Exception as exc:
        _log("warn", "knowledge store load failed", errName=type(exc).__name__)

    if settings.rebuild_on_start and not store.entities:
        try:
            store.rebuild(
                KnowledgeRebuildRequest(mode="demo", includeSeed=True, dryRun=False),
                request_id="startup-rebuild",
            )
        except Exception as exc:
            _log("error", "knowledge startup rebuild failed", errName=type(exc).__name__)

    app.state.store = store
    yield


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
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        request_id = _request_id(request)
        _log("warn", "knowledge validation failed", requestId=request_id, route=request.url.path)
        return _safe_error(request_id, 400, "INVALID_INPUT", "Invalid request payload.")

    def store() -> KnowledgeGraphStore:
        return app.state.store

    @app.get("/health", response_model=HealthResponse)
    async def health(request: Request):
        request_id = _request_id(request)
        degraded = settings.graph_backend != "local" and (
            (settings.graph_backend == "neo4j" and not settings.neo4j_uri)
            or (settings.graph_backend in ("memgraph", "falkordb") and not settings.neo4j_uri)
        )
        return HealthResponse(
            status="degraded" if degraded else "ok",
            service="knowledge-service",
            backend=settings.graph_backend,
            vectorEnabled=settings.vector_enabled,
            fulltextEnabled=settings.fulltext_enabled,
            temporalEnabled=settings.temporal_enabled,
            requestId=request_id,
            timestamp=datetime.now(UTC),
        )

    @app.get("/version", response_model=VersionResponse)
    async def version():
        return VersionResponse(
            service="knowledge-service",
            version=settings.app_version or __version__,
            schemaVersion=SCHEMA_VERSION,
            graphBackend=settings.graph_backend,
            vectorBackend="qdrant" if settings.graph_backend != "local" else "local-hashing",
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
        return store().stats(request_id=request_id)

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

    return app
