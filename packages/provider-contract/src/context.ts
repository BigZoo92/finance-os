// PR17A — ProviderMode + ProviderCallContext + policies (TYPES ONLY).
//
// `ProviderCallContext` is the per-call envelope every provider invocation receives. It
// carries the mode (demo vs admin), the request id (for trace joining), the wall clock,
// and the optional budget / freshness / dry-run policies the caller wants enforced.
//
// Mode is REQUIRED — the registry uses it as the primary gate to forbid demo callers from
// hitting any provider that touches private user data or paid quotas. There is no default.

// ---------------------------------------------------------------------------
// Mode — closed two-value enum.
//
// 'demo' = unauthenticated public surface, MUST only see synthetic / cached / public data.
// 'admin' = authenticated cockpit, MAY hit private and paid providers.
// ---------------------------------------------------------------------------

export const PROVIDER_MODES = ['demo', 'admin'] as const

export type ProviderMode = (typeof PROVIDER_MODES)[number]

// ---------------------------------------------------------------------------
// BudgetPolicy — caller-declared spend ceiling for a single call.
//
// PR17A defines the shape; enforcement happens in the registry layer (PR17B+). Setting a
// budget at call time lets paid providers (e.g., paid market data) refuse rather than
// silently bill.
// ---------------------------------------------------------------------------

export interface BudgetPolicy {
  /** Maximum the caller is willing to spend on this single call, in USD cents. */
  readonly maxCostUsdCents: number
  /**
   * What the registry should do when the upstream cost is unknown. `'allow'` proceeds
   * optimistically; `'deny'` short-circuits with `budget_exceeded`. Default behavior is
   * `'deny'` — adapters with deterministic free paths (cache-only, deterministic compute)
   * SHOULD report cost = 0.
   */
  readonly onUnknownCost: 'allow' | 'deny'
}

// ---------------------------------------------------------------------------
// FreshnessPolicy — caller-declared maximum acceptable data age.
//
// Adapters MUST honor this by either (a) returning data within the bound and reporting
// `freshnessMinutes` accordingly, or (b) failing with `stale_cache`. Adapters that cannot
// determine freshness MAY only succeed if the underlying capability is flagged
// `allowsUnknownFreshness`.
// ---------------------------------------------------------------------------

export interface FreshnessPolicy {
  /** Maximum acceptable data age, in minutes. */
  readonly maxAgeMinutes: number
  /**
   * `true` when the caller is willing to accept cached data within `maxAgeMinutes` rather
   * than forcing a live upstream call. `false` requires a fresh upstream fetch.
   */
  readonly allowCache: boolean
}

// ---------------------------------------------------------------------------
// ProviderCallContext — the per-call envelope.
//
// Mode is REQUIRED. Optional fields use `exactOptionalPropertyTypes` semantics: omitting
// the field means "no policy"; setting it to `undefined` is NOT allowed.
// ---------------------------------------------------------------------------

export interface ProviderCallContext {
  /** Demo or admin call site. REQUIRED — there is no default. */
  readonly mode: ProviderMode
  /** Trace id for log/span joining. Adapter MUST echo this on every result. */
  readonly requestId: string
  /** Wall clock at call start. Allows deterministic freshness math. */
  readonly now: Date
  /** Short, audit-friendly reason describing why this call is being made. */
  readonly reason: string
  /** Optional spend ceiling. Omit for "no policy" (registry defaults apply). */
  readonly budgetPolicy?: BudgetPolicy
  /** Optional freshness ceiling. Omit for "capability default applies". */
  readonly freshnessPolicy?: FreshnessPolicy
  /**
   * `true` when the caller wants the registry to validate the call shape (auth, mode gate,
   * budget, freshness) but skip the upstream call. Adapters MUST return cached/synthetic
   * data or fail with `provider_unavailable`. Useful for evaluator runs and CI.
   */
  readonly dryRun?: boolean
}
