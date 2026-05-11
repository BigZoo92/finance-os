# Provider: `binance`

> Health-only `Provider<C>` wrapper around the local Binance Spot provider-health
> snapshot. Migrated as a foundation in **Macro Prompt 4** (2026-05-09). The wrapper
> declares `crypto.wallet.read` so the provider appears in
> `/dashboard/providers/diagnostics`. The existing
> `/dashboard/external-investments/*` routes, the
> `/integrations/external-investments/*` admin routes, and the worker sync continue to
> consume `packages/external-investments` directly. **Read routing through
> `provider.call()` is deferred. Public API response shapes are unchanged. Sync
> behavior is unchanged. Credential storage and encryption are unchanged.**

## Provider id

`binance`

## Capabilities

- `crypto.wallet.read` — declared so the wrapper appears in the registry with a known
  capability surface.

Capability rationale: Binance balances surface as wallet-shaped data (free / locked
quantity per asset), so `crypto.wallet.read` is the closest closed-vocabulary fit and
keeps the wrapper distinct from IBKR's `external_investments.positions.read` surface.
Trade-history routing for Binance is deferred along with the wallet read routing.

The wrapper does not declare any other capability. Forbidden capabilities
(`crypto.swap.execute`, `crypto.transfer.create`, `trading.order.create`, etc.) are
NOT implemented or planned.

## Mode behavior

| Mode | Behavior |
|---|---|
| `demo` | The `/dashboard/providers/diagnostics` route short-circuits demo callers to a deterministic empty fixture before reaching the wrapper. The wrapper itself never reads from Binance or the local DB on a demo path. |
| `admin` | `provider.call()` returns `unsupported_capability` with `safeDetails.reason = "deferred_read_routing"`. `getHealth()` returns the latest snapshot computed by the most recent `refreshHealth()` invocation. |

## Credentials

The wrapper reads NO credentials, NO env vars, and NO secrets directly. It is wired
purely from a closure that reads two local tables (`externalInvestmentProviderHealth`
+ `externalInvestmentConnection`):

- `APP_ENCRYPTION_KEY` — used by `packages/external-investments/src/credentials.ts`
  to encrypt the API key/secret payload. **The wrapper does NOT decrypt or read API
  credentials.** Encryption logic is unchanged.
- `BINANCE_SPOT_ENABLED` — feature flag consumed by the existing Binance client +
  sync. The wrapper reads only the resolved boolean (`binanceSpotEnabled`) from the
  runtime config, never the raw env value or the API key/secret.

The injected `getProviderSnapshot` closure projects the same closed-vocabulary subset
as `ibkr` — only `enabled`, `status`, `lastSuccessAt`, `lastFailureAt`,
`successCount`, `failureCount`, `credentialConfigured`. It explicitly excludes
`encryptedPayload`, `maskedMetadata`, `lastErrorMessage`, `lastRequestId`,
`accountAlias`, account ids, `metadata`, and `syncMetadata`.

## Cache / freshness

- `getHealth()` returns an **in-memory snapshot** computed by the most recent
  `refreshHealth()` call. It NEVER performs IO.
- The dashboard runtime exposes `refreshProviderHealth()`, which the
  `/dashboard/providers/diagnostics` admin route awaits before reading `getHealth()`.
- There is no upstream Binance cache layer added by the wrapper. The existing worker
  sync maintains the `externalInvestmentProviderHealth` row; this wrapper only reads
  from it.

## Error mapping

| Caller / local signal | `ProviderErrorCode` | `retryable` |
|---|---|---|
| Any caller of `provider.call()` | `unsupported_capability` (with `safeDetails.reason = "deferred_read_routing"`) | `false` |

Health-state mapping uses the same rules as the IBKR wrapper (see `ibkr.md`):
unconfigured / disabled / idle map to `degraded`; `failing` maps to `down`; `healthy`
maps to `ok`; `degraded` maps to `degraded`; repository read failure maps to
`degraded` + `transient`.

`down` is explicitly RESERVED for a configured + enabled provider with a clear
repeated local failure state. Unconfigured / disabled / never-synced soft-fail to
`degraded`.

## Redaction notes

- The wrapper's input/output shape is tiny (no upstream payload echo).
- `provider.call()` returns a `ProviderError` with `safeDetails: { reason: "deferred_read_routing" }`.
- Log emissions go through `logProviderEvent` (closed-vocab fields + redaction). No
  API key, API secret, HMAC signature, signed query string, raw JSON body, account
  id, or wallet address ever reaches a log line, the output DTO, or the diagnostics
  surface.
- Repository exceptions thrown inside `refreshHealth()` are caught and DROPPED. The
  thrown exception object can carry signed URLs and raw JSON; the wrapper drops the
  entire exception object — only `lastErrorCode: 'transient'` and a closed-vocab
  note flag the failure.
- The wrapper never touches `BinanceSpotCredentialPayload`, encrypted credentials,
  HMAC signing, or the underlying read-only HTTP allowlist.

## Health check

- `getHealth()` is a synchronous snapshot computed during `refreshHealth()`.
- Initial state (before first refresh): `degraded` + `lastErrorCode: 'unconfigured'`
  with note `'snapshot pending — refreshHealth() not yet invoked'`.
- `getHealth()` itself NEVER performs IO and NEVER throws.

## Tests

- `assertProviderContract(provider)` — shape sanity.
- `assertProviderDoesNotExposeForbiddenCapabilities(provider)` — only
  `crypto.wallet.read` is declared.
- `assertProviderResultSafe(...)` on the deferred-call error result.
- `assertProviderLogsSafe(...)` over captured log lines.
- Health-state coverage: null snapshot / healthy / failing / disabled / repository
  exception are each asserted explicitly.
- Redaction proof: synthetic API key / API secret / HMAC signature / raw JSON
  sentinels are injected through the repository-exception path and asserted absent
  from output and log lines.
- Diagnostics-time guarantee: `provider.call()` is never invoked by the diagnostics
  endpoint — only `getHealth()` is read.

See `apps/api/src/routes/dashboard/services/providers/binance-provider.test.ts`.

## Known limitations

- The wrapper is registered in `createInternalProviderRegistry` but **not consumed
  by any production route or use-case yet**. It exists today to populate the
  `/dashboard/providers/diagnostics` endpoint with a health-status snapshot and to
  lock the contract surface.
- Trade-history reads (Binance `/api/v3/myTrades`) are unwrapped in this batch.
- The wrapper does NOT call Binance. There is no live diagnostics probe; the
  read-only HTTP allowlist in `binance-readonly-client.ts` continues to gate any
  worker-side calls.

## ToS / legal notes

- Binance Spot API ToS applies to the underlying read-only client interactions in
  `packages/external-investments`. The wrapper performs no Binance interaction, so it
  does not change any ToS posture.
- The wrapper does not redistribute wallet or trade data; only closed-vocabulary
  aggregate health fields surface via the diagnostics endpoint.

## No execution guarantee

This adapter implements only `crypto.wallet.read` (read-only, deferred). No
`crypto.swap.execute`, `crypto.transfer.create`, `crypto.withdraw.create`,
`trading.order.*`, `payment.*`, or `bank.transfer.*` capability is implemented or
planned. The wrapper makes no network calls of any kind — neither to Binance nor to
any upstream exchange. The underlying `assertBinanceReadonlyEndpoint` allowlist in
`packages/external-investments` continues to enforce read-only HTTP scope at the
worker layer.
