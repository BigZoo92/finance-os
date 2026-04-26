# Finance-OS Knowledge Service

Internal-only Temporal Financial Knowledge Graph Memory service.

The production architecture targets Neo4j for the temporal property graph and Qdrant for hybrid vector/sparse retrieval. This service also ships with a deterministic local JSON graph backend so development, tests, and demo mode do not require external services or provider calls.

Run locally:

```bash
python -m pip install -e apps/knowledge-service[dev]
python -m uvicorn finance_os_knowledge.app:create_app --factory --app-dir apps/knowledge-service/src --host 127.0.0.1 --port 8011
```

Rebuild deterministic seed memory:

```bash
curl -X POST http://127.0.0.1:8011/knowledge/rebuild -H "content-type: application/json" -d "{\"scope\":\"admin\",\"includeSeed\":true}"
```

No endpoint performs trading execution or external provider calls. Embeddings default to deterministic local hashing unless an explicit server-only embedding provider is configured later.

## Backends and selection

The service ships two stores side-by-side:

- `finance_os_knowledge.store.KnowledgeGraphStore` — deterministic in-memory + JSON store. Used by demo mode, tests, and as the fail-soft fallback in admin.
- `finance_os_knowledge.backends.production_store.ProductionKnowledgeStore` — composes the local store (hot cache for BM25 + traversal scoring) with `Neo4jAdapter` (durable graph persistence) and `QdrantAdapter` (vector retrieval). Used by admin when production backends are configured.

`finance_os_knowledge.backends.factory.select_backend` picks the right store at startup based on:

| Env | Default | Effect |
|---|---|---|
| `KNOWLEDGE_USE_PRODUCTION_BACKENDS` | `false` | When `true` and Neo4j/Qdrant credentials are set, uses the production store |
| `KNOWLEDGE_REQUIRE_PRODUCTION_BACKENDS_IN_ADMIN` | `false` | When `true`, raises if either backend cannot connect (subject to the next flag) |
| `KNOWLEDGE_ALLOW_LOCAL_FALLBACK_IN_ADMIN` | `true` | Allows fallback to local cache when a backend is degraded |

When admin runs on the production stack, `/health` and `/knowledge/stats` expose a `backendHealth` block with Neo4j and Qdrant availability plus any `degradedReasons`.

## Source-specific ingestion endpoints

Ingest the existing Finance-OS context bundles directly:

- `POST /knowledge/ingest/markets` — macro signals, tickers, sectors → `MacroSignal`/`Asset`/`Ticker`/`Sector`
- `POST /knowledge/ingest/news` — news items → `NewsSignal`/`MarketEvent`/`SourceDocument`
- `POST /knowledge/ingest/advisor` — recommendations + assumptions + evidence → `Recommendation`/`Assumption`/`Evidence`
- `POST /knowledge/ingest/cost-ledger` — AI cost rows → `Model`/`AgentRun`/`TokenUsageObservation`/`CostObservation`

All ingestion is idempotent and carries provenance, temporal fields and confidence.
