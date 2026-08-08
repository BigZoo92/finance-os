/**
 * Canonical asset valuation model — Financial Data Core.
 *
 * Core invariant: `unknown !== 0`. A missing price, missing FX rate or
 * unresolved identity must surface as `null` + explicit status, never as a
 * zero amount.
 */

export const VALUATION_BASE_CURRENCY = 'EUR' as const

export type ValuationStatus =
  | 'priced'
  | 'derived'
  | 'estimated'
  | 'manual'
  | 'stale'
  | 'unresolved'
  | 'unavailable'

export type ValuationSource =
  | 'provider_native'
  | 'market_quote'
  | 'bank_balance'
  | 'manual_entry'
  | 'none'

export type ValuationItemKind = 'cash' | 'investment' | 'manual' | 'position'

export type AssetIdentityStatus = 'resolved' | 'ambiguous' | 'unresolved' | 'unsupported'

export interface AssetIdentityInput {
  provider: string | null
  symbol?: string | null
  isin?: string | null
  conid?: string | null
  binanceAsset?: string | null
  exchange?: string | null
  currency?: string | null
}

export interface AssetIdentityResolution {
  status: AssetIdentityStatus
  /** Deterministic canonical key, e.g. `conid:265598`, `isin:FR0000121014`. */
  identityKey: string | null
  /** Which identifier decided the resolution. */
  resolvedBy: 'conid' | 'isin' | 'binance_asset' | 'symbol_exchange' | 'symbol_currency' | 'account' | 'manual' | null
}

export interface FxRateInput {
  /** Always the portfolio base currency (EUR). */
  baseCurrency: string
  quoteCurrency: string
  /** Quote units per 1 unit of base (ECB convention: 1 EUR = rate quote). */
  rate: number
  provider: string
  sourceType: 'daily' | 'intraday' | 'computed' | 'fallback'
  rateTimestamp: string
  staleAfterSeconds: number
}

export interface FxConversion {
  value: number
  rate: number
  provider: string | null
  rateTimestamp: string | null
  isStale: boolean
}

export interface ValuationItemInput {
  /** Stable canonical key of the valued item, e.g. `asset:12` or `position:ibkr-...`. */
  itemKey: string
  kind: ValuationItemKind
  name: string
  provider: string | null
  /** Loose asset class used by freshness policy: cash|stock|etf|fund|crypto|other. */
  assetClass: string
  currency: string | null
  quantity: number | null
  /** Current value in `currency` as reported by the provider / user. Null = unknown, never 0. */
  nativeValue: number | null
  /** Timestamp of the native value (price date or last sync). */
  asOf: string | null
  isManual: boolean
  costBasis: number | null
  costBasisCurrency: string | null
  costBasisSource: 'minimal' | 'provider' | 'manual' | 'unknown'
  identity: AssetIdentityInput
  /** Provider degraded reasons carried through for provenance. */
  degradedReasons: string[]
  /** Override for the per-class freshness policy, in seconds. */
  staleAfterSecondsOverride?: number
  /**
   * The native value was produced with an approximate input (e.g. a stale FX
   * bridge upstream): usable, but must surface as `estimated`, never `priced`.
   */
  approximateValue?: boolean
}

export interface ItemValuation {
  itemKey: string
  kind: ValuationItemKind
  name: string
  provider: string | null
  assetClass: string
  currency: string | null
  quantity: number | null
  /** Native value in original currency; preserved even when FX is unavailable. */
  valueOriginal: number | null
  /** Value converted to base currency. Null when unknown/unconvertible. */
  valueBase: number | null
  baseCurrency: typeof VALUATION_BASE_CURRENCY
  fxRate: number | null
  fxProvider: string | null
  fxTimestamp: string | null
  costBasisBase: number | null
  unrealizedPnlBase: number | null
  unrealizedPnlPercent: number | null
  status: ValuationStatus
  source: ValuationSource
  identityStatus: AssetIdentityStatus
  identityKey: string | null
  asOf: string | null
  staleAfterSeconds: number | null
  confidence: number
  errorCode: string | null
  safeErrorMessage: string | null
}

export interface ValuationStatusCounts {
  priced: number
  derived: number
  estimated: number
  manual: number
  stale: number
  unresolved: number
  unavailable: number
}

export interface ValuationBreakdownEntry {
  itemCount: number
  /** Sum of known base values. Null when no item in the group has a known value. */
  valueBase: number | null
  unknownValueCount: number
}

export interface ValuationCoverageReport {
  baseCurrency: typeof VALUATION_BASE_CURRENCY
  totalItems: number
  statusCounts: ValuationStatusCounts
  /**
   * Items with a usable value (priced/derived/estimated/manual/stale) over all
   * items needing valuation. Null when there are no items. Range [0, 100].
   */
  coveragePercent: number | null
  /** Sum of known base values. Null when no item has a known value. */
  totalValueBase: number | null
  /** Count of items whose value is unknown (unresolved + unavailable). */
  unknownValueCount: number
  providerBreakdown: Record<string, ValuationBreakdownEntry>
  assetClassBreakdown: Record<string, ValuationBreakdownEntry>
}
