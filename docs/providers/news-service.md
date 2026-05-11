# Provider: `news-service`

> Aggregation-level wrapper around the existing `NewsProviderAdapter` pool
> (HN / GDELT / ECB-RSS / ECB-Data / Fed-RSS / SEC-EDGAR / FRED / X-Twitter, etc.).
> Migrated in **Macro Prompt 3** (2026-05-09). The wrapper exposes a single
> `Provider<news.items.read>` over the union of registered news adapters; the
> `/dashboard/news` GET route and `/dashboard/news/ingest` admin route continue to
> consume the underlying pool directly. **Public API response shapes are unchanged.**

## Provider id

`news-service`

## Capabilities

- `news.items.read` — read-only aggregation of news items across the registered upstream
  adapter pool.

The wrapper does not declare any other capability and never will. News ingestion (DB
writes) remains in `dashboard.useCases.ingestNews`; the wrapper itself only fetches and
returns counts.

## Mode behavior

| Mode | Behavior |
|---|---|
| `demo` | Returns a deterministic snapshot with `fetchedCount: 0` and per-adapter `status: 'skipped'`. NEVER calls `fetchItems`, NEVER hits the network, NEVER reads the DB. |
| `admin` | Iterates the adapter pool. Disabled adapters are reported as `skipped`. Enabled adapters are invoked via their existing `fetchItems` implementation; per-adapter exceptions are caught and reported as `failed` with `errorCode: 'provider_unavailable'`. The wrapper returns `providerOk` with mixed statuses unless **every** enabled adapter failed, in which case it surfaces `provider_unavailable`. |

## Credentials

The wrapper itself reads no env vars and stores no credentials. Underlying adapters honor
their existing env flags + key configuration unchanged:

- `NEWS_PROVIDER_HN_ENABLED`, `NEWS_PROVIDER_GDELT_ENABLED`, `NEWS_PROVIDER_ECB_RSS_ENABLED`,
  `NEWS_PROVIDER_ECB_DATA_ENABLED`, `NEWS_PROVIDER_FED_RSS_ENABLED`,
  `NEWS_PROVIDER_SEC_EDGAR_ENABLED`, `NEWS_PROVIDER_FRED_ENABLED`,
  `NEWS_PROVIDER_X_TWITTER_ENABLED`.
- `NEWS_PROVIDER_FRED_API_KEY`, `NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN` (loaded by
  `packages/env`, never logged).

Per-adapter credentials are not surfaced through the wrapper; only counts/status/durations
leave this module.

## Cache / freshness

- No additional cache layer added by the wrapper. Each underlying adapter retains its own
  `cooldownMs` semantics.
- `freshnessMinutes` reported on success: `0` (the call performed a fresh fetch). The
  wrapper does not cache aggregated results.
- `freshnessPolicy.allowCache === false` is currently a no-op — the wrapper always issues
  fresh per-adapter fetches in admin mode.

## Error mapping

| Upstream signal | `ProviderErrorCode` | `retryable` |
|---|---|---|
| 0 enabled adapters | `disabled_by_flag` | `false` |
| All enabled adapters threw | `provider_unavailable` | `true` |
| Some adapters succeeded, some threw | `providerOk` with per-source `status: 'failed'` and `errorCode: 'provider_unavailable'` (overall result is success-with-degradation) | n/a |
| Caller in demo mode | `providerOk` with deterministic empty snapshot | n/a |

The wrapper never exposes upstream HTTP status codes, response bodies, or thrown error
messages to its callers.

## Redaction notes

- `NewsProviderRawItem.title` / `summary` / `contentSnippet` / `providerUrl` /
  `canonicalUrl` / `rawPayload` and any `metadata` keys are NEVER returned in the wrapper's
  output DTO. The output carries only `provider`, `status`, `enabled`, `fetchedCount`,
  `durationMs`, and `errorCode` per source plus an aggregate `fetchedCount` and
  `retrievedAt`.
- Per-adapter `try/catch` blocks intentionally drop the caught exception. The exception
  object can include URLs (potentially carrying `?token=` query parameters) and raw
  upstream JSON; none of that ever leaves the catch block.
- Log emissions go through `logProviderEvent` (closed-vocab fields + redaction harness
  from `@finance-os/provider-runtime`). Tests assert that synthetic upstream payloads
  containing fake tokens, URLs, and raw bodies never appear in any captured log line.

## Health check

- `getHealth().status` is `'ok'` if at least one adapter is enabled and the most recent
  call had no failures.
- Flips to `'degraded'` when the last call had at least one adapter success AND at least
  one adapter failure.
- Flips to `'down'` when 0 adapters are enabled OR every enabled adapter failed in the
  last call.
- `lastSuccessAt` reflects the wrapper's last `providerOk` timestamp; `lastErrorCode`
  carries the closed-vocab code for the last failure.

`getHealth()` is a synchronous snapshot computed during `call()`; it never performs IO.

## Tests

- `assertProviderContract(provider)` — shape sanity.
- `assertProviderDoesNotExposeForbiddenCapabilities(provider)` — only `news.items.read` is
  declared; no trading / payment / write capability is reachable from the wrapper.
- `assertProviderResultSafe(...)` on representative ok/err results.
- `assertProviderLogsSafe(...)` over captured log lines.
- Redaction proof: a fake `NewsProviderRawItem` carrying a URL with `?token=SECRET-TOKEN-7`
  and a `RAW ARTICLE BODY` placeholder is fed into stub adapters; tests then assert that
  neither the secret token nor the raw body appears in the wrapper's output DTO or any
  captured log line.
- `disabled_by_flag` path verified to never invoke `fetchItems`.

See `apps/api/src/routes/dashboard/services/providers/news-service-provider.test.ts`.

## Known limitations

- The wrapper is registered in `createInternalProviderRegistry` but **not consumed by
  any production route or use-case yet**. It exists today to populate the
  `/dashboard/providers/diagnostics` endpoint and to lock the contract surface. Rewiring
  `/dashboard/news` and `/dashboard/news/ingest` through the wrapper is deferred to a
  follow-up macro prompt.
- Per-source wrappers (one `Provider<C>` per upstream adapter) are intentionally NOT
  introduced. The aggregation-level wrapper preserves the existing `NewsProviderAdapter`
  shape and minimizes migration surface.
- The wrapper does not deduplicate across adapters; that responsibility stays in
  `createLiveNewsIngestionService`.

## ToS / legal notes

- News content licensing remains governed by each upstream provider (HN Algolia public API,
  GDELT public dataset, ECB / Fed / SEC public RSS, FRED with attribution, X-Twitter under
  developer ToS). The wrapper does not change attribution or caching constraints.
- The wrapper does not redistribute article content; only aggregate counts surface.

## No execution guarantee

This adapter implements only `news.items.read`. No `trading.*`, `crypto.swap.*`,
`crypto.transfer.*`, `payment.*`, `bank.transfer.*`, or any other write/execution
capability is implemented or planned. The wrapper makes no broker, exchange, or
payment-system calls.
