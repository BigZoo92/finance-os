# Provider: `quant-service`

> Macro Prompt 2 — second internal provider migration. The wrapper exists at
> [`apps/api/src/routes/dashboard/services/providers/quant-patterns-detect-provider.ts`](../../apps/api/src/routes/dashboard/services/providers/quant-patterns-detect-provider.ts)
> and is exercised by unit tests. **Macro Prompt 2-fix (2026-05-09) rewired the
> `/dashboard/trading-lab/patterns/detect` admin route through this wrapper** —
> first real runtime consumer of the provider abstraction. The other quant endpoints
> (`/capabilities`, `/backtest`, `/walk-forward`) still use the inline
> `callQuantService` closure and are not yet wrapped. The public
> `/dashboard/trading-lab/patterns/detect` response shape is unchanged.

## Provider id

`quant-service`

## Capabilities

| Capability | Status |
|---|---|
| `quant.patterns.detect` | Implemented as `Provider<C>` wrapper (Macro Prompt 2). **Wired into the `/dashboard/trading-lab/patterns/detect` admin route (Macro Prompt 2-fix).** |
| `quant.metrics.compute` | **Deferred.** Allowed by the contract but not yet wrapped. |
| `quant.indicators.compute` | **Deferred.** Allowed by the contract but not yet wrapped. |
| backtest / walk-forward | **Out of scope** for this batch. Neither is in `ALLOWED_PROVIDER_CAPABILITIES`. The Python service remains paper-only and deterministic; route-level callers continue to invoke `/quant/backtest` and `/quant/walk-forward` via the existing inline helper. Adding these would require a docs-first amendment to the ADR. |

## Mode behavior

| Mode | Behavior |
|---|---|
| `demo` | Returns the deterministic fixture from [`pattern-detection-demo.ts`](../../apps/api/src/routes/dashboard/services/pattern-detection-demo.ts) without performing any network call. The result is reported with `fromCache: true` and `freshnessMinutes: 0`. This matches the existing demo-route behavior. |
| `admin` | If `config.enabled === false`, refuses with `disabled_by_flag`. Otherwise issues a single `POST /quant/patterns/detect` against the configured quant-service URL with the caller's `requestId` echoed in `x-request-id`. The wrapper does not transform the upstream body — it returns it verbatim under `data.response` for forward-compatibility with the existing route shape. |

## Credentials

- No external credentials. The quant-service is an internal Python service, addressed by
  `QUANT_SERVICE_URL`. No `VITE_*` exposure.
- Feature flag: `QUANT_SERVICE_ENABLED` (consumed by the existing config layer). Default
  unchanged in this batch.

## Cache / freshness

- No cache layer. Pattern detection is a pure function over input candles; the upstream
  Python service computes deterministically. Demo mode reports `fromCache: true` because
  the result is served from a deterministic in-process fixture.

## Error mapping

| Upstream signal | `ProviderErrorCode` | `retryable` |
|---|---|---|
| `config.enabled === false` | `disabled_by_flag` | `false` |
| HTTP 404 | `not_found` | `false` |
| HTTP 429 | `rate_limited` | `true` |
| HTTP 5xx | `transient` | `true` |
| Other 4xx | `provider_unavailable` | `true` |
| Thrown / abort / timeout | `provider_unavailable` | `true` |

## Redaction notes

- The wrapper NEVER logs raw candle data, raw strategy/trade payloads, or upstream error
  bodies. `provider.call.*` log lines carry only the closed `ProviderLogEventFields`
  vocabulary; `itemCount` reports the candle array length without echoing any value.
- Tests assert that concrete candle values (e.g., `999.123456`) and synthetic upstream
  error bodies do not surface in any captured log line.
- This wrapper does not introduce execution vocabulary. PR10 / PR15B safeguards
  (execution-vocabulary self-scan in the Python service) remain authoritative.

## Health check

`getHealth()` is precomputed and never performs IO:

- `status`: `ok` after a successful call, `degraded` after a 5xx / thrown error,
  `down` after disabled or 4xx.
- `lastSuccessAt`: ISO timestamp of the most recent successful call.
- `lastErrorCode`: closed-set `ProviderErrorCode` from the most recent failure.

## Tests

[`trading-lab-patterns-detect.test.ts`](../../apps/api/src/routes/dashboard/routes/trading-lab-patterns-detect.test.ts)
exercises the rewired route:

- admin success → 200 `{ ok: true, ...upstreamBody }` with `detections`, `timeframe`,
  `paramsHash`, `dataHash` flowing through unchanged.
- admin `disabled_by_flag` → 503 `{ ok: false, code: 'QUANT_SERVICE_DISABLED' }`, no
  fetch invocation.
- admin HTTP 5xx → 503 `{ ok: false, code: 'QUANT_SERVICE_UNAVAILABLE' }`; raw
  upstream body is asserted to never appear in the public response.
- admin thrown network error → 503 `QUANT_SERVICE_UNAVAILABLE`.
- demo branch never invokes fetch and returns the deterministic
  `buildDemoPatternDetectionResponse` fixture.
- captured log lines never contain raw candle values, raw fetch errors, or upstream
  error bodies (sentinel strings asserted).
- public response on failure contains no execution vocabulary
  (`order` / `execute` / `transfer` / `swap` / `payment`).

[`quant-patterns-detect-provider.test.ts`](../../apps/api/src/routes/dashboard/services/providers/quant-patterns-detect-provider.test.ts)
exercises the wrapper itself:

- `assertProviderContract` + `assertProviderDoesNotExposeForbiddenCapabilities`
- demo branch never calls `fetch`, returns `fromCache: true`
- `disabled_by_flag` short-circuits without a fetch
- HTTP 429 → `rate_limited`, HTTP 5xx → `transient`, thrown → `provider_unavailable`
- explicit assertion that raw candle values + upstream error bodies never appear in logs

## Known limitations

- Only `quant.patterns.detect` is wrapped **and routed**. `metrics`, `indicators`,
  `backtest`, and `walk-forward` continue to use the inline `callQuantService` helper
  in [trading-lab.ts](../../apps/api/src/routes/dashboard/routes/trading-lab.ts) at
  the call sites for `/capabilities`, `/backtest`, and `/walk-forward`.
- The wrapper does not yet enforce `BudgetPolicy` / `FreshnessPolicy` from
  `ProviderCallContext`; pattern detection has no upstream cost or freshness state to
  honor today.

## ToS / legal notes

- Internal service; no third-party ToS applies.
- No user-facing attribution required.

## No execution guarantee

This adapter implements only the read-shaped capability `quant.patterns.detect`. No
`trading.*`, `crypto.swap.*`, `crypto.transfer.*`, `payment.*`, or `bank.transfer.*`
capabilities are implemented or planned. The quant-service remains paper-only,
deterministic, and never executes orders. Backtest and walk-forward routes remain
out-of-band of the provider contract until a future ADR amendment.
