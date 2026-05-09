# Provider: `<provider-id>`

> Copy this file to `docs/providers/<provider-id>.md` and fill in every section before
> registering the adapter. See [`docs/providers/README.md`](./README.md) for the
> required invariants.

## Provider id

Stable string used as `Provider.id`. Lowercase, hyphenated. Example: `eodhd`,
`twelve-data`, `powens`, `binance-spot`.

## Capabilities

List the `ProviderCapability` keys this adapter implements. Each capability gets its
own `Provider<C>` object. If a capability is not already in
`ALLOWED_PROVIDER_CAPABILITIES`, stop and amend the ADR first.

## Mode behavior

| Mode | Behavior |
|---|---|
| `demo` | … (synthetic / cached / fail with `demo_mode_forbidden` if private) |
| `admin` | … (live upstream call honoring budget + freshness policies) |

Document explicitly which fields are zeroed/redacted in demo, and what the cached
fixture path is.

## Credentials

- Env vars consumed (e.g., `EODHD_API_KEY`).
- Default-off env flag (e.g., `MARKET_DATA_EODHD_ENABLED`).
- Where credentials are loaded (must be an internal config layer, never `VITE_*`).
- Rotation procedure if the credential is per-user.

## Cache / freshness

- Cache layer (Redis, in-memory, none).
- Default `freshnessMinutes` reported on success.
- Behavior when `freshnessPolicy.allowCache === false`.
- Behavior when upstream is unreachable but cache is fresh (return ok with `fromCache`,
  or `provider_unavailable`).

## Error mapping

Document the mapping from upstream symptoms to `ProviderErrorCode`:

| Upstream signal | `ProviderErrorCode` | `retryable` |
|---|---|---|
| HTTP 401 / 403 | `auth_failed` | `false` |
| HTTP 404 | `not_found` | `false` |
| HTTP 429 | `rate_limited` | `true` |
| HTTP 5xx | `transient` | `true` |
| Network timeout | `transient` | `true` |
| TOS violation / blocked country | `tos_blocked` | `false` |
| Missing config | `unconfigured` | `false` |
| Provider disabled by flag | `disabled_by_flag` | `false` |
| Caller in demo mode | `demo_mode_forbidden` | `false` |
| Cache older than budget | `stale_cache` | `false` |
| Anything else | `provider_unavailable` | `true` |

## Redaction notes

- Which upstream fields might contain secrets (signed URLs, query strings, headers).
- Any custom sensitive-key fragments passed to `createSensitiveKeyMatcher`.
- Confirmation that no raw upstream JSON ever reaches a log line, browser response, or
  LLM prompt.

## Health check

How `getHealth()` is computed:

- `lastSuccessAt` source (e.g., last successful call timestamp).
- When `status` flips to `degraded` (e.g., last 3 calls failed but cache is fresh).
- When `status` flips to `down` (e.g., `auth_failed` or `tos_blocked`).

Health MUST NOT perform IO; precompute during `call()`.

## Tests

Required suites:

- `assertProviderContract(provider)` — shape sanity.
- `assertProviderDoesNotExposeForbiddenCapabilities(provider)` — never a write.
- `assertProviderResultSafe(...)` on representative ok and err results.
- `assertProviderErrorSafe(error)` on every code your adapter can produce.
- A redaction proof that a synthetic upstream payload carrying every sensitive
  fragment never appears in your DTO output.

## Known limitations

- Rate limits (RPS / RPM / RPD).
- Coverage gaps (regions, symbols, ranges).
- Cost ceilings.

## ToS / legal notes

- License of upstream data (per-symbol, per-page).
- Attribution requirements rendered to the user when the data is used.
- Constraints on caching / redistribution.

## No execution guarantee

State explicitly: this adapter implements only read capabilities. No
`trading.*`, `crypto.swap.*`, `crypto.transfer.*`, `payment.*`, or `bank.transfer.*`
capabilities are implemented or planned.
