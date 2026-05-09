// PR17A — ProviderMeta + ProviderSourceMeta (TYPES ONLY).
//
// Every `ProviderResult` carries a `meta` envelope that tells the caller WHO answered, HOW
// fresh the data is, and WHERE it came from. This is the single mechanism the audit/explain
// layer uses to show users the provenance of any computed recommendation.
//
// `ProviderSourceMeta` is the per-source provenance record. A single call MAY surface
// multiple sources (e.g., quotes from one provider blended with macro from another); each
// source contributes one entry.

import type { ProviderCapability } from './capabilities'
import type { ProviderId } from './provider-id'

export interface ProviderSourceMeta {
  readonly providerId: ProviderId
  readonly capability: ProviderCapability
  /**
   * Age of the freshest data point in this source, in minutes. `null` is allowed only for
   * capabilities whose `ProviderCapabilityDefinition.allowsUnknownFreshness` is `true`.
   */
  readonly freshnessMinutes: number | null
  /**
   * `true` when the data was served from the provider's local cache rather than a live
   * upstream call. Consumers MAY treat this as a hint that retries are cheap and that the
   * value is at least `freshnessMinutes` old.
   */
  readonly fromCache: boolean
}

export interface ProviderMeta {
  /** Echoes the `requestId` from `ProviderCallContext` so logs can be joined. */
  readonly requestId: string
  /**
   * Provenance trail for the data carried in this result. Length is at least 1 — even
   * cache-only and error responses MUST identify which provider+capability produced them.
   */
  readonly sources: ReadonlyArray<ProviderSourceMeta>
  /** Wall-clock duration of the call, in milliseconds. Adapter MUST measure this. */
  readonly durationMs: number
}
