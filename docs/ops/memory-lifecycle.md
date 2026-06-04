# Memory (Knowledge Graph) lifecycle

Memory is the AI Advisor's derived knowledge graph (Qdrant vectors + Neo4j
graph), served by the `knowledge-service`. It is **AI Advisor memory only** — it
enriches/explains/challenges recommendations and is never trading or execution
infrastructure. The deterministic `packages/finance-engine` outputs remain the
source of truth.

## Lifecycle

1. **Boot init** — on startup the knowledge-service selects a backend
   (`select_backend`). When production backends are configured and reachable it
   uses `ProductionKnowledgeStore`, whose `connect()` calls
   `neo4j.ensure_schema()` + `qdrant.ensure_collection()` (idempotent). The
   `knowledge-service-storage-init` one-shot only prepares the storage dir.
2. **Ensure (admin, idempotent, non-destructive)** —
   `POST /ops/knowledge/enrichment/ensure` proxies to the knowledge-service
   `POST /knowledge/storage/ensure`, which re-runs `ensure_collection` +
   `ensure_schema` and returns counts. It **never** resets, deletes or rebuilds.
3. **First ingest** — memory is populated by advisor runs writing
   `advisor_memory_event` rows (decision points, recommendations, outcomes),
   which the graph-ingest path forwards to Neo4j/Qdrant.
4. **Rebuild (destructive)** — `POST /knowledge/rebuild` (seed graph) resets the
   backends before re-seeding. Do **not** use it as an "ensure": prefer the
   ensure endpoint above.

## Expected states

`/ops/knowledge/enrichment/status` exposes an honest snapshot. The Memory UI
maps it to one of:

| State    | Meaning |
| -------- | ------- |
| `ready`  | Production active and the graph holds data (nodes/points > 0). |
| `empty`  | Storage ready but nothing ingested yet (`empty: true`). NOT "ready". |
| `fallback` | Production backends not active; local deterministic cache in use. |
| `degraded` | knowledge-service / Qdrant / Neo4j unreachable. |
| `demo`   | Deterministic fixture; no production memory. |

After a fresh deploy with no ingest, the honest state is **`empty`**
(`productionActive: true`, `collectionExists: true`, `points: 0`, `nodes: 0`,
`emptyBecauseNoIngest: true`). Do not claim the graph is ready while Qdrant/Neo4j
are empty.

## Safe checks (no secrets in logs)

```bash
curl -sS "$APP_URL/api/ops/knowledge/enrichment/status"
curl -sS -X POST "$APP_URL/api/ops/knowledge/enrichment/ensure"
curl -sS -H "x-request-id: mem-check" http://127.0.0.1:8011/knowledge/storage/status
```
