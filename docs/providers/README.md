# Provider abstraction v2 — author guide

> **Status**: foundation + early migration batches. PR17A shipped the type-only
> contract; PR17B–E shipped the runtime, redaction, logger, registry skeleton,
> sync-metadata foundation, diagnostics use-case, docs, and invariant test harness.
> Macro Prompt 2 migrated the internal-only read paths
> [`knowledge-service`](./knowledge-service.md) (`knowledge.context_bundle.read`) and
> [`quant-service`](./quant-service.md) (`quant.patterns.detect`) onto the contract via
> standalone `Provider<C>` wrappers. Macro Prompt 3 added
> [`news-service`](./news-service.md) (`news.items.read`) and the
> `/dashboard/providers/diagnostics` endpoint. Macro Prompt 4 added health-only
> wrappers for the sensitive providers ([`powens`](./powens.md),
> [`ibkr`](./ibkr.md), [`binance`](./binance.md)) — read routing for those three is
> still deferred; only their health snapshots are surfaced through the diagnostics
> endpoint. **Routes still consume the existing inline helpers; rewiring is
> deferred.** Market-data adapters remain unwrapped.

This guide is for anyone adding a new provider or migrating an existing one onto the
contract. It encodes the safety invariants every adapter must hold; see also
[`docs/adr/provider-abstraction-v2.md`](../adr/provider-abstraction-v2.md) for design
rationale and the ten gaps the abstraction is closing.

## Why an abstraction at all

Pre-PR17 Finance-OS had ~10 third-party integrations with three different shapes (news
adapter, hand-rolled market-data, hand-rolled banking/external-investments). Provider v2
gives every integration the same shape so:

- A 4th market-data provider is ~150 LOC, not a 600-LOC edit.
- Logging, error metrics, and diagnostics aggregate across providers.
- "No raw payload in browser, prompt, or log" becomes a single test instead of 10.
- The next contributor can read one file to understand any provider.

## Mental model

A provider is **a single capability binding**. A real adapter (e.g., Powens) may export
several `Provider<C>` objects, one per capability it implements (e.g.,
`banking.accounts.read`, `banking.transactions.read`).

```
┌──────────────────────────┐    ┌────────────────────────┐    ┌───────────────────┐
│  caller (route, worker)  │ -> │  ProviderRegistry      │ -> │ Provider<C> #1    │
│  ProviderCallContext     │    │  (selection / health)  │    │ Provider<C> #2    │
│  → reason, mode, budget  │    │                        │    │ ...               │
└──────────────────────────┘    └────────────────────────┘    └───────────────────┘
```

Everything is **read-only**. Writes/execution capabilities are listed in
[`packages/provider-contract/src/capabilities.ts`](../../packages/provider-contract/src/capabilities.ts)
under `FORBIDDEN_PROVIDER_CAPABILITIES` with a compile-time guard.

## Required invariants

A new provider MUST hold every invariant below. The
[`assertProviderContract`](../../packages/provider-runtime/src/test-harness.ts) harness
catches the common breaks; the rest are reviewer responsibilities.

### 1. Demo / admin split

`ProviderCallContext.mode` is the gate. Any provider that needs credentials or paid
quota MUST refuse `mode === 'demo'` with `demo_mode_forbidden`. The route/use-case
layer is responsible for injecting `'demo'` when the caller is unauthenticated.

### 2. No provider call from a UI read path

UI route loaders MUST NOT call `provider.call(...)` directly. The web tier consumes
already-shaped data from API routes; provider calls live in the API/worker tier only.

### 3. No raw payload in browser responses, logs, or prompts

- Browser response: shape your DTO at the call boundary; never re-export the upstream JSON.
- Logs: route every emission through
  [`logProviderEvent`](../../packages/provider-runtime/src/logger.ts). It allows only a
  closed-vocabulary field set and runs every value through redaction.
- Prompts: never embed an upstream response. The advisor-side scanner protects LLM
  output, not provider input — that is your responsibility.

### 4. Closed error taxonomy

Map every upstream failure to one of `ProviderErrorCode`
(see [`packages/provider-contract/src/error.ts`](../../packages/provider-contract/src/error.ts)).
Use [`createProviderError`](../../packages/provider-runtime/src/error.ts) and
`normalizeProviderError` to construct them. Arbitrary string codes do not cross the
contract boundary.

### 5. Safe-by-default redaction

Anything you put on a `ProviderError.safeDetails`, a log field, or a diagnostics
response goes through
[`redactProviderPayload` / `redactProviderLogFields`](../../packages/provider-runtime/src/redaction.ts).
Sensitive key fragments are redacted recursively (`token`, `secret`, `password`,
`passphrase`, `api_key`, `authorization`, `cookie`, `session`, `private`, `refresh`,
`client_secret`, `credential`, `signature`, `jwt`, `bearer`, `key`, …). Long strings
are clamped; circular references become `[Circular]`; class instances are tagged, not
spread.

### 6. Health contract

Every provider exposes `getHealth()` returning a `ProviderHealth` snapshot. Keep it
cheap (no IO). The diagnostics use-case
([`computeProviderDiagnostics`](../../packages/provider-runtime/src/diagnostics.ts))
reads only `getHealth()` and never invokes `call()`.

### 7. No execution / no writes

`ALLOWED_PROVIDER_CAPABILITIES` is a closed read-only set. Adding a write capability
requires amending the ADR first. The compile-time guard in
[`capabilities.ts`](../../packages/provider-contract/src/capabilities.ts) rejects any
forbidden string that leaks into the allowed union.

## How to add a provider

1. Read [`docs/adr/provider-abstraction-v2.md`](../adr/provider-abstraction-v2.md).
2. Copy [`docs/providers/_template.md`](./_template.md) to
   `docs/providers/<provider-id>.md` and fill in every section.
3. Decide which capability you implement. If it is not in
   `ALLOWED_PROVIDER_CAPABILITIES`, stop — propose a docs-first amendment to the ADR.
4. Implement a `Provider<C>` object that:
   - returns `providerOk(...)` / `providerErr(...)` (use the runtime helpers, never throw)
   - maps every upstream failure to a closed `ProviderErrorCode`
   - emits `logProviderEvent` for `started` / `succeeded` / `failed` (or `skipped`)
   - exposes a cheap `getHealth()` keyed off the last call's outcome
5. Add adapter tests that call the
   [`assertProviderContract`](../../packages/provider-runtime/src/test-harness.ts) and
   `assertProviderDoesNotExposeForbiddenCapabilities` harness, plus
   `assertProviderResultSafe` on representative ok/err results.
6. Wire your provider into the registry only after the tests above pass.

## Where the foundation lives

| Concern | Module |
|---|---|
| Closed types (capability, error, result, health, meta, context) | [`packages/provider-contract/`](../../packages/provider-contract/) |
| Error helpers (create / normalize / safeJson) | [`packages/provider-runtime/src/error.ts`](../../packages/provider-runtime/src/error.ts) |
| Result helpers (ok / err / map / unwrap) | [`packages/provider-runtime/src/result.ts`](../../packages/provider-runtime/src/result.ts) |
| Redaction harness | [`packages/provider-runtime/src/redaction.ts`](../../packages/provider-runtime/src/redaction.ts) |
| Safe event logger | [`packages/provider-runtime/src/logger.ts`](../../packages/provider-runtime/src/logger.ts) |
| In-memory registry | [`packages/provider-runtime/src/registry.ts`](../../packages/provider-runtime/src/registry.ts) |
| Sync metadata types | [`packages/provider-runtime/src/sync-meta.ts`](../../packages/provider-runtime/src/sync-meta.ts) |
| Diagnostics use-case | [`packages/provider-runtime/src/diagnostics.ts`](../../packages/provider-runtime/src/diagnostics.ts) |
| Invariant test harness | [`packages/provider-runtime/src/test-harness.ts`](../../packages/provider-runtime/src/test-harness.ts) |

## Migrated providers

| Provider | Capability | Wrapper | Status |
|---|---|---|---|
| `knowledge-service` | `knowledge.context_bundle.read` | [knowledge-context-bundle-provider.ts](../../apps/api/src/routes/dashboard/services/providers/knowledge-context-bundle-provider.ts) | Wrapper + tests + docs. Routes not yet rewired. |
| `quant-service` | `quant.patterns.detect` | [quant-patterns-detect-provider.ts](../../apps/api/src/routes/dashboard/services/providers/quant-patterns-detect-provider.ts) | Wrapper + tests + docs. Routes rewired (admin path). |
| `news-service` | `news.items.read` | [news-service-provider.ts](../../apps/api/src/routes/dashboard/services/providers/news-service-provider.ts) | Wrapper + tests + docs. Routes not yet rewired. |
| `powens` | `banking.accounts.read` | [powens-provider.ts](../../apps/api/src/routes/dashboard/services/providers/powens-provider.ts) | **Health-only.** Wrapper + tests + docs. `provider.call()` is deferred (`unsupported_capability`). Routes not rewired. |
| `ibkr` | `external_investments.positions.read` | [ibkr-provider.ts](../../apps/api/src/routes/dashboard/services/providers/ibkr-provider.ts) | **Health-only.** Wrapper + tests + docs. `provider.call()` is deferred. Routes not rewired. |
| `binance` | `crypto.wallet.read` | [binance-provider.ts](../../apps/api/src/routes/dashboard/services/providers/binance-provider.ts) | **Health-only.** Wrapper + tests + docs. `provider.call()` is deferred. Routes not rewired. |

A registry mount module
[internal-provider-registry.ts](../../apps/api/src/routes/dashboard/services/providers/internal-provider-registry.ts)
composes the providers into a single `ProviderRegistry`. The
`/dashboard/providers/diagnostics` admin endpoint reads `getHealth()` snapshots from
this registry; for the sensitive wrappers (powens / ibkr / binance) it first awaits
the registry's `refreshSensitiveProviderHealth()` to refresh their in-memory snapshots
from local DB rows. Diagnostics never invokes `provider.call()` and never calls Powens
/ IBKR / Binance upstream.
