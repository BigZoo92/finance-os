export type ExternalInvestmentProvider = 'ibkr' | 'binance'

export const isExternalInvestmentProvider = (
  value: unknown
): value is ExternalInvestmentProvider => value === 'ibkr' || value === 'binance'

export type ExternalInvestmentAssetClass =
  | 'cash'
  | 'equity'
  | 'etf'
  | 'crypto'
  | 'stablecoin'
  | 'fund'
  | 'bond'
  | 'commodity'
  | 'unknown'

export type ExternalInvestmentSourceConfidence = 'high' | 'medium' | 'low' | 'unknown'

export type ExternalInvestmentValueSource =
  | 'provider_reported'
  | 'market_cache'
  | 'manual'
  | 'unknown'

export type ExternalInvestmentErrorCode =
  | 'PROVIDER_CREDENTIALS_MISSING'
  | 'PROVIDER_CREDENTIALS_INVALID'
  | 'PROVIDER_PERMISSION_UNSAFE'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_SCHEMA_CHANGED'
  | 'PROVIDER_PARTIAL_DATA'
  | 'PROVIDER_STALE_DATA'
  | 'NORMALIZATION_FAILED'
  | 'VALUATION_PARTIAL'
  | 'ADVISOR_BUNDLE_STALE'

export type ExternalInvestmentCredentialKind = 'ibkr_flex' | 'binance_spot'

export type IbkrFlexCredentialPayload = {
  provider: 'ibkr'
  kind: 'ibkr_flex'
  flexToken: string
  queryIds: string[]
  accountAlias?: string
  expectedAccountIds?: string[]
  baseUrl?: string
  userAgent?: string
}

export type BinanceSpotCredentialPayload = {
  provider: 'binance'
  kind: 'binance_spot'
  apiKey: string
  apiSecret: string
  accountAlias?: string
  baseUrl?: string
  permissionsMetadata?: {
    canRead?: boolean
    tradingEnabled?: boolean
    withdrawEnabled?: boolean
    ipRestricted?: boolean
  }
  ipRestrictionNote?: string
}

export type ExternalInvestmentCredentialPayload =
  | IbkrFlexCredentialPayload
  | BinanceSpotCredentialPayload

export type ExternalInvestmentMaskedCredential = {
  provider: ExternalInvestmentProvider
  kind: ExternalInvestmentCredentialKind
  accountAlias: string | null
  maskedSecretRefs: Record<string, string>
  metadata: Record<string, unknown>
  warnings: string[]
}

export type ExternalInvestmentCanonicalAccount = {
  provider: ExternalInvestmentProvider
  connectionId: string
  accountExternalId: string
  accountType: string | null
  accountAlias: string | null
  baseCurrency: string | null
  metadata: Record<string, unknown> | null
  degradedReasons: string[]
  sourceConfidence: ExternalInvestmentSourceConfidence
  rawImportKey: string | null
}

export type ExternalInvestmentCanonicalInstrument = {
  provider: ExternalInvestmentProvider
  connectionId: string
  instrumentKey: string
  symbol: string | null
  name: string
  currency: string | null
  assetClass: ExternalInvestmentAssetClass
  isin: string | null
  cusip: string | null
  conid: string | null
  binanceAsset: string | null
  binanceSymbol: string | null
  metadata: Record<string, unknown> | null
  sourceConfidence: ExternalInvestmentSourceConfidence
  rawImportKey: string | null
}

export type ExternalInvestmentCanonicalPosition = {
  provider: ExternalInvestmentProvider
  connectionId: string
  accountExternalId: string
  instrumentKey: string
  positionKey: string
  providerPositionId: string
  name: string
  symbol: string | null
  assetClass: ExternalInvestmentAssetClass
  quantity: string | null
  freeQuantity: string | null
  lockedQuantity: string | null
  currency: string | null
  providerValue: string | null
  normalizedValue: string | null
  valueCurrency: string | null
  valueSource: ExternalInvestmentValueSource
  valueAsOf: string | null
  costBasis: string | null
  costBasisCurrency: string | null
  realizedPnl: string | null
  unrealizedPnl: string | null
  metadata: Record<string, unknown> | null
  assumptions: string[]
  degradedReasons: string[]
  sourceConfidence: ExternalInvestmentSourceConfidence
  rawImportKey: string | null
}

export type ExternalInvestmentTradeSide = 'buy' | 'sell' | 'unknown'

export type ExternalInvestmentCanonicalTrade = {
  provider: ExternalInvestmentProvider
  connectionId: string
  accountExternalId: string
  instrumentKey: string
  tradeKey: string
  providerTradeId: string
  symbol: string | null
  side: ExternalInvestmentTradeSide
  quantity: string | null
  price: string | null
  grossAmount: string | null
  netAmount: string | null
  currency: string | null
  feeAmount: string | null
  feeAsset: string | null
  tradedAt: string
  metadata: Record<string, unknown> | null
  sourceConfidence: ExternalInvestmentSourceConfidence
  rawImportKey: string | null
}

export type ExternalInvestmentCashFlowType =
  | 'deposit'
  | 'withdrawal'
  | 'dividend'
  | 'interest'
  | 'fee'
  | 'tax'
  | 'transfer'
  | 'unknown'

export type ExternalInvestmentCanonicalCashFlow = {
  provider: ExternalInvestmentProvider
  connectionId: string
  accountExternalId: string
  cashFlowKey: string
  providerCashFlowId: string
  type: ExternalInvestmentCashFlowType
  asset: string | null
  amount: string | null
  currency: string | null
  feeAmount: string | null
  feeAsset: string | null
  occurredAt: string
  metadata: Record<string, unknown> | null
  sourceConfidence: ExternalInvestmentSourceConfidence
  rawImportKey: string | null
}

export type ExternalInvestmentRawImportDraft = {
  provider: ExternalInvestmentProvider
  connectionId: string
  accountExternalId: string | null
  objectType:
    | 'account'
    | 'instrument'
    | 'position'
    | 'trade'
    | 'cash_flow'
    | 'statement'
    | 'provider_health'
  externalObjectId: string
  providerObjectAt: string | null
  payload: unknown
  importStatus: 'metadata_only' | 'normalized' | 'failed'
}

export type ExternalInvestmentNormalizedSnapshot = {
  provider: ExternalInvestmentProvider
  connectionId: string
  generatedAt: string
  accounts: ExternalInvestmentCanonicalAccount[]
  instruments: ExternalInvestmentCanonicalInstrument[]
  positions: ExternalInvestmentCanonicalPosition[]
  trades: ExternalInvestmentCanonicalTrade[]
  cashFlows: ExternalInvestmentCanonicalCashFlow[]
  rawImports: ExternalInvestmentRawImportDraft[]
  degradedReasons: string[]
  warnings: string[]
}

export type ExternalInvestmentProviderCoverage = {
  provider: ExternalInvestmentProvider
  configured: boolean
  status: 'healthy' | 'degraded' | 'failing' | 'idle' | 'missing'
  lastSuccessAt: string | null
  lastAttemptAt: string | null
  stale: boolean
  degradedReasons: string[]
}

export type ExternalInvestmentBundlePositionInput = {
  provider: ExternalInvestmentProvider
  connectionId: string
  accountExternalId: string
  accountAlias: string | null
  positionKey: string
  name: string
  symbol: string | null
  assetClass: ExternalInvestmentAssetClass
  currency: string | null
  quantity: number | null
  value: number | null
  valueCurrency: string | null
  valueSource: ExternalInvestmentValueSource
  valueAsOf: string | null
  costBasis: number | null
  costBasisSource: 'provider' | 'manual' | 'unknown'
  unrealizedPnl: number | null
  degradedReasons: string[]
  assumptions: string[]
}

export type ExternalInvestmentBundle = {
  schemaVersion: '2026-05-01'
  generatedAt: string
  providerCoverage: ExternalInvestmentProviderCoverage[]
  totalKnownValue: number
  unknownValuePositionCount: number
  allocationByAssetClass: Array<{ key: ExternalInvestmentAssetClass; value: number; weightPct: number }>
  allocationByProvider: Array<{ key: ExternalInvestmentProvider; value: number; weightPct: number }>
  allocationByAccount: Array<{ key: string; label: string; value: number; weightPct: number }>
  allocationByCurrency: Array<{ key: string; value: number; weightPct: number }>
  topConcentrations: Array<{
    positionKey: string
    label: string
    provider: ExternalInvestmentProvider
    value: number
    weightPct: number
  }>
  cryptoExposure: { value: number; weightPct: number; unknownValueCount: number }
  stablecoinExposure: { value: number; weightPct: number; unknownValueCount: number }
  cashDrag: { cashLikeValue: number; weightPct: number; note: string }
  recentTradesSummary: { count: number; byProvider: Record<string, number> }
  recentCashFlowsSummary: { count: number; byType: Record<string, number> }
  feesSummary: { knownFees: number; currency: string; unknownFeeCount: number }
  pnlSummary: { realizedKnown: number | null; unrealizedKnown: number | null; unknownPnlCount: number }
  unknownCostBasisWarnings: string[]
  missingMarketDataWarnings: string[]
  staleDataWarnings: string[]
  fxAssumptions: string[]
  riskFlags: string[]
  opportunityFlags: string[]
  assumptions: string[]
  confidence: ExternalInvestmentSourceConfidence
  provenance: Array<{ provider: ExternalInvestmentProvider; connectionId: string; positionCount: number }>
}
