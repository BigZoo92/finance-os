// PR17A — Provider Capability Registry (TYPES ONLY).
//
// This file defines the closed-set provider capabilities Finance-OS supports.
// **Read-only by construction.** Write/execute capabilities (orders, transfers, payments)
// are LISTED HERE as forbidden so the type-level guard at the bottom of the file fails to
// compile if any of them ever leak into the allowed union.
//
// PR17A is types-only: nothing in this file performs I/O, opens a connection, or imports a
// runtime provider module. The const tuples are literal strings used for compile-time +
// test-level guards.
//
// See ADR `docs/adr/provider-abstraction-v2.md` §6.1 for the design rationale.

// ---------------------------------------------------------------------------
// Allowed capabilities — every key is a read-only contract surface.
// Capability keys follow `<domain>.<resource>.<action>` to make grep/filter trivial.
// `action` MUST be a read-shaped verb: `read | detect | compute | query | bundle`.
// ---------------------------------------------------------------------------

export const ALLOWED_PROVIDER_CAPABILITIES = [
  // Internal services
  'knowledge.context_bundle.read',
  'knowledge.query.read',
  'quant.patterns.detect',
  'quant.metrics.compute',
  'quant.indicators.compute',

  // Market / macro / news (third-party read paths)
  'market.quotes.read',
  'market.macro.read',
  'news.items.read',

  // Open banking + external investments (read-only by construction)
  'banking.accounts.read',
  'banking.transactions.read',
  'external_investments.positions.read',
  'external_investments.trades.read',
  'crypto.wallet.read',
] as const

export type ProviderCapability = (typeof ALLOWED_PROVIDER_CAPABILITIES)[number]

// ---------------------------------------------------------------------------
// Forbidden capabilities — explicit "do NOT add" list.
//
// These represent execution / write side-effects in third-party systems. Finance-OS is
// advisory-only and paper-only; any future PR that wants to wire one of these MUST first
// amend the ADR (currently `Status: proposed` for v2) and add a separate human-reviewed
// safety review.
//
// The compile-time guard at the bottom of this file asserts that NONE of these strings
// appear in `ProviderCapability`. The runtime / test-level guard asserts the same against
// `ALLOWED_PROVIDER_CAPABILITIES`.
// ---------------------------------------------------------------------------

export const FORBIDDEN_PROVIDER_CAPABILITIES = [
  'trading.order.create',
  'trading.order.cancel',
  'trading.position.open',
  'trading.position.close',
  'crypto.swap.execute',
  'crypto.transfer.create',
  'payment.charge.create',
  'bank.transfer.create',
] as const

export type ForbiddenProviderCapability = (typeof FORBIDDEN_PROVIDER_CAPABILITIES)[number]

// ---------------------------------------------------------------------------
// Compile-time guard
//
// `Extract<A, B>` is the intersection. If any forbidden capability has leaked into the
// allowed union, this becomes a non-`never` type and the assertion below fails to compile.
// ---------------------------------------------------------------------------

type _NoForbiddenInAllowed = Extract<ProviderCapability, ForbiddenProviderCapability>

// `_AssertNoForbiddenInAllowed` resolves to `true` only if the intersection is `never`.
// If a forbidden string ever leaks into `ALLOWED_PROVIDER_CAPABILITIES`, the conditional
// flips to `false`, and the const assignment below stops type-checking.
type _AssertNoForbiddenInAllowed = [_NoForbiddenInAllowed] extends [never] ? true : false

// Reading this constant fixes the compile-time check in place; renaming or deleting it
// would silently break the guard, so it is exported as a public marker. Importing it costs
// zero runtime.
export const __PROVIDER_CAPABILITY_GUARD_OK: _AssertNoForbiddenInAllowed = true

// ---------------------------------------------------------------------------
// Capability shape definition (informational, type-only)
//
// A `ProviderCapabilityDefinition` describes one capability key — the input/output DTO
// shape is owned by Finance-OS, NOT the provider. PR17A does not enumerate every DTO; that
// happens incrementally as adapters are migrated (per ADR §11.6). This type lets future
// PRs declare a capability's contract centrally.
// ---------------------------------------------------------------------------

export interface ProviderCapabilityDefinition<C extends ProviderCapability = ProviderCapability> {
  readonly capability: C
  readonly description: string
  /** True when the capability is read-only and idempotent. PR17A: all capabilities are. */
  readonly readOnly: true
  /**
   * `true` if a provider response without `freshnessMinutes` is acceptable for this
   * capability (e.g., real-time quotes always carry freshness; static reference data may
   * not). Default `false` — adapters MUST populate `freshnessMinutes`.
   */
  readonly allowsUnknownFreshness: boolean
}
