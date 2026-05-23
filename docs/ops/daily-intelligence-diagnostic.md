# Daily Intelligence Diagnostic

Last updated: 2026-05-23

## Executive Summary

The worker heartbeat alone does not prove the Daily Intelligence Run is executing. Before this foundation pass, `DAILY_INTELLIGENCE_ENABLED` defaulted to `false`, the worker had one legacy cron, `/ops/refresh/all` delegated to the manual Advisor mission, and the social scheduler posted a trigger the API rejected with HTTP 422.

This pass makes the foundation explicit:

- `social_poll` is an accepted `/dashboard/news/ingest` trigger.
- Daily Intelligence has separate night and morning crons.
- `/ops/refresh/all` executes the `refresh-registry` topological plan and supports `dryRun`.
- `/ops/scheduler/status` exposes next runs and scheduler flags.
- `/ops/knowledge/enrichment/status` exposes Advisor memory/KG write visibility.
- Free Firehose admin quota override is explicit and audited.
- Additive DB tables now exist for price snapshots, valuation snapshots, provider health, FX, investment recommendations, hypotheses, outcomes, post-mortems, and memory events.

## Files Inspected

- Worker schedulers: `apps/worker/src/index.ts`, `daily-intelligence-scheduler.ts`, `social-signal-scheduler.ts`, `market-refresh-scheduler.ts`, `post-mortem-scheduler.ts`.
- API ops/news: `apps/api/src/routes/ops/refresh.ts`, `refresh-registry.ts`, `scheduler.ts`, `knowledge-enrichment-status.ts`, `dashboard/routes/news.ts`.
- Advisor/valuation foundations: `investment-recommendation-contract.ts`, `prediction-journal.ts`, `valuation-foundation.ts`.
- DB/env/runtime: `packages/db/src/schema/*`, `packages/env/src/index.ts`, `docker-compose.prod.yml`, `.env.example`, `.env.prod.example`.

## Confirmed Problems

- `SOCIAL_SIGNAL_HTTP_422` came from worker body `{ "trigger": "social_poll" }` while API accepted only `manual | scheduled`.
- The legacy Daily Intelligence scheduler only supported one cron and exposed no next-run calculation.
- `/ops/refresh/all` did not execute the registry dependency graph.
- KG read endpoints did not prove write activity.
- Advisor investment recommendations and prediction learning tables were absent.
- Free Firehose quota blocked admin live runs with no explicit override path.

## Current Architecture

Night and morning worker schedules both call:

```text
worker -> POST API_INTERNAL_URL/ops/refresh/all
       -> refresh-registry topological plan
       -> provider/use-case jobs
       -> job metrics + topological run status
```

The existing manual Advisor mission remains available through its original route and history. It is no longer mislabeled as the global `/ops/refresh/all` orchestrator.

## Production Validation Commands

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker logs --since 24h finance-os-worker 2>&1 | egrep 'daily intelligence|social signal|SOCIAL_SIGNAL|scheduler started'
docker logs --since 24h finance-os-api 2>&1 | egrep 'ops_refresh|dashboard_news_ingest|free_firehose'
docker exec finance-os-worker printenv | sort | egrep '^(DAILY_INTELLIGENCE|SIGNALS_SOCIAL|AI_POST_MORTEM|MARKET_DATA_AUTO|ATTENTION|API_INTERNAL_URL)='
docker exec finance-os-api printenv | sort | egrep '^(DAILY_INTELLIGENCE|KNOWLEDGE_SERVICE_ENABLED|ADVISOR_GRAPH_INGEST_ENABLED|FREE_FIREHOSE|MARKET_DATA|SIGNALS_SOCIAL)='
docker exec finance-os-redis redis-cli --scan --pattern '*lock*'
docker exec finance-os-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*), max(created_at) from asset_price_snapshot;"
docker exec finance-os-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*), max(created_at) from advisor_market_hypothesis;"
curl -sS -H "x-internal-token: $INTERNAL_API_TOKEN" http://127.0.0.1:3001/ops/scheduler/status | jq .
curl -sS -X POST -H "content-type: application/json" -H "x-internal-token: $INTERNAL_API_TOKEN" http://127.0.0.1:3001/ops/refresh/all -d '{"trigger":"scheduled","runKind":"night","dryRun":true}' | jq .
curl -i -X POST -H "content-type: application/json" -H "x-internal-token: $INTERNAL_API_TOKEN" http://127.0.0.1:3001/dashboard/news/ingest -d '{"trigger":"social_poll"}'
curl -sS http://127.0.0.1:6333/collections | jq .
docker exec finance-os-neo4j cypher-shell -u "$NEO4J_USERNAME" -p "$NEO4J_PASSWORD" 'MATCH (n) RETURN labels(n), count(*) ORDER BY count(*) DESC LIMIT 20;'
```

Do not print secret values. Only inspect presence, status, counts, and timestamps.

## Remaining Gaps

- Price providers are not yet fully wired into `asset_price_snapshot`.
- Advisor does not yet generate daily account-scoped investment recommendations automatically.
- Hypothesis review scheduling and KG memory writes have schema/status foundation but need full orchestration.
- API status lists Redis lock keys but does not yet read active lock values from Redis.
