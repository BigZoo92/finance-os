// PR17A — ProviderHealth (TYPES ONLY).
//
// A provider's health snapshot is what the registry exposes to consumers (e.g., the widget
// health board) to decide whether to call it, fall back to cache, or skip silently.
//
// `status` is a closed enum: `ok`, `degraded`, or `down`. `degraded` is the soft-fail state
// (e.g., elevated latency, partial outage) — callers MAY still call the provider but should
// treat freshness with suspicion. `down` is the hard-fail state — callers SHOULD NOT call.

import type { ProviderErrorCode } from './error'

export const PROVIDER_HEALTH_STATUSES = ['ok', 'degraded', 'down'] as const

export type ProviderHealthStatus = (typeof PROVIDER_HEALTH_STATUSES)[number]

export interface ProviderHealth {
  readonly status: ProviderHealthStatus
  /**
   * ISO-8601 timestamp of the last successful call, or `null` if the provider has never
   * succeeded since process start. Allows consumers to compute their own staleness budgets
   * without trusting `freshnessMinutes` alone.
   */
  readonly lastSuccessAt: string | null
  /**
   * Last observed error code, or `null` if the most recent call succeeded. Useful for
   * surfacing `tos_blocked` / `auth_failed` / `unconfigured` states in the operator UI.
   */
  readonly lastErrorCode: ProviderErrorCode | null
  /**
   * Optional short, redacted note (e.g., "rate limit hit, backing off 60s"). MUST NOT
   * carry secrets, tokens, or raw provider payloads.
   */
  readonly note?: string
}
