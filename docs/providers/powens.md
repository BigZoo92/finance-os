# Provider: `powens`

> Health-only `Provider<C>` wrapper around the local Powens connection-status snapshot.
> Migrated as a foundation in **Macro Prompt 4** (2026-05-09). The wrapper is the
> canonical contract entry point for `banking.accounts.read`; the existing
> `/integrations/powens/*` routes, the Powens worker sync, and the
> `/dashboard/transactions` snapshot path continue to consume the underlying
> `packages/powens` client and `powensConnection` repository directly. **Read routing
> through `provider.call()` is deferred — the wrapper currently exposes only a health
> snapshot. Public API response shapes are unchanged. Sync behavior is unchanged.
> Credential storage and encryption are unchanged.**

## Provider id

`powens`

## Capabilities

- `banking.accounts.read` — declared so the wrapper appears in the registry and the
  `/dashboard/providers/diagnostics` endpoint with a known capability surface.

`banking.transactions.read` is intentionally NOT registered as a separate wrapper in
this batch. There is one local read source today and adding a second wrapper before
its read path is rewired through `provider.call()` would be empty surface area.

The wrapper does not declare any other capability and never will. Forbidden
capabilities (`bank.transfer.create`, `payment.charge.create`, `trading.*`,
`crypto.*.execute`, etc.) are NOT implemented or planned.

## Mode behavior

| Mode | Behavior |
|---|---|
| `demo` | The `/dashboard/providers/diagnostics` route — the only consumer of this wrapper today — short-circuits demo callers to a deterministic empty fixture before reaching the wrapper. The wrapper itself never reads from Powens or the local DB on a demo path. |
| `admin` | `provider.call()` returns `unsupported_capability` with `safeDetails.reason = "deferred_read_routing"` (see "Error mapping"). `getHealth()` returns the latest snapshot computed by the most recent `refreshHealth()` invocation. |

## Credentials

The wrapper reads NO credentials, NO env vars, and NO secrets directly. It is wired
purely from a closure that reads the local `powensConnection` table:

- `APP_ENCRYPTION_KEY` — used by `packages/powens/src/crypto.ts` for token storage.
  **The wrapper does NOT read or decrypt tokens.** Encryption logic is unchanged.
- `POWENS_*` env vars — consumed by the existing Powens client and routes (connect,
  callback, sync). The wrapper does NOT read these.

The injected `listConnectionStatuses` closure (see
[runtime.ts](../../apps/api/src/routes/dashboard/runtime.ts)) projects only the
non-sensitive columns used for health derivation:

- `status`, `lastSyncStatus`, `lastSuccessAt`, `lastFailedAt`

It explicitly excludes `accessTokenEncrypted`, `lastError`, `syncMetadata`,
`powensConnectionId`, `providerInstitutionName`, and any other column that could carry
credentials, account identifiers, or raw error bodies.

## Cache / freshness

- `getHealth()` returns an **in-memory snapshot** computed by the most recent
  `refreshHealth()` call. It NEVER performs IO.
- The dashboard runtime exposes `refreshProviderHealth()`, which the
  `/dashboard/providers/diagnostics` admin route awaits before reading `getHealth()`.
- There is no upstream Powens cache layer added by the wrapper. Demo callers never
  trigger a refresh. The diagnostics route omits the refresh on the demo path.
- `freshnessMinutes` is reported as `null` on the deferred error result (no fresh
  fetch is performed).

## Error mapping

| Upstream / local signal | `ProviderErrorCode` | `retryable` |
|---|---|---|
| Any caller of `provider.call()` | `unsupported_capability` (with `safeDetails.reason = "deferred_read_routing"`) | `false` |

`provider.call()` does NOT proxy to Powens, the local repository, or any upstream.
The wrapper is health-only until a follow-up macro prompt rewires read routing.

Health-state mapping (from `listConnectionStatuses()` snapshot):

| Local snapshot | `ProviderHealth.status` | `lastErrorCode` |
|---|---|---|
| 0 active connections | `degraded` | `unconfigured` |
| All connections in `error` state with no recent success | `down` | `provider_unavailable` |
| Any connection in `reconnect_required` | `degraded` | `auth_failed` |
| At least one success + some `error` / `KO` syncs | `degraded` | `transient` |
| At least one connection with recent success and no errors | `ok` | `null` |
| Connections present but no successful sync yet | `degraded` | `unconfigured` |
| Repository read fails (DB unavailable) | `degraded` | `transient` |

`down` is explicitly RESERVED for a configured provider with a clear repeated local
failure state. Unconfigured / unknown / disabled scenarios soft-fail to `degraded` so
operator dashboards do not page over a freshly-deployed environment with no Powens
connection yet.

## Redaction notes

- The wrapper's input/output shape is intentionally tiny (no upstream payload echo).
- `provider.call()` returns a `ProviderError` with `safeDetails: { reason: "deferred_read_routing" }`.
  The redaction harness (`redactProviderLogFields`) runs over `safeDetails` before it
  reaches any consumer.
- Log emissions go through `logProviderEvent` (closed-vocab fields + redaction). No
  Powens response body, callback code, encrypted token, account id, or
  `lastError` string ever reaches a log line, the output DTO, or the diagnostics
  surface.
- Repository exceptions thrown inside `refreshHealth()` are caught and DROPPED. The
  exception object can include connection ids and `lastError` body strings; none of
  that content ever leaves the catch block — only `lastErrorCode: 'transient'` and a
  closed-vocab note flag the failure.
- The wrapper never touches `accessTokenEncrypted`, OAuth state, or callback codes.
  These remain owned by `apps/api/src/routes/integrations/powens/*`.

## Health check

- `getHealth()` is a synchronous snapshot computed during `refreshHealth()`.
- Initial state (before first refresh): `degraded` + `lastErrorCode: 'unconfigured'`
  with note `'snapshot pending — refreshHealth() not yet invoked'`.
- `getHealth()` itself NEVER performs IO and NEVER throws.
- See the "Error mapping" table above for the full status flip rules.

## Tests

- `assertProviderContract(provider)` — shape sanity.
- `assertProviderDoesNotExposeForbiddenCapabilities(provider)` — only
  `banking.accounts.read` is declared.
- `assertProviderResultSafe(...)` on the deferred-call error result.
- `assertProviderLogsSafe(...)` over captured log lines.
- Health-state coverage: empty list / healthy / reconnect / mixed-error / hard-failure /
  repository exception scenarios are each asserted explicitly.
- Redaction proof: synthetic Powens token / account number / raw error body sentinels
  are injected through the repository-exception path and asserted absent from output
  and log lines.
- Diagnostics-time guarantee: `provider.call()` is never invoked by the diagnostics
  endpoint — only `getHealth()` is read.

See `apps/api/src/routes/dashboard/services/providers/powens-provider.test.ts`.

## Known limitations

- The wrapper is registered in `createInternalProviderRegistry` but **not consumed by
  any production route or use-case yet**. It exists today to populate the
  `/dashboard/providers/diagnostics` endpoint with a health-status snapshot and to
  lock the contract surface.
- `banking.transactions.read` is unwrapped in this batch; rewiring transaction reads
  through `provider.call()` is deferred.
- The wrapper does NOT call Powens. There is no live diagnostics probe; the existing
  `/integrations/powens/diagnostics` route (which CAN call Powens for an admin-only
  active diagnostic) remains separate and unchanged.

## ToS / legal notes

- Powens (Budget Insight) Terms of Service apply to all Powens client interactions.
  The wrapper performs no Powens interaction, so it does not change any ToS posture.
- The wrapper does not redistribute account data; only closed-vocabulary aggregate
  health fields surface via the diagnostics endpoint.

## No execution guarantee

This adapter implements only `banking.accounts.read` (read-only, deferred) and exposes
no execution capability. No `bank.transfer.create`, `payment.charge.create`,
`trading.*`, `crypto.*.execute`, or any other write capability is implemented or
planned. The wrapper makes no network calls of any kind — neither to Powens nor to
any upstream provider.
