# ADR: Provider Abstraction v2

> **Status**: partially implemented — §11.1 (PR17A) shipped as types only on 2026-05-09. Remaining slices (§11.2–§11.5) still proposed.
> **Date**: 2026-05-09
> **PR**: 16 (research) → 17A (types-only foundation)
> **Companion**: [`docs/research/provider-abstraction-openbb-hyperswitch-notes.md`](../research/provider-abstraction-openbb-hyperswitch-notes.md)
> **Deciders**: Human + Claude (challenger / reviewer)

---

## 1. Context

PR13's external-repos audit identified two architectural references worth studying for a future
Finance-OS provider-layer refactor:

- **OpenBB** — provider/data abstraction over hundreds of equity / macro / news / on-chain
  feeds, with one normalized API surface.
- **Hyperswitch** — payment-domain connector framework with ~50 PSP integrations behind a
  single normalized request/response shape, capability discovery, error taxonomy, retry +
  fallback routing.

Neither is a runtime dependency for Finance-OS. Both are **read-only architectural
references**. Their value is the ENGINEERING SHAPE of "many heterogeneous providers behind one
contract" — a problem Finance-OS has solved partially in 2026, in places well, in places
ad-hoc.

This ADR captures the proposed v2 architecture so the next 4–5 implementation PRs (PR17A-E,
see §13) can each merge a small, well-scoped slice without churn or scope creep.

The ADR ships alongside zero runtime change. The migration plan in §11 explicitly preserves
every existing provider integration.

## 2. Current Finance-OS provider landscape (2026-05-09)

The audit below is grounded in the actual repo state at the date above, not in speculation.

### 2.1 Provider catalog

| Domain | Providers | Where | Interface |
|---|---|---|---|
| **News / signals** | bluesky, ecb-data, ecb-rss, fed-rss, fred-news, gdelt, hn, manual-import, sec-edgar, x-twitter | [`apps/api/src/routes/dashboard/services/providers/`](../../apps/api/src/routes/dashboard/services/providers/) | Unified `NewsProviderAdapter` ([`news-provider-types.ts`](../../apps/api/src/routes/dashboard/services/news-provider-types.ts)). |
| **Market data — equities/macro** | EODHD, Twelve Data, FRED | [`fetch-live-market-data.ts`](../../apps/api/src/routes/dashboard/services/fetch-live-market-data.ts) | **No adapter.** Each provider is inlined: own env gating, own error codes, own retry/fallback. |
| **Open banking** | Powens | [`packages/powens/`](../../packages/powens/) | Standalone client class; Redis-backed sync queue. |
| **External investments — read-only** | IBKR (Flex Query XML), Binance | [`packages/external-investments/`](../../packages/external-investments/) | Per-provider hand-rolled; no shared adapter. |
| **Internal services (not third-party)** | knowledge-service, quant-service | [`services/knowledge-service-client.ts`](../../apps/api/src/routes/dashboard/services/knowledge-service-client.ts), inline `callQuantService` in [`routes/trading-lab.ts`](../../apps/api/src/routes/dashboard/routes/trading-lab.ts) | Knowledge has a structured client. Quant is an inline closure. |

This catalog is **the** input to the ADR. Anything proposed below must keep all eight integration points working.

### 2.2 What works today

- News providers DO share an adapter interface (`provider`, `enabled`, `cooldownMs`,
  `fetchItems`). That is the single best example of provider abstraction in the repo and is
  the implicit prior art for v2.
- Demo / admin split is consistent at the route layer via [`demoOrReal`](../../apps/api/src/auth/demo-mode.ts).
- Per-provider env gating (`MARKET_DATA_EODHD_ENABLED`, `MARKET_DATA_TWELVE_DATA_ENABLED`,
  `MARKET_DATA_FRED_ENABLED`, `IBKR_FLEX_ENABLED`, `BINANCE_SPOT_ENABLED`,
  `KNOWLEDGE_SERVICE_ENABLED`, `QUANT_SERVICE_ENABLED`, `TRADING_LAB_GRAPH_INGEST_ENABLED`,
  `ADVISOR_GRAPH_INGEST_ENABLED`) is solid. **Default-off** for graph ingest (PR8-fix) and
  worker auto-run (PR7) is the canonical pattern for "new write paths".
- Demo data lives in [`apps/api/src/mocks/`](../../apps/api/src/mocks/) and on the web side in
  per-feature `getDemo*` helpers — consistent enough to read.

### 2.3 What does NOT work consistently today

| # | Gap | Where it bites | PR target |
|---|---|---|---|
| 1 | **Market-data has no adapter shape**. Providers are inlined; the file mixes EODHD primary, Twelve Data overlay, FRED macro. Adding a 4th provider would be invasive. | `fetch-live-market-data.ts` is ~600 LOC of branching logic. | PR17A |
| 2 | **No capability registry**. We can't ask "does provider X support intraday quotes?" or "which provider serves macro series?" from code; we infer from env flags + hard-coded conditionals. | Twelve Data is hard-coded as the US-fresh-overlay path; if we add a 2nd intraday provider tomorrow, we duplicate the conditional. | PR17A |
| 3 | **Error codes are per-provider strings**. `TWELVE_DATA_ERROR`, `EODHD_API_KEY manquant.`, `KNOWLEDGE_SERVICE_UNAVAILABLE`, `KNOWLEDGE_SERVICE_INTERNAL_ERROR`. No shared taxonomy. | Logging / metrics are noisy; the UI can't differentiate `rate_limited` from `auth_failed` from `provider_disabled` from `transient_error`. | PR17B |
| 4 | **No central provider-health endpoint**. Powens has a one-off diagnostic provider; nobody else does. | No way to ask "which providers are degraded right now?" without reading 8 different places. | PR17C |
| 5 | **Sync metadata is inconsistent**. Powens stores last-sync-at + status in DB; IBKR stores in DB; market-data is per-call (no persistence); news has cooldownMs but no persisted last-success-at; advisor-graph-ingest is fire-and-forget. | Hard to render a "data freshness" indicator in the UI consistently. PR12 scorecard's `feesIncluded` uses `null` for unknown — that pattern hasn't propagated. | PR17D |
| 6 | **Credential isolation is informal**. Env vars are read in `apps/api/src/index.ts` and passed down. There's no documented "secrets never appear in logs" enforcement; redaction is per-call. PR8 has a banlist scanner for graph-ingest payloads — that pattern is provider-side, not credential-side. | Risk of accidental log leak; risk on a future provider that uses `client_secret` in URLs. | PR17B + PR17E |
| 7 | **No formal "no provider call from UI read path" rule**. PR1–PR15 honor it in practice, but it's not a checklist line item. | A future contributor could put a `fetch('/external')` in a route handler. | PR17E |
| 8 | **No "no raw payload in prompt / log / browser" rule** at the provider layer. The advisor-side guard (PR4 strict execution scanner) protects LLM output, not provider input. | Risk if a future post-mortem prompt accidentally embeds raw IBKR XML. | PR17B (taxonomy) + PR17E (test harness) |
| 9 | **Per-provider retry policy is duplicated**. Knowledge-service has `shouldRetry` + 2-attempt loop; news providers have `cooldownMs`; market-data has none; Powens has Redis-locked queues. | Five different retry stories. | PR17A |
| 10 | **Per-provider rate-limit handling is duplicated**. None standardized; some 429 returns are treated like generic 5xx. | Same. | PR17A + PR17B |

## 3. Problems to solve

In order of severity:

1. **Adding a new provider is risky.** A 4th market-data provider today means editing
   ~600 LOC across one file with hand-rolled fallback logic. We want a provider to be a
   ~150-LOC self-contained module that conforms to a typed contract.
2. **Diagnostics is inconsistent.** When EODHD is rate-limited, we surface
   `marketDataStaleAfterMinutes` warnings; when Twelve Data fails, we silently skip the
   overlay; when Powens fails, the sync queue notes it. No unified surface.
3. **Error taxonomy is invented per-provider.** Logs and metrics can't aggregate
   "auth failures across all providers".
4. **Capability discovery is implicit.** Code reads env flags + provider names to decide
   what to do; we want declarative capability records.
5. **No provider-layer test harness.** Each provider has its own ad-hoc tests; there's no
   shared "every provider must pass these N invariants" suite.

## 4. Non-goals

This ADR is **not** proposing the following, even if the architectural references suggest it:

1. **Vendoring OpenBB or Hyperswitch.** Both are read-only references. Finance-OS
   re-implements the patterns under our license.
2. **Adding a payment-execution layer.** Hyperswitch is a payment switch; Finance-OS is
   advisory-only. The capability/error patterns transfer, but routing logic that orders
   funds movement does NOT.
3. **Adding a trading-execution layer.** Same as above for the OpenBB-trading angle.
4. **A "provider plugin marketplace".** That's how OpenBB ships providers; for our scope it
   would balloon ops surface for negative value.
5. **A unified "all data through a single normalized model" data warehouse.** The
   normalized DTOs proposed in §6 are about the provider→Finance-OS handoff, not about
   restructuring downstream consumers.
6. **Replacing the news-provider adapter shape.** That shape is the prior art that v2
   formalizes; we extend, we do not replace.
7. **Live alerts / streaming.** This ADR is about pull-mode read paths and idempotent sync
   jobs only.
8. **A new internal service.** Provider abstraction lives inside `apps/api`, with optional
   colocation in `packages/` workspaces for heavyweight clients (Powens, external
   investments).

## 5. Proposed architecture (high level)

A 5-layer model:

```
   ┌──────────────────────────────────────────────────────────────────┐
   │ Layer 5 — Consumers: routes, use-cases, worker jobs              │
   │   reads typed DTOs; never imports a provider directly            │
   ├──────────────────────────────────────────────────────────────────┤
   │ Layer 4 — Provider Registry (orchestration)                      │
   │   capability lookup, fallback chains, demo-or-real, health roll- │
   │   up, retry policy, log/metrics fan-in                           │
   ├──────────────────────────────────────────────────────────────────┤
   │ Layer 3 — Provider Interface (contract)                          │
   │   Provider<TCapability>, ProviderId, ProviderError,              │
   │   ProviderHealth, ProviderCapability                             │
   ├──────────────────────────────────────────────────────────────────┤
   │ Layer 2 — Provider Adapters (one per third-party)                │
   │   eodhd, twelve-data, fred, bluesky, hn, sec-edgar, gdelt, ...   │
   │   powens (delegates to packages/powens), ibkr, binance, ...      │
   │   internal services: knowledge-service, quant-service            │
   ├──────────────────────────────────────────────────────────────────┤
   │ Layer 1 — Transport / clients                                    │
   │   raw HTTP / WebSocket / DB / queue I/O. Existing                │
   │   knowledge-service-client.ts is the canonical example.          │
   └──────────────────────────────────────────────────────────────────┘
```

Layer 3 + 4 are **new abstractions** Finance-OS owns. Layer 2 wraps existing code;
existing packages stay where they are. Layer 1 is unchanged.

Crucially: **Layer 5 (consumers) imports only from Layer 3 / Layer 4.** A route never
imports a provider adapter directly; it asks the registry "give me a market quote for
SPY.US" and receives a normalized DTO.

This mirrors the pattern PR9 used for `getAdvisorEvalsTrends` (use-case isolated from the
DB access) and PR12 used for the scorecard (use-case isolated from the metric helpers).

## 6. Provider interface shape (Layer 3)

The shape is **proposed**; PR17A is the implementation PR.

### 6.1 `ProviderId` and `ProviderCapability`

Both are string Literal unions with central registries (mirroring PR10's `PatternKey` and
PR15A's `LearningSignalKind` patterns).

```ts
// docs-only sketch — not yet runtime code
export type ProviderId =
  | 'eodhd'
  | 'twelve_data'
  | 'fred'
  | 'powens'
  | 'ibkr_flex'
  | 'binance_spot'
  | 'bluesky'
  | 'ecb_data'
  | 'ecb_rss'
  | 'fed_rss'
  | 'fred_news'
  | 'gdelt'
  | 'hn'
  | 'sec_edgar'
  | 'x_twitter'
  | 'manual_import'
  // internal services
  | 'knowledge_service'
  | 'quant_service'

export type ProviderCapability =
  | 'market_quote_eod'        // end-of-day equity quotes
  | 'market_quote_intraday'   // intraday equity quotes (US-fresh-overlay path today)
  | 'market_quote_crypto_spot'
  | 'macro_series'            // FRED-style macro time series
  | 'fundamentals'            // EODHD fundamentals
  | 'news_feed'
  | 'social_signal'
  | 'bank_account_read'       // open-banking read-only (Powens)
  | 'broker_position_read'    // read-only positions (IBKR Flex, Binance)
  | 'broker_transaction_read'
  | 'screener_read'           // tvscreener-style filtering (research-only)
  | 'pattern_detect'          // internal: quant-service patterns endpoint
  | 'knowledge_query'         // internal: knowledge-service /knowledge/query
  | 'knowledge_ingest'        // internal: knowledge-service /knowledge/ingest

// Capabilities that imply WRITE side-effects in third-party systems
// — Finance-OS does NOT define any such capability and never will.
// Listed here so the type-level contract is self-documenting.
//
//  ❌ NOT IN UNION: 'broker_order_place', 'broker_transfer', 'broker_withdraw',
//     'bank_payment_initiate', etc.
//
// PR17A's runtime registry must reject any adapter declaring a write capability.
```

### 6.2 `Provider<C>` interface

```ts
// docs-only sketch
export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unavailable' | 'disabled' | 'unconfigured'
  lastSuccessAt: string | null  // ISO timestamp; null = never observed
  lastFailureAt: string | null
  lastFailureCode: ProviderErrorCode | null
  staleAfterMinutes: number | null
}

export interface ProviderMeta {
  id: ProviderId
  capabilities: ReadonlyArray<ProviderCapability>
  // Free-text label rendered in the UI when the user picks a provider.
  // The label MUST NOT change behaviour; consumers route on `id` + capabilities.
  label: string
  // True if the provider can be used as a fallback for the same capability.
  // Default false; set true on macro / news where multi-source aggregation is the norm.
  isFallbackEligible: boolean
}

export interface Provider<C extends ProviderCapability> {
  meta: ProviderMeta & { capabilities: readonly C[] }

  // Read-only health probe; does NOT count against API budgets when possible.
  health(): Promise<ProviderHealth>

  // The actual capability call. The shape of `Input<C>` and `Output<C>` is keyed by capability
  // (see §6.3). The adapter MUST throw `ProviderError` (§7) on any failure path.
  call<TInput extends Input<C>, TOutput extends Output<C>>(
    input: TInput,
    ctx: ProviderCallContext
  ): Promise<TOutput>
}

export interface ProviderCallContext {
  requestId: string
  mode: 'demo' | 'admin'
  // Caller-attested deadline; the adapter MAY abort early but must respect this.
  deadlineAt?: Date
  // Caller-attested staleness tolerance, e.g. "we'd accept data ≤ 15 min old".
  // Adapters that maintain a cache can short-circuit when satisfied.
  staleAfterMinutes?: number
}
```

### 6.3 Capability-keyed input/output DTOs

Every capability has a single normalized DTO pair, **defined by Finance-OS**, not by the
provider. The adapter is responsible for translating provider raw → normalized.

Sketch (illustrative, not exhaustive):

```ts
// market_quote_eod
type MarketQuoteEodInput = {
  symbol: string                         // canonical Finance-OS symbol (e.g., 'SPY.US')
  asOf?: Date                            // optional historical EOD
}
type MarketQuoteEodOutput = {
  symbol: string
  asOf: string                           // ISO date
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
  currency: string                       // ISO 4217
  // Provenance — REQUIRED. The provider that satisfied the call.
  source: { providerId: ProviderId; freshnessMinutes: number | null }
}

// macro_series
type MacroSeriesInput = { seriesKey: string; from?: Date; to?: Date }
type MacroSeriesOutput = {
  seriesKey: string
  points: Array<{ date: string; value: number | null }>  // null = honest gap, NOT 0
  source: { providerId: ProviderId; freshnessMinutes: number | null }
}
```

Two design rules borrowed from existing Finance-OS patterns:

- **Null over fake zero** — same rule as PR12 scorecard / PR14 advanced metrics. A missing
  data point is `null`; never `0`.
- **Provenance is mandatory** — every output records *which* provider served it (mirroring
  PR8's `source: 'finance-os-advisor'` graph-ingest pattern).

### 6.4 Capability-typed registry lookup

The orchestration layer lives in Layer 4 and exposes capability-typed lookups:

```ts
// docs-only sketch
export interface ProviderRegistry {
  // Returns providers in priority order for a capability. Excludes disabled / unconfigured.
  resolve<C extends ProviderCapability>(capability: C): Array<Provider<C>>

  // Fan-out helper: try in priority order; on ProviderError, fall through to next.
  // Returns the first success OR an aggregated error per the taxonomy in §7.
  callWithFallback<C extends ProviderCapability>(
    capability: C,
    input: Input<C>,
    ctx: ProviderCallContext
  ): Promise<Output<C>>

  // Health roll-up for /diagnostics endpoints (§8) and the UI status badge.
  healthAll(): Promise<Record<ProviderId, ProviderHealth>>
}
```

The fallback logic is what unifies the current ad-hoc EODHD + Twelve Data overlay code into
a declarative chain. The overlay rule today reads:
*"If symbol is US-fresh-eligible AND `MARKET_DATA_TWELVE_DATA_ENABLED` AND
`MARKET_DATA_US_FRESH_OVERLAY_ENABLED` AND `TWELVE_DATA_API_KEY` is set, try Twelve Data
first; on any failure, fall back to EODHD."*

In v2, that becomes a config:

```ts
// docs-only sketch
const MARKET_QUOTE_INTRADAY_PRIORITY: ProviderId[] = ['twelve_data', 'eodhd']
// Plus a per-symbol filter: only US tickers go through the intraday path.
```

## 7. Error taxonomy (Layer 3)

A single typed error class with a closed-set `code`:

```ts
// docs-only sketch
export type ProviderErrorCode =
  | 'unconfigured'           // missing API key / not enabled
  | 'disabled_by_flag'       // env / runtime flag is off
  | 'rate_limited'           // 429 / quota
  | 'auth_failed'            // 401 / 403 / invalid token
  | 'not_found'              // 404 on a specific resource
  | 'invalid_input'          // 400 / our own validation
  | 'transient'              // 5xx, network error, timeout — retryable
  | 'permanent'              // upstream contract change, parse failure — NOT retryable
  | 'tos_blocked'            // we proactively refuse the call (e.g., live order placement)
  | 'demo_mode_forbidden'    // caller is in demo mode for an admin-only path
  | 'budget_exceeded'        // AI / call budget guard hit (mirrors PR4)

export class ProviderError extends Error {
  readonly code: ProviderErrorCode
  readonly providerId: ProviderId
  readonly retryable: boolean              // derived from `code` but stored for routing
  readonly causeRedacted?: string          // upstream message AFTER credential redaction
  // Original stack / payload NEVER stored on the error itself — see §9.
}
```

Rules:

- **`tos_blocked`** is the safety code. Any adapter that, by mistake, ends up wired to a
  capability it shouldn't serve (e.g., a future "execute trade" capability slipped past
  review) MUST throw `tos_blocked`. PR17A's runtime registry check + PR17B's taxonomy +
  PR17E's test harness are three independent guards.
- **`retryable: false`** on `permanent` / `auth_failed` / `tos_blocked` / `invalid_input` /
  `demo_mode_forbidden` / `disabled_by_flag` / `unconfigured` / `budget_exceeded` — these
  must NOT be retried, even by the registry's fan-out.
- **`causeRedacted`** is the only place upstream message text appears. Redaction rules
  follow PR8's redaction patterns (see §9).

## 8. Cache / staleness model

Three patterns coexist today; v2 keeps all three but labels them.

| Pattern | Used by | Status in v2 |
|---|---|---|
| **No cache, fresh-on-call** | knowledge-service (small payloads), quant-service patterns endpoint | Keep. Adapter declares `cacheable: false`. |
| **Per-call freshness window** | market-data (EODHD daily) — current `marketDataStaleAfterMinutes` | Formalize as `staleAfterMinutes` in the output's `source` provenance. |
| **DB-persisted last-success-at + Redis sync queue** | Powens, IBKR, Binance, news (cooldownMs implicit) | Formalize via `ProviderHealth.lastSuccessAt` + a shared sync-state table (§11). |

Decision rule for new providers:

1. Read-only single-call provider with small payloads → no cache.
2. Read-only with paginated history → per-call freshness window + in-memory LRU.
3. Stateful sync (positions, transactions, bank accounts) → DB-persisted state + idempotent
   queue jobs. PR7's `post-mortem-scheduler.ts` (compare-and-delete Redis lock + Lua
   release) is the canonical example to extend.

Honest staleness reporting:

- Output's `source.freshnessMinutes` is `null` if unknown (NOT 0).
- UI consumers display "Données indisponibles" when freshness is null — same convention as
  PR12 scorecard's `feesIncluded: null` rendering as "inconnu".

## 9. Credential / security model

Three rules, named and enforceable:

### 9.1 Rule: secrets only in env, never in code, never in DB

Today: holds for IBKR / Binance / Powens / EODHD / Twelve Data / FRED / API keys. All read
in [`apps/api/src/index.ts`](../../apps/api/src/index.ts) from `packages/env`.

v2: documented as a checkable invariant. PR17E's test harness loads every adapter and
asserts that `env.PROVIDER_*_KEY` patterns are accessed via `packages/env` only — no
`process.env.X` direct reads.

### 9.2 Rule: no raw payload appears in logs, prompts, or browser

Today: provider-side this rule isn't formal; advisor LLM side it is (PR4 + PR8).

v2: every adapter emits a sanitized log record via a shared `logProviderEvent({ providerId,
code, requestId, ...redactedFields })`. Forbidden in log output:
- API keys, tokens, secrets, signed URLs, OAuth `code` params, basic-auth headers.
- Free-form upstream message text without redaction.
- Any raw response body (only metadata: `status`, `bytes`, `latencyMs`).

A redaction allowlist (mirroring PR8's `SENSITIVE_KEY_PARTS` in
[`apps/knowledge-service/src/finance_os_knowledge/redaction.py`](../../apps/knowledge-service/src/finance_os_knowledge/redaction.py))
runs on every log record before emission.

### 9.3 Rule: no provider call from a UI read path

Today: holds in practice; not formally enforced.

v2: the type system separates read-paths (consumed by TanStack Query) from provider calls
(consumed by sync jobs / use-cases). PR17E's test harness greps for `fetch(` in
[`apps/web/src/`](../../apps/web/src/) outside `dashboard-api.ts` and fails CI on a hit.

## 10. Demo / admin split

Already canonical via [`demoOrReal`](../../apps/api/src/auth/demo-mode.ts).

v2 adds: every adapter MUST accept `mode` in `ProviderCallContext` and:
- in `demo` mode, return a deterministic demo fixture WITHOUT touching the network;
- in `admin` mode, perform the real call.

This generalizes the current per-route `demoOrReal` pattern to the provider layer itself.
The route-layer `demoOrReal` stays — it's the outermost guard. The provider-layer demo
support gives us free deterministic offline testing for all sync jobs.

## 11. Migration plan

This ADR ships zero runtime change. The migration plan below is the **proposed** shape; PR17A-E
each merge a slice.

### 11.1 PR17A — Capability registry + interface (compile-time only) ✅ shipped 2026-05-09

- ✅ Layer 3 types landed in `packages/provider-contract/` (new workspace, **types only**, no runtime):
  `Provider<C>`, `ProviderId`, `ProviderCapability`, `ProviderError`, `ProviderErrorCode`,
  `ProviderHealth`, `ProviderHealthStatus`, `ProviderCallContext`, `ProviderMode`, `BudgetPolicy`,
  `FreshnessPolicy`, `ProviderMeta`, `ProviderSourceMeta`, `ProviderResult<T>`,
  `ProviderRegistryContract`, `ProviderCapabilityDefinition`.
- ✅ `ALLOWED_PROVIDER_CAPABILITIES` (13 read-only keys) and `FORBIDDEN_PROVIDER_CAPABILITIES`
  (8 execution / write keys) are exposed as const tuples; the type-level guard
  `__PROVIDER_CAPABILITY_GUARD_OK` fails to compile if a forbidden key ever leaks into the
  allowed union.
- ✅ `ProviderErrorCode` is a closed 14-value union covered by an exhaustive switch self-test.
- ✅ Per-call mode (`'demo' | 'admin'`) is REQUIRED on `ProviderCallContext` — no default.
- ✅ `ProviderResult<T>` is a discriminated `{ ok: true } | { ok: false }` union with required
  `meta` envelope on both branches.
- ✅ Package boundary self-test asserts no workspace runtime / transport imports leak in.
- **No adapter migrated yet.** Existing inline provider code keeps working unchanged.
- Capability-keyed input/output DTOs (§6.3) deferred — PR17A leaves `Provider<C>` generic over
  `TInput` / `TOutput`; per-capability DTOs land incrementally as adapters migrate.

### 11.2 PR17B — Error taxonomy + redaction harness

- Implement `ProviderError` runtime class + `logProviderEvent` redacted-logger.
- Migrate 1 provider (recommended: knowledge-service, smallest surface) to throw
  `ProviderError` with codes mapped from current ad-hoc strings.
- Snapshot test the redaction harness against a payload containing every value from PR8's
  `SENSITIVE_KEY_PARTS` list.
- Other providers continue to throw their current errors; the registry layer maps them on
  the way out as a transitional adapter-of-adapter.

### 11.3 PR17C — Provider health + diagnostics surface

- Land `health()` on each provider (default: degraded if last-success > stale threshold,
  unavailable if last-failure within last 60s).
- New `GET /dashboard/providers/diagnostics` route (admin-only). Returns
  `Record<ProviderId, ProviderHealth>`.
- Optional small UI badge on `/ia` showing the current health roll-up. (UI is optional
  and should be a separate small follow-up if found load-bearing.)

### 11.4 PR17D — Normalized sync metadata + idempotent jobs

- Extract a shared `provider_sync_state` shape (NOT necessarily a new DB table — could
  live as a jsonb column on existing per-provider tables, decided in PR17D).
- Migrate Powens / IBKR / Binance sync jobs to compare-and-delete Redis locks (mirroring
  PR7-fix).
- Standardize `lastSuccessAt`, `lastFailureAt`, `lastFailureCode`, `nextEligibleAt` columns
  / fields.

### 11.5 PR17E — Provider docs + test harness

- One-page-per-provider docs under `docs/providers/` (URL, capabilities declared, env vars
  consumed, freshness model, ToS / paper-only caveats).
- Shared test harness that asserts, for every adapter:
  - Demo mode returns deterministic output without I/O.
  - All thrown errors are `ProviderError` with valid `code`.
  - Redaction harness silences every `SENSITIVE_KEY_PARTS` substring.
  - No `process.env.X` direct read (uses `packages/env`).
  - `meta.capabilities` does not contain any forbidden write capability.

### 11.6 Existing-provider migration order (informative)

| Order | Provider | Reason |
|---|---|---|
| 1 | knowledge-service | smallest surface; structured client already exists |
| 2 | quant-service | wrap inline `callQuantService` into an adapter |
| 3 | News providers | already have an adapter — formalize over the existing shape |
| 4 | Market data (EODHD, Twelve Data, FRED) | the highest-value win — converts the 600 LOC inline file to 3 adapters + 1 fallback config |
| 5 | Powens | preserve `packages/powens/` workspace; wrap as one adapter |
| 6 | External investments (IBKR, Binance) | preserve `packages/external-investments/` workspace; wrap as adapters |

Each step is one PR. Existing providers keep working through the migration because the
registry resolves to whichever adapter exists — pre-migration adapters are just the current
inline code wrapped by a thin shim.

## 12. Risks

1. **Scope creep.** The temptation to "rebuild everything" is real. Mitigation: PR17A-E each
   merge a slice with explicit scope; the registry must resolve to existing inline code on day 1.
2. **Type-system overhead.** Capability-keyed input/output (§6.3) needs careful TS gymnastics.
   Mitigation: prototype the worst case (market-data) in PR17A before committing to the
   public types.
3. **Performance regression.** A registry indirection adds 2 function calls per provider
   call. Mitigation: registry is a compile-time lookup table, not runtime reflection.
4. **Demo mode coverage gap.** Forcing every provider to support demo mode means writing
   demo fixtures for IBKR / Binance / Powens. Mitigation: the demo fixtures already exist
   in `apps/api/src/mocks/` — PR17 just wires them through.
5. **Internal services aren't third-party providers.** Treating knowledge-service /
   quant-service as `Provider`s muddies the model. Mitigation: they share the
   capability/error/health surface but have their own ProviderId namespace and never
   appear in fallback chains for third-party capabilities.
6. **Encouraging future write providers.** A typed `ProviderCapability` union is a magnet for
   future contributors to add `broker_order_place`. Mitigation: §6.1's NOT-IN-UNION comment
   becomes a runtime ADR-enforcement check in PR17A; CI greps for forbidden capability
   strings.
7. **`tos_blocked` surface as a "this is allowed if not blocked" mental model.** Mitigation:
   `tos_blocked` is a defensive last-resort code; the architectural guarantee is the closed
   capability union, not the error code. Documentation must be explicit.

## 13. Future PR plan

| PR | Theme | Deliverable | Hard constraints |
|---|---|---|---|
| **PR17A** | Capability registry + interface | `packages/provider-contract/` (types only). Compile-time forbidden-capability check. No adapter migration yet. | Doc-aligned with this ADR; types only; no runtime path activated. |
| **PR17B** | Error taxonomy + redaction | `ProviderError` runtime class. `logProviderEvent` redacted-logger. Migrate knowledge-service as canary. | No semantic change in the migrated provider's public response shape. |
| **PR17C** | Provider health diagnostics | `health()` per provider. `GET /dashboard/providers/diagnostics` admin-only. | Read-only. No new outbound calls. |
| **PR17D** | Normalized sync metadata | Shared `provider_sync_state` shape. Compare-and-delete Redis locks for Powens/IBKR/Binance sync jobs. | No new DB table unless absolutely necessary; prefer jsonb column or re-use existing per-provider tables. |
| **PR17E** | Provider docs + test harness | `docs/providers/<id>.md` per adapter. Shared test harness asserting demo determinism, ProviderError shape, redaction, env access pattern, no forbidden capability. | Test harness only; no behavior change. |

PR17A is mandatorily first because it defines the types every subsequent PR depends on.
PR17B–E can ship in any order and can interleave with non-provider work.

The migration of individual providers (per §11.6) is **explicitly not** part of PR17 — those
are follow-up PRs that consume the v2 contract once it exists.

## 14. References (read-only)

- OpenBB-finance/OpenBB — provider-abstraction architecture; license NOASSERTION (treat as
  AGPL-equivalent until counsel verified). Read-only reference.
- juspay/hyperswitch — connector-framework architecture; Apache-2.0. Read-only reference.
- PR13 audit:
  [`docs/research/advisor-external-repos-audit.md`](../research/advisor-external-repos-audit.md).
- PR13 decision matrix:
  [`docs/research/advisor-external-repos-decision-matrix.md`](../research/advisor-external-repos-decision-matrix.md).
- PR16 companion notes:
  [`docs/research/provider-abstraction-openbb-hyperswitch-notes.md`](../research/provider-abstraction-openbb-hyperswitch-notes.md).

---

**No runtime code is changed by this PR. No dependency is added. No DB schema is touched. No
provider call is made. Existing providers continue to work unchanged.**
