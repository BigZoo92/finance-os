# Env in production — service responsibilities

Last reviewed: 2026-08-08.

Most worker schedulers trigger API routes, so their provider secrets remain
API-only. External investment ingestion is the deliberate exception: the
worker calls IBKR Flex and Binance read-only endpoints directly, so their
credentials are injected into both worker (execution) and API (configuration
presence only). The API also receives Daily Intelligence scheduler envs so
`/ops/scheduler/status` can report configured next runs without exposing
worker internals.

This document is the operator-facing contract. The machine-readable truth
lives in [`packages/env/src/diagnostics.ts`](../../packages/env/src/diagnostics.ts).
If you change the table below, change the diagnostics module in the same PR.

## Tooling

```bash
pnpm env:check               # diagnose current process env per service
pnpm env:check:compose       # also check docker-compose.prod.yml parity
pnpm env:check:parity        # parity-only (used in CI)
pnpm env:check:prod          # load .env.production.local then diagnose
```

The same data is exposed at runtime to admins via
`GET /ops/env/diagnostics`. It returns per-service feature rows with
`enabled`, `configured`, `canRun`, `missingRequiredSecrets`, and a
`reasonIfBlocked` string. No secret values are returned — only names and
lengths.

## Service ownership

| Feature flag                            | Executing service | Required env (executing service) |
| --- | --- | --- |
| `NEWS_PROVIDER_X_TWITTER_ENABLED`       | api    | `NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN` |
| `X_DAILY_PREVIOUS_DAY_SYNC_ENABLED`     | api    | `NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN`, `X_DAILY_BUDGET_USD`, `X_MONTHLY_BUDGET_USD` |
| `NEWS_PROVIDER_SEC_ENABLED`             | api    | `SEC_USER_AGENT` |
| `NEWS_PROVIDER_FRED_ENABLED`            | api    | `FRED_API_KEY` |
| `MARKET_DATA_EODHD_ENABLED`             | api    | `EODHD_API_KEY` |
| `MARKET_DATA_TWELVEDATA_ENABLED`        | api    | `TWELVEDATA_API_KEY` |
| `MARKET_DATA_FRED_ENABLED`              | api    | `FRED_API_KEY` |
| `AI_ADVISOR_ENABLED` (not local-only)   | api    | at least one of `AI_OPENAI_API_KEY`, `AI_ANTHROPIC_API_KEY` |
| `AI_POST_MORTEM_ENABLED`                | api    | at least one of `AI_OPENAI_API_KEY`, `AI_ANTHROPIC_API_KEY` |
| `KNOWLEDGE_SERVICE_ENABLED`             | api    | `KNOWLEDGE_SERVICE_URL` (Neo4j/Qdrant creds stay on knowledge-service) |
| `QUANT_SERVICE_ENABLED`                 | api    | `QUANT_SERVICE_URL` |
| `IBKR_FLEX_ENABLED`                     | worker | `IBKR_FLEX_TOKEN`, `IBKR_FLEX_QUERY_IDS` |
| `BINANCE_SPOT_ENABLED`                  | worker | `BINANCE_SPOT_API_KEY`, `BINANCE_SPOT_API_SECRET` |
| `POWENS_*`                              | api    | `POWENS_CLIENT_ID`, `POWENS_CLIENT_SECRET`, `POWENS_DOMAIN`, `APP_ENCRYPTION_KEY` |
| `FREE_FIREHOSE_ENABLED`                 | api    | none mandatory (caps + `SEC_USER_AGENT`, `FRED_API_KEY` recommended if sub-providers enabled) |

The **worker** receives only:

- Scheduler flags & timing: `DAILY_INTELLIGENCE_NIGHT_CRON`,
  `DAILY_INTELLIGENCE_MORNING_CRON`, legacy `DAILY_INTELLIGENCE_CRON`,
  `DAILY_INTELLIGENCE_TIMEZONE`, `DAILY_INTELLIGENCE_LOCK_TTL_SECONDS`,
  `DAILY_INTELLIGENCE_DRY_RUN_DEFAULT`, `X_DAILY_PREVIOUS_DAY_CRON`,
  `AI_POST_MORTEM_CRON`, `NEWS_FETCH_INTERVAL_MS`, etc.
- `API_INTERNAL_URL` + `PRIVATE_ACCESS_TOKEN`.
- Database / Redis URLs.
- Binance valuation enrichment flags (`EXTERNAL_INVESTMENTS_BINANCE_VALUATION_*`).
- Read-only IBKR/Binance credentials (`IBKR_FLEX_TOKEN`, `IBKR_FLEX_QUERY_IDS`,
  `BINANCE_SPOT_API_KEY`, `BINANCE_SPOT_API_SECRET`). The API receives the same
  values only to report configuration presence; neither service serializes them.

**The worker MUST NOT carry** `NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN`,
`EODHD_API_KEY`, `TWELVEDATA_API_KEY`, `FRED_API_KEY`, `AI_OPENAI_API_KEY`,
`AI_ANTHROPIC_API_KEY`. If they are present on the worker container, the
parity check will eventually flag them as a security leak.

## Common diagnostic outcomes

| `/ops/env/diagnostics` reports                          | Meaning |
| --- | --- |
| `enabled=true canRun=true`                              | Feature flag on, secret(s) present. Should work. |
| `enabled=true canRun=false reason="Missing required…"` | Flag on but operator forgot to set the secret in Dokploy. **Set it or disable the flag.** |
| `enabled=true canRun=false reason="Placeholder…"`      | Flag on but the value looks like `TODO` / `changeme` / `<token>`. Replace it. |
| `enabled=false`                                         | Disabled by config. No action needed. |

## When `pnpm env:check` fails in CI

The most common cause is a new feature was added in code but the matching
`environment:` block in `docker-compose.prod.yml` wasn't updated. Add the
key to the corresponding service block — `api`, `worker`, `web`,
`knowledge-service`, `quant-service`, `ops-alerts` — and re-run.

If the diagnostics module flags a NEW required key that doesn't actually
need to live in the executing service (e.g. read from DB), update
`FEATURE_REQUIREMENTS` in `diagnostics.ts` to reflect reality.
