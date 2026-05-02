export type ExternalInvestmentProvider = 'ibkr' | 'binance'

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

export type ExternalInvestmentProviderCoverage = {
  provider: ExternalInvestmentProvider
  configured: boolean
  status: 'healthy' | 'degraded' | 'failing' | 'idle' | 'missing'
  lastSuccessAt: string | null
  lastAttemptAt: string | null
  stale: boolean
  degradedReasons: string[]
}

export type ExternalInvestmentContextBundle = {
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
  confidence: 'high' | 'medium' | 'low' | 'unknown'
  provenance: Array<{ provider: ExternalInvestmentProvider; connectionId: string; positionCount: number }>
}

export type ExternalInvestmentConnection = {
  id: number
  provider: ExternalInvestmentProvider
  providerConnectionId: string
  accountAlias: string | null
  enabled: boolean
  status: string
  credentialStatus: string
  maskedMetadata: Record<string, unknown> | null
  lastSyncStatus: string | null
  lastSyncReasonCode: string | null
  lastSyncAttemptAt: string | null
  lastSyncAt: string | null
  lastSuccessAt: string | null
  lastFailedAt: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  syncMetadata: Record<string, unknown> | null
  archivedAt: string | null
  updatedAt: string
}

export type ExternalInvestmentStatusResponse = {
  requestId: string
  mode: 'demo' | 'admin'
  source: 'demo_fixture' | 'db'
  enabled: boolean
  safeModeActive: boolean
  providerEnabled: Record<ExternalInvestmentProvider, boolean>
  backlogCount?: number
  connections: ExternalInvestmentConnection[]
  health: Array<{
    provider: ExternalInvestmentProvider
    enabled: boolean
    status: 'healthy' | 'degraded' | 'failing' | 'idle' | 'missing'
    lastSuccessAt: string | null
    lastAttemptAt: string | null
    lastFailureAt: string | null
    lastErrorCode: string | null
    lastErrorMessage: string | null
    lastRequestId: string | null
    lastDurationMs: number | null
    lastRawImportCount: number
    lastNormalizedRowCount: number
    successCount: number
    failureCount: number
    skippedCount: number
    metadata: Record<string, unknown> | null
  }>
}

export type ExternalInvestmentPosition = {
  id: number
  provider: ExternalInvestmentProvider
  connectionId: number
  providerConnectionId: string
  accountExternalId: string
  accountAlias: string | null
  instrumentKey: string
  positionKey: string
  providerPositionId: string
  name: string
  symbol: string | null
  assetClass: ExternalInvestmentAssetClass
  quantity: number | null
  freeQuantity: number | null
  lockedQuantity: number | null
  currency: string | null
  providerValue: number | null
  normalizedValue: number | null
  valueCurrency: string | null
  valueSource: 'provider_reported' | 'market_cache' | 'manual' | 'unknown'
  valueAsOf: string | null
  costBasis: number | null
  costBasisCurrency: string | null
  realizedPnl: number | null
  unrealizedPnl: number | null
  metadata: Record<string, unknown> | null
  assumptions: string[]
  degradedReasons: string[]
  sourceConfidence: 'high' | 'medium' | 'low' | 'unknown'
  firstSeenAt: string
  lastSeenAt: string
  updatedAt: string
}

export type ExternalInvestmentTrade = {
  id: number
  provider: ExternalInvestmentProvider
  providerConnectionId: string
  accountExternalId: string
  symbol: string | null
  side: 'buy' | 'sell' | 'unknown'
  quantity: number | null
  price: number | null
  grossAmount: number | null
  netAmount: number | null
  currency: string | null
  feeAmount: number | null
  feeAsset: string | null
  tradedAt: string
  sourceConfidence: 'high' | 'medium' | 'low' | 'unknown'
}

export type ExternalInvestmentCashFlow = {
  id: number
  provider: ExternalInvestmentProvider
  providerConnectionId: string
  accountExternalId: string
  type: 'deposit' | 'withdrawal' | 'dividend' | 'interest' | 'fee' | 'tax' | 'transfer' | 'unknown'
  asset: string | null
  amount: number | null
  currency: string | null
  feeAmount: number | null
  feeAsset: string | null
  occurredAt: string
  sourceConfidence: 'high' | 'medium' | 'low' | 'unknown'
}

export type ExternalInvestmentSummaryResponse = {
  requestId: string
  source: 'demo_fixture' | 'cache'
  enabled: boolean
  safeModeActive: boolean
  providerEnabled: Record<ExternalInvestmentProvider, boolean>
  generatedAt: string | null
  dataStatus: { status: 'ready' | 'degraded' | 'empty'; message: string | null }
  status: ExternalInvestmentStatusResponse | { connections: ExternalInvestmentConnection[]; health: ExternalInvestmentStatusResponse['health'] }
  bundle: ExternalInvestmentContextBundle | null
  latestBundleMeta: {
    schemaVersion: string
    generatedAt: string
    requestId: string | null
    staleAfterMinutes: number
    updatedAt: string
  } | null
  positionCount: number
}

export type ExternalInvestmentListResponse<TItem> = {
  requestId: string
  source: 'demo_fixture' | 'cache'
  items: TItem[]
}

export type ExternalInvestmentSyncRunsResponse = ExternalInvestmentListResponse<{
  id: string
  requestId: string | null
  provider: ExternalInvestmentProvider
  providerConnectionId: string | null
  triggerSource: string
  status: 'running' | 'success' | 'degraded' | 'failed' | 'skipped'
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  errorCode: string | null
  errorMessage: string | null
  rowCounts: Record<string, number> | null
  degradedReasons: string[]
}>

export type ExternalInvestmentCredentialInput =
  | {
      provider: 'ibkr'
      flexToken: string
      queryIds: string[]
      accountAlias?: string
      expectedAccountIds?: string[]
      baseUrl?: string
      userAgent?: string
    }
  | {
      provider: 'binance'
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
