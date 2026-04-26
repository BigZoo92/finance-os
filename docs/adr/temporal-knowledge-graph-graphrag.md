# ADR: Temporal Financial Knowledge Graph Memory + Hybrid GraphRAG

Date: 2026-04-26

Status: accepted foundation, staged rollout

## Decision

Finance-OS will use an internal `apps/knowledge-service` as the AI Advisor memory and reasoning enrichment layer.

Selected target architecture:

- Service: Python FastAPI internal service.
- Temporal memory model: Graphiti/Zep-style evolving temporal knowledge graph with preserved historical facts, provenance, confidence, contradiction and recency fields.
- Graph backend target: Neo4j 5 for the production property graph, graph traversal, full-text indexes and future Graph Data Science algorithms such as Personalized PageRank.
- Vector backend target: Qdrant for dense + sparse/hybrid vector retrieval and reranking.
- Local fallback backend: deterministic JSON graph store with BM25-like scoring, local hashing vectors and relation-weighted traversal for demo, tests and fail-soft operation.
- Retrieval: hybrid query router combining BM25/full-text, vector similarity, graph traversal, temporal filters, relation weighting, confidence, provenance and recency reranking.
- AI Advisor integration: deterministic `packages/finance-engine` remains first. The graph enriches, explains and challenges recommendations through compact `KnowledgeContextBundle` objects.

The service is internal-only. Public traffic still terminates at `apps/web`; `/api/*` is proxied to `apps/api`, and `apps/api` calls `knowledge-service` over the internal Docker network. Demo mode uses deterministic fixtures only.

## Why this is stronger than plain vector RAG

Plain vector RAG is good for approximate semantic recall, but it does not model explicit causality, supersession, contradiction, validity windows or provenance as first-class data. Finance-OS needs answers like:

- "rate decision -> bond proxy reaction -> portfolio implication"
- "Claude model release -> AI infra market reaction -> model routing/cost implication"
- "recurring expense cluster -> budget drift -> recommendation"

Those require traversable relations and temporal facts, not only chunks. Vectors remain useful, but only as one retrieval lane.

## Why this is stronger than Microsoft-style batch GraphRAG alone

Microsoft GraphRAG is excellent for corpus-level indexing, entity extraction, communities and global/local query patterns. Its public docs describe indexing into text units, entities, relationships, covariates, communities and reports, then querying through local/global/DRIFT/basic modes. That is useful for batch corpora, but Finance-OS also needs low-latency evolving memory: personal snapshots, changing costs, stale assumptions, superseded facts and live market/news events. Batch GraphRAG can become one rebuild source, not the online memory layer.

Reference: https://microsoft.github.io/graphrag/

## Why this is stronger than only Postgres graph-like tables

Postgres remains canonical for personal finance source data, but graph-like tables in Postgres would make multi-hop traversal, path explanation, relation weighting, graph algorithms and graph-native operational tooling awkward. It would also tempt the advisor to mix source-of-truth transactional data with derived memory. Finance-OS keeps canonical finance data in Postgres and rebuilds graph memory from canonical sources.

## Why this complexity is appropriate for a single-user app

This app is private and self-hosted, so the complexity budget can favor intelligence, observability and personal performance over SaaS simplicity. The architecture is still bounded:

- one internal service boundary
- deterministic local fallback
- no public graph endpoint
- no hidden provider calls
- rebuildable from canonical sources
- explicit scopes: `demo`, `admin`, `internal`
- no trading execution

## Alternatives Compared

### Plain vector RAG

Rejected as primary. It lacks explicit relation semantics, temporal validity, contradiction preservation and explainable graph paths.

### Microsoft GraphRAG

Useful as a future batch corpus/rebuild pipeline, but not enough alone for online temporal memory and personal event evolution.

### LightRAG

LightRAG combines graph structures with vector retrieval and is a good conceptual reference for low-cost hybrid retrieval. It does not by itself solve Finance-OS temporal validity, provenance, personal snapshots or admin/demo split.

Reference: https://github.com/HKUDS/LightRAG

### HippoRAG

HippoRAG's hippocampal-inspired retrieval with knowledge graphs and Personalized PageRank is highly relevant for multi-hop reasoning. Finance-OS should borrow the PPR/relation-propagation idea once Neo4j GDS is wired. It is a retrieval method, not the complete operational memory architecture.

Reference: https://github.com/OSU-NLP-Group/HippoRAG

### Graphiti / Zep temporal graph memory

Best conceptual fit. Graphiti is explicitly temporally aware and combines episodic ingestion, semantic search, BM25 and graph traversal for agent memory. Finance-OS adopts this style, with finance-specific schemas and strict deterministic fallback.

References:

- https://github.com/getzep/graphiti
- https://help.getzep.com/graphiti/graphiti/overview

### Cognee-style memory

Cognee-style graph/vector/provenance memory is a strong reference for making memory operational and queryable across structured and unstructured sources. Finance-OS adopts the graph + vector + provenance pattern but keeps the domain schema local.

Reference: https://docs.cognee.ai/

## Backend Comparison

### Kuzu

Kuzu is attractive as an embedded graph database with Cypher-style querying, full-text and vector capabilities. It is not selected as the primary production backend because the main GitHub repository was archived on October 22, 2025, which raises maintenance and ecosystem risk for a long-lived Finance-OS memory layer.

Reference: https://github.com/kuzudb/kuzu

### Neo4j

Selected graph target. Neo4j has mature property graph semantics, Cypher, indexes, full-text search, vector support, GraphRAG ecosystem and Graph Data Science algorithms. It is the best fit for explainable paths, temporal relation modeling, PageRank-style expansion and migration optionality.

Reference: https://neo4j.com/docs/neo4j-graphrag-python/current/

### Memgraph

Strong real-time graph database option with OpenCypher and graph algorithms. It remains a migration candidate if streaming ingestion becomes dominant. Neo4j wins now for GraphRAG ecosystem depth and operational familiarity.

Reference: https://memgraph.com/docs

### FalkorDB

Good Redis-compatible graph option with GraphRAG positioning and vector/full-text features. It remains a candidate for lower-latency Redis-adjacent graph workloads. Neo4j is preferred for ecosystem, tooling and graph algorithm maturity.

Reference: https://docs.falkordb.com/

## Vector Backend Comparison

### Qdrant

Selected vector target. Qdrant supports dense vectors, sparse vectors and hybrid retrieval/reranking patterns. It is a good fit for self-hosted hybrid semantic retrieval and future local embedding pipelines.

Reference: https://qdrant.tech/documentation/advanced-tutorials/reranking-hybrid-search/

### LanceDB

Strong embedded/table-oriented vector store with hybrid search and reranking. It is attractive for local-first experimentation, but Qdrant is preferred for service-style self-hosted retrieval and operational separation from the graph.

Reference: https://lancedb.github.io/lancedb/

### pgvector

Useful when vectors should live in Postgres and operational simplicity dominates. Rejected as primary because Finance-OS needs graph-native traversal plus high-performance hybrid vector/sparse retrieval without overloading canonical Postgres.

Reference: https://github.com/pgvector/pgvector

## Full-Text / BM25 Strategy

Production:

- Neo4j full-text indexes for graph-native entity/relation search.
- Qdrant sparse-vector retrieval where useful for BM25-like lexical recall.
- Service-level fallback BM25 for deterministic tests and degraded operation.

Local fallback:

- Tokenized BM25-like scoring over entity labels, descriptions, tags and safe metadata.

## Temporal Memory Strategy

Every important node and relation supports:

- `observedAt`
- `validFrom`
- `validTo`
- `invalidatedAt`
- `supersededBy`
- `sourceTimestamp`
- `ingestionTimestamp`

Changed facts do not overwrite history blindly. The current entity/relation can be superseded while the old fact is retained as historical memory. Contradictory facts use `CONTRADICTED_BY`, `WEAKENS` and `INVALIDATES` relations and can coexist until evidence resolves them.

## Retrieval and Reranking

The retrieval router combines:

1. BM25/full-text score
2. vector similarity
3. graph traversal score
4. relation weight
5. temporal recency
6. confidence
7. provenance count/quality

Future production graph traversal should add Personalized PageRank over relation-weighted neighborhoods for multi-hop Finance-OS explanations.

## Rebuild Strategy

Graph memory must be rebuildable from canonical persisted sources:

- curated seed knowledge
- Postgres personal finance snapshots
- existing news context bundle
- existing markets context bundle
- advisor recommendations and assumptions
- model usage and AI cost ledger
- future Twitter/X signals
- future Trading Lab paper observations
- future manual notes

The graph is derived memory, not source of truth for transactions, accounts, tokens or provider state.

## Backup Strategy

- Postgres remains backed up as canonical finance data.
- Neo4j and Qdrant volumes are backed up as derived memory for fast restore.
- The deterministic seed and ingestion adapters allow full rebuild when graph/vector stores are lost.
- Local fallback writes JSON graph snapshots for dev/test portability.

## Privacy and Safety

- No secrets in `VITE_*`.
- No Powens codes/tokens, provider tokens, cookies, raw LLM sensitive context or personal financial PII in logs.
- Raw payload storage is optional, redacted and truncated.
- Demo mode uses deterministic fixtures only.
- Admin mode can persist real knowledge behind admin/internal access.
- No trading execution exists. Trading/technical concepts are knowledge-only and paper-trading-ready, not live order logic.

## Observability

The service tracks:

- ingest count
- dedupe count
- entity/relation counts
- contradiction count
- superseded fact count
- query latency
- graph traversal latency
- vector retrieval latency
- full-text retrieval latency
- context bundle token estimate
- rebuild duration
- last successful rebuild
- failure reason
- fallback usage
- storage size where available

`x-request-id` is propagated from web/API into the knowledge service.

## AI Advisor Integration

`packages/finance-engine` produces deterministic snapshots and recommendations first. `packages/ai` defines `KnowledgeContextBundle` as compact enrichment/challenge context. The advisor may request a bundle before LLM drafting or challenger review, but must surface confidence, unknowns and contradictions.

The graph must never become a hidden execution dependency. If unavailable, advisor routes remain usable with deterministic output and clear degraded messaging.

## Future Integrations

Twitter/X ingestion:

- `TweetSignal` nodes are already modeled.
- Ingestion must be shadow/admin-only, source-scored and never used as sole recommendation evidence.

Trading Lab:

- `TradingStrategy`, `Indicator`, slippage, fees, spread, bias and paper-trading nodes are modeled.
- Real trading/order execution is explicitly out of scope.

Model-router/token-cost intelligence:

- `Model`, `AgentSkill`, `AgentRun`, `CostObservation` and `TokenUsageObservation` are modeled.
- These support cost and routing analysis while staying separate from the AI Advisor financial recommendation pipeline.

## Agentic Pipeline Separation

AI Advisor memory is for personal financial reasoning. The agentic development pipeline is repo automation. They may both store model/cost observations, but the graph must label agentic facts separately and must not treat development automation outcomes as financial advice.

## Migration Path

The service API isolates callers from backend details:

- `POST /knowledge/ingest`
- `POST /knowledge/query`
- `POST /knowledge/context-bundle`
- `POST /knowledge/rebuild`
- `GET /knowledge/stats`
- `GET /knowledge/schema`
- `POST /knowledge/explain`

Backend migration can move from local JSON to Neo4j/Qdrant, or later to Memgraph/FalkorDB/LanceDB/pgvector, without changing `apps/api`, `packages/ai` or UI contracts. The only required stable contract is the temporal graph schema and `KnowledgeContextBundle` response shape.
