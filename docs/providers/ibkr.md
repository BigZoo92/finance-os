# Provider: `ibkr`

> Health-only `Provider<C>` wrapper around the local IBKR Flex provider-health snapshot.
> Migrated as a foundation in **Macro Prompt 4** (2026-05-09). The wrapper declares
> `external_investments.positions.read` so the provider appears in
> `/dashboard/providers/diagnostics`. The existing `/dashboard/external-investments/*`
> routes, the `/integrations/external-investments/*` admin routes, and the worker
> sync continue to consume `packages/external-investments` directly. **Read routing
> through `provider.call()` is deferred. Public API response shapes are unchanged.
> Sync behavior is unchanged. Credential storage and encryption are unchanged.**

## Provider id

`ibkr`

## Capabilities

- `external_investments.positions.read` — declared so the wrapper appears in the
  registry with a known capability surface.

`external_investments.trades.read` is intentionally NOT registered as a separate
wrapper in this batch (same rationale as Powens — there is one local read source
today and a second wrapper before its read path is rewired through `provider.call()`
would be empty surface area).

The wrapper does not declare any other capability. Forbidden capabilities
(`trading.order.create`, `trading.order.cancel`, `trading.position.open`,
`trading.position.close`, etc.) are NOT implemented or planned.

## Mode behavior

| Mode | Behavior |
|---|---|
| `demo` | The `/dashboard/providers/diagnostics` route short-circuits demo callers to a deterministic empty fixture before reaching the wrapper. The wrapper itself never reads from IBKR or the local DB on a demo path. |
| `admin` | `provider.call()` returns `unsupported_capability` with `safeDetails.reason = "deferred_read_routing"`. `getHealth()` returns the latest snapshot computed by the most recent `refreshHealth()` invocation. |

## Credentials

The wrapper reads NO credentials, NO env vars, and NO secrets directly. It is wired
purely from a closure that reads two local tables (`externalInvestmentProviderHealth`
+ `externalInvestmentConnection`):

- `APP_ENCRYPTION_KEY` — used by `packages/external-investments/src/credentials.ts`
  to encrypt the Flex token payload. **The wrapper does NOT decrypt or read tokens.**
  Encryption logic is unchanged.
- `IBKR_FLEX_ENABLED` — feature flag consumed by the existing IBKR client + sync.
  The wrapper reads only the resolved boolean (`ibkrFlexEnabled`) from the runtime
  config, never the raw env value.

The injected `getProviderSnapshot` closure projects only the non-sensitive columns:

- `enabled`, `status`, `lastSuccessAt`, `lastFailureAt`, `successCount`, `failureCount`
  (from `externalInvestmentProviderHealth`)
- `credentialStatus === 'configured'` (from `externalInvestmentConnection`)

It explicitly excludes `encryptedPayload`, `maskedMetadata`, `lastErrorMessage`,
`lastRequestId`, `accountAlias`, account ids, `metadata`, and `syncMetadata`.

## Cache / freshness

- `getHealth()` returns an **in-memory snapshot** computed by the most recent
  `refreshHealth()` call. It NEVER performs IO.
- The dashboard runtime exposes `refreshProviderHealth()`, which the
  `/dashboard/providers/diagnostics` admin route awaits before reading `getHealth()`.
- There is no upstream IBKR Flex cache layer added by the wrapper. The existing
  worker sync continues to maintain the `externalInvestmentProviderHealth` row;
  this wrapper only reads from it.

## Error mapping

| Caller / local signal | `ProviderErrorCode` | `retryable` |
|---|---|---|
| Any caller of `provider.call()` | `unsupported_capability` (with `safeDetails.reason = "deferred_read_routing"`) | `false` |

Health-state mapping (from `getProviderSnapshot()`):

| Local snapshot | `ProviderHealth.status` | `lastErrorCode` |
|---|---|---|
| No `externalInvestmentProviderHealth` row + no connection | `degraded` | `unconfigured` |
| `credentialConfigured: false` | `degraded` | `unconfigured` |
| `enabled: false` (flag off) | `degraded` | `disabled_by_flag` |
| `status: 'healthy'` (configured + enabled) | `ok` | `null` |
| `status: 'failing'` (configured + enabled) | `down` | `provider_unavailable` |
| `status: 'degraded'` | `degraded` | `transient` |
| `status: 'idle'` (configured + enabled but never synced) | `degraded` | `unconfigured` |
| Repository read fails (DB unavailable) | `degraded` | `transient` |

`down` is explicitly RESERVED for a configured + enabled provider with a clear
repeated local failure state. Unconfigured / disabled / never-synced soft-fail to
`degraded`.

## Redaction notes

- The wrapper's input/output shape is tiny (no upstream payload echo).
- `provider.call()` returns a `ProviderError` with `safeDetails: { reason: "deferred_read_routing" }`.
- Log emissions go through `logProviderEvent` (closed-vocab fields + redaction). No
  Flex token, query id, raw XML payload, account id, or upstream HTTP body ever
  reaches a log line, the output DTO, or the diagnostics surface.
- Repository exceptions thrown inside `refreshHealth()` are caught and DROPPED.
- The wrapper never touches `IbkrFlexCredentialPayload`, encrypted credentials,
  Flex query orchestration, or sync result rows.

## Health check

- `getHealth()` is a synchronous snapshot computed during `refreshHealth()`.
- Initial state (before first refresh): `degraded` + `lastErrorCode: 'unconfigured'`
  with note `'snapshot pending — refreshHealth() not yet invoked'`.
- `getHealth()` itself NEVER performs IO and NEVER throws.

## Tests

- `assertProviderContract(provider)` — shape sanity.
- `assertProviderDoesNotExposeForbiddenCapabilities(provider)` — only
  `external_investments.positions.read` is declared.
- `assertProviderResultSafe(...)` on the deferred-call error result.
- `assertProviderLogsSafe(...)` over captured log lines.
- Health-state coverage: null snapshot / healthy / unconfigured / disabled / idle /
  failing / degraded / repository exception are each asserted explicitly.
- Redaction proof: synthetic Flex token / query id / raw XML body sentinels are
  injected through the repository-exception path and asserted absent from output
  and log lines.
- Diagnostics-time guarantee: `provider.call()` is never invoked by the diagnostics
  endpoint — only `getHealth()` is read.

See `apps/api/src/routes/dashboard/services/providers/ibkr-provider.test.ts`.

## Known limitations

- The wrapper is registered in `createInternalProviderRegistry` but **not consumed
  by any production route or use-case yet**. It exists today to populate the
  `/dashboard/providers/diagnostics` endpoint with a health-status snapshot and to
  lock the contract surface.
- `external_investments.trades.read` is unwrapped in this batch.
- The wrapper does NOT call IBKR Flex. There is no live diagnostics probe; sync
  jobs run on the existing worker schedule unchanged.

## ToS / legal notes

- IBKR Flex Web Service ToS applies to the underlying Flex client interactions in
  `packages/external-investments`. The wrapper performs no Flex interaction, so it
  does not change any ToS posture.
- The wrapper does not redistribute position or trade data; only closed-vocabulary
  aggregate health fields surface via the diagnostics endpoint.

## No execution guarantee

This adapter implements only `external_investments.positions.read` (read-only,
deferred). No `trading.order.*`, `trading.position.*`, `crypto.*`, `payment.*`, or
`bank.transfer.*` capability is implemented or planned. The wrapper makes no network
calls of any kind — neither to IBKR Flex nor to any upstream broker.
