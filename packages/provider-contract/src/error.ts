// PR17A — ProviderError + ProviderErrorCode (TYPES ONLY).
//
// `ProviderErrorCode` is a CLOSED union. Every adapter MUST map any provider-specific failure
// onto exactly one of these codes; nothing else is allowed across the contract boundary.
//
// Security invariant: `ProviderError` MUST NOT carry secrets. The optional `causeRedacted`
// field is for short, redacted human-readable detail (e.g., "rate limit hit"); it MUST NOT
// echo API keys, tokens, signed URLs, query strings, or raw provider payloads. Adapter
// authors are responsible for redaction before constructing this object.

import type { ProviderId } from './provider-id'

// ---------------------------------------------------------------------------
// Closed taxonomy of provider error codes.
//
// Tuple form is the source of truth: it lets us export the code list at runtime for
// exhaustive pattern matching in tests, while the type union is derived from it so the
// two cannot drift.
// ---------------------------------------------------------------------------

export const PROVIDER_ERROR_CODES = [
  'unconfigured',
  'disabled_by_flag',
  'rate_limited',
  'auth_failed',
  'not_found',
  'invalid_input',
  'transient',
  'permanent',
  'tos_blocked',
  'demo_mode_forbidden',
  'budget_exceeded',
  'stale_cache',
  'provider_unavailable',
  'unsupported_capability',
] as const

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number]

// ---------------------------------------------------------------------------
// ProviderError — flat, serializable, redaction-aware.
//
// Kept as a plain interface (not a class) per PR17A's TYPES ONLY constraint. Adapter
// implementations build literal objects matching this shape.
// ---------------------------------------------------------------------------

export interface ProviderError {
  /** Closed-union failure code. */
  readonly code: ProviderErrorCode
  /** Identifier of the provider that produced the error. */
  readonly providerId: ProviderId
  /** Whether the caller is allowed to retry the same call (subject to backoff). */
  readonly retryable: boolean
  /**
   * Optional short human-readable detail. MUST be redacted of secrets, tokens, signed
   * URLs, and raw provider payloads. Intended for log lines and operator UI only.
   */
  readonly causeRedacted?: string
}
