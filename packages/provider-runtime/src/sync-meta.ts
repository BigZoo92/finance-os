// PR17D — Normalized sync metadata foundation (TYPES + HELPERS, no DB).
//
// Pure shapes + small constructors a future sync-state writer can adopt. No schema,
// no migration, no job behavior change. Unknown numeric values stay null — never 0.

import type {
  ProviderCapability,
  ProviderErrorCode,
  ProviderId,
} from '@finance-os/provider-contract'

export const PROVIDER_SYNC_STATUSES = [
  'idle',
  'syncing',
  'success',
  'failed',
  'disabled',
  'degraded',
] as const

export type ProviderSyncStatus = (typeof PROVIDER_SYNC_STATUSES)[number]

export interface ProviderSyncState {
  readonly providerId: ProviderId
  readonly capability: ProviderCapability
  readonly status: ProviderSyncStatus
  readonly lastSuccessAt: string | null
  readonly lastAttemptAt: string | null
  readonly lastErrorCode: ProviderErrorCode | null
  readonly freshnessMinutes: number | null
  readonly stale: boolean
  readonly degraded: boolean
  readonly itemCount: number | null
  readonly requestId: string | null
}

export interface ProviderSyncRunMeta {
  readonly providerId: ProviderId
  readonly capability: ProviderCapability
  readonly syncRunId: string
  readonly startedAt: string
  readonly endedAt: string | null
  readonly status: ProviderSyncStatus
  readonly itemCount: number | null
  readonly errorCode: ProviderErrorCode | null
  readonly requestId: string | null
}

export interface ProviderFreshnessState {
  readonly providerId: ProviderId
  readonly capability: ProviderCapability
  readonly freshnessMinutes: number | null
  readonly stale: boolean
  readonly degraded: boolean
}

export interface CreateProviderSyncStateInput {
  readonly providerId: ProviderId
  readonly capability: ProviderCapability
  readonly status: ProviderSyncStatus
  readonly lastSuccessAt?: string | null
  readonly lastAttemptAt?: string | null
  readonly lastErrorCode?: ProviderErrorCode | null
  readonly freshnessMinutes?: number | null
  readonly stale?: boolean
  readonly degraded?: boolean
  readonly itemCount?: number | null
  readonly requestId?: string | null
}

export const createProviderSyncState = (input: CreateProviderSyncStateInput): ProviderSyncState => {
  return {
    providerId: input.providerId,
    capability: input.capability,
    status: input.status,
    lastSuccessAt: input.lastSuccessAt ?? null,
    lastAttemptAt: input.lastAttemptAt ?? null,
    lastErrorCode: input.lastErrorCode ?? null,
    freshnessMinutes: input.freshnessMinutes ?? null,
    stale: input.stale ?? false,
    degraded: input.degraded ?? false,
    itemCount: input.itemCount ?? null,
    requestId: input.requestId ?? null,
  }
}

export interface ComputeFreshnessInput {
  readonly providerId: ProviderId
  readonly capability: ProviderCapability
  readonly lastSuccessAt: string | null
  readonly now: Date
  readonly maxAgeMinutes: number | null
}

/**
 * Pure freshness computation. Returns null minutes when last-success is unknown — it
 * does NOT collapse the unknown to 0. Stale/degraded only become true under a known
 * `maxAgeMinutes` budget; unknown budgets are reported as `stale=false, degraded=false`
 * with `freshnessMinutes` populated when last-success is known.
 */
export const computeProviderFreshness = (input: ComputeFreshnessInput): ProviderFreshnessState => {
  const lastSuccess = input.lastSuccessAt === null ? null : Date.parse(input.lastSuccessAt)
  const minutes =
    lastSuccess === null || Number.isNaN(lastSuccess)
      ? null
      : Math.max(0, Math.floor((input.now.getTime() - lastSuccess) / 60_000))

  const stale = minutes !== null && input.maxAgeMinutes !== null && minutes > input.maxAgeMinutes

  return {
    providerId: input.providerId,
    capability: input.capability,
    freshnessMinutes: minutes,
    stale,
    degraded: stale,
  }
}
