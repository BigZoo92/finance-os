# Finance-OS VPS-0 Runtime Audit

Status: prepared, not executed
Owner: TBD
Target environment: production VPS
Safety: read-only audit only; do not print secrets; do not restart services; do not delete volumes.

## 1. Executive Summary

VPS-0 verifies the actual production runtime before any UI/UX refactor starts.
The audit must answer:

- What commit/image is deployed?
- Are all expected containers healthy?
- Are API, worker, DB, cache, graph, vector, and knowledge services stable?
- Are jobs running at the intended frequency and in the intended dry-run/real-run mode?
- Are providers and cost-generating integrations under control?
- Is there a minimal backup/rollback path?

Current result: pending. No production command has been run for this document.

## 2. Container State

Capture:

- deployed commit SHA;
- image names, tags, digests, and build dates;
- deployment date and deploy actor/source if available;
- `docker ps`;
- `docker compose ps`;
- container healthchecks.

Expected containers to check when present:

- `web`;
- `api`;
- `worker`;
- `postgres`;
- `redis`;
- `qdrant`;
- `neo4j`;
- `knowledge-service`;
- `quant-service`.

Read-only command checklist:

```bash
git rev-parse HEAD
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker compose ps
docker inspect --format '{{.Name}} {{.Config.Image}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' $(docker ps -q)
```

## 3. Critical Services

Collect recent logs without secrets:

- web logs;
- api logs;
- worker logs;
- knowledge-service logs;
- redis logs;
- postgres logs;
- qdrant logs;
- neo4j logs.

Audit points:

- API 5xx count and top endpoints;
- normalized safe error payloads;
- `x-request-id` propagation in logs;
- reverse proxy status;
- HTTPS certificate validity;
- production domain routing;
- `/api/*` proxying through web to internal API.

Read-only command checklist:

```bash
docker compose logs --since=24h web
docker compose logs --since=24h api
docker compose logs --since=24h worker
docker compose logs --since=24h knowledge-service
docker compose logs --since=24h redis
docker compose logs --since=24h postgres
docker compose logs --since=24h qdrant
docker compose logs --since=24h neo4j
curl -I https://<domain>/
curl -I https://<domain>/api/health
```

## 4. Envs And Secrets

Do not print secret values. Record only presence, empty/missing status, and source file/provider.

Check critical env groups:

- admin auth/session settings;
- `API_INTERNAL_URL`;
- database URL;
- Redis URL;
- Powens credentials and encryption key material;
- IBKR Flex read-only settings;
- Binance signed read-only Spot/Wallet GET settings;
- knowledge-service URL and feature flags;
- Qdrant and Neo4j connection settings;
- AI/provider keys if enabled;
- job dry-run flags;
- public `VITE_*` variables for accidental secret exposure.

Read-only command pattern:

```bash
docker compose config
# For env presence only, use a redacting helper or print key names with PRESENT/MISSING, never values.
```

## 5. DB And Migrations

Capture:

- Postgres container health;
- schema migration table state;
- latest applied migration;
- pending migrations if tooling supports a dry status command;
- DB size and disk growth;
- recent connection or migration errors.

Read-only command checklist:

```bash
docker compose exec postgres pg_isready
# Use application migration status command if it is read-only in production.
# Avoid running migrate/deploy until backup and rollback are confirmed.
```

## 6. Jobs, Runs, And Workers

Audit:

- active worker processes;
- cron entries or scheduler source;
- queue names and depths;
- Redis locks;
- retry/dead-letter state;
- actual run frequency by job type;
- dry-run vs real-run flags;
- duplicate triggers;
- duplicate accounts/providers.

Focus areas:

- Powens sync jobs;
- IBKR Flex ingestion;
- Binance read-only ingestion;
- external investments normalization;
- knowledge graph ingestion/enrichment;
- X/Twitter/Social jobs and any cost-generating run.

Read-only command checklist:

```bash
docker compose logs --since=7d worker
docker compose exec redis redis-cli --scan
# If Redis contains secrets or tokens, only count/list safe prefixes; do not dump values.
```

## 7. Costs And Providers

Record status and estimated recent volume for:

- Powens;
- IBKR Flex;
- Binance Spot/Wallet read-only;
- X/Twitter/Social;
- AI model calls;
- embeddings;
- Qdrant/Neo4j/knowledge-service processing;
- scheduled runs that can create external API cost.

Required distinction:

- dry-run path;
- real-run path;
- whether demo mode uses deterministic mocks only.

## 8. Anomalies

Use this table during the live audit:

| Priority | Area | Evidence | Impact | Confidence | Recency | Score | Owner | Next Step |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TBD | TBD | TBD | 0-5 | 0-3 | 0-2 | TBD | TBD | TBD |

Priority mapping:

- critical -> P0;
- high -> P1;
- medium/low -> P2.

Score = impact (0-5) + confidence (0-3) + recency (0-2).

## 9. Risks

Initial risks to verify:

- production may not match the latest repository commit;
- container health may hide application-level 5xx;
- worker retry loops may inflate provider/API/AI costs;
- dry-run and real-run flags may be unclear in production;
- duplicate provider accounts may double ingestion;
- knowledge-service, Qdrant, or Neo4j may fail soft but silently degrade Advisor memory;
- backup and rollback path may be undocumented or untested.

## 10. Prioritized Action Plan

1. Confirm deployed version: commit SHA, images/tags/digests, deploy date.
2. Capture container health and recent logs for web, api, worker, DB/cache/graph/vector services.
3. Verify reverse proxy, HTTPS, domain, and `/api/*` internal proxy behavior.
4. Verify env presence with redaction and confirm no secrets are exposed through `VITE_*`.
5. Verify DB migration state and backup/rollback readiness before any write action.
6. Audit worker schedules, queue depth, Redis locks, retries, and run frequency.
7. Audit provider state and cost-generating jobs, especially X/Twitter/Social, AI, embeddings, Powens, IBKR, Binance.
8. Produce anomaly table with priority, score, owner, and next step.

## Debug Roadmap

1. `CI-0` - Restore green CI.
2. `VPS-0` - Runtime production audit.
3. `RUNS-0` - Audit job frequency, triggers, and retries.
4. `COSTS-0` - Audit global costs, X/Twitter/Social, AI, embeddings, dry-run vs real.
5. `MEMORY-0` - Debug Neo4j, Qdrant, knowledge-service, and graph endpoint.
6. `ROUTES-CLEANUP-0` - Clean removals: Fiscalite, Sources, Free Firehose page, Env Diagnostics, Parametres if unused, ReactBits outside login.
7. `CATEGORIZATION-0` - Learn from manual expense corrections.
8. `UI-A11Y-PERF-0` - Lighthouse/Core Web Vitals/a11y/bundle baseline.
