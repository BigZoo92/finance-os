// PR17A — ProviderId (TYPES ONLY).
//
// `ProviderId` is a branded string. Adapter modules export their own concrete provider id
// (e.g., `'powens'`, `'binance'`) and the registry keys providers by it. The brand prevents
// arbitrary strings from accidentally being treated as a provider id at type-check time.

declare const __providerIdBrand: unique symbol

export type ProviderId = string & { readonly [__providerIdBrand]: 'ProviderId' }

/**
 * Type-only constructor. Use ONLY at adapter boundaries when the literal string is a
 * known, hard-coded provider id. Never call this on user input or provider responses —
 * a `ProviderId` is meant to be a closed registry of trusted identifiers.
 */
export function asProviderId(value: string): ProviderId {
  return value as ProviderId
}
