export type MarketProviderId = 'eodhd' | 'fred' | 'twelve_data'

export type MarketAssetClass = 'etf' | 'equity' | 'bond' | 'commodity'

export type MarketRegion = 'us' | 'europe' | 'world' | 'asia' | 'emerging' | 'africa'

export type DashboardMarketQuote = {
  instrumentId: string
  label: string
  shortLabel: string
  symbol: string
  assetClass: MarketAssetClass
  region: MarketRegion
  exchange: string
  currency: string
  proxyLabel: string | null
  tags: string[]
  price: number
  previousClose: number | null
  dayChangePct: number | null
  weekChangePct: number | null
  monthChangePct: number | null
  ytdChangePct: number | null
  history: Array<{
    date: string
    value: number
    provider: string
  }>
  source: {
    provider: MarketProviderId
    baselineProvider: MarketProviderId
    overlayProvider: MarketProviderId | null
    mode: 'eod' | 'delayed' | 'intraday'
    delayLabel: string
    reason: string
    quoteDate: string
    quoteAsOf: string | null
    capturedAt: string
    freshnessMinutes: number | null
    isDelayed: boolean
  }
  marketSession: {
    state: 'open' | 'closed'
    isOpen: boolean
    label: string
  }
}

export type DashboardMarketMacroSeries = {
  seriesId: string
  label: string
  shortLabel: string
  group: 'rates' | 'inflation' | 'labor'
  unit: 'percent' | 'spread' | 'index'
  description: string
  latestValue: number | null
  previousValue: number | null
  change: number | null
  changePct: number | null
  changeDirection: 'up' | 'down' | 'flat'
  displayValue: string
  comparisonLabel: string
  comparisonValue: string | null
  observationDate: string | null
  history: Array<{
    date: string
    value: number
  }>
  source: {
    provider: 'fred'
    freshnessLabel: string
    observationCount: number
  }
}

export type DashboardMarketSignal = {
  id: string
  title: string
  detail: string
  tone: 'risk' | 'opportunity' | 'neutral'
  severity: 'low' | 'medium' | 'high'
  evidence: string[]
  dataRefs: string[]
}

export type DashboardMarketProviderHealth = {
  provider: MarketProviderId
  label: string
  role: 'prices' | 'macro' | 'overlay'
  enabled: boolean
  status: 'healthy' | 'degraded' | 'failing' | 'idle'
  lastSuccessAt: string | null
  lastAttemptAt: string | null
  lastFailureAt: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  lastFetchedCount: number
  successCount: number
  failureCount: number
  skippedCount: number
  freshnessLabel: string
}

export type MarketContextBundle = {
  schemaVersion: '2026-04-10'
  generatedAt: string
  coverageSummary: {
    instrumentCount: number
    macroSeriesCount: number
    providers: Array<{
      provider: MarketProviderId
      role: 'prices' | 'macro' | 'overlay'
      coverageCount: number
      freshnessLabel: string
    }>
  }
  quoteFreshness: {
    intradayCount: number
    delayedCount: number
    eodCount: number
    staleCount: number
  }
  keyMovers: {
    gainers: Array<{ instrumentId: string; label: string; dayChangePct: number }>
    losers: Array<{ instrumentId: string; label: string; dayChangePct: number }>
  }
  marketBreadth: {
    positiveCount: number
    negativeCount: number
    flatCount: number
    strongestRegion: string | null
  }
  marketRegimeHints: string[]
  macroRegime: {
    rates: string[]
    inflation: string[]
    labor: string[]
  }
  ratesSummary: {
    fedFunds: number | null
    sofr: number | null
    ust2y: number | null
    ust10y: number | null
    spread10y2y: number | null
  }
  inflationSummary: {
    cpiYoY: number | null
    direction: 'cooling' | 'heating' | 'stable' | 'unknown'
  }
  laborSummary: {
    unemploymentRate: number | null
    direction: 'tightening' | 'softening' | 'stable' | 'unknown'
  }
  riskFlags: string[]
  anomalies: string[]
  warnings: string[]
  watchlistHighlights: Array<{
    instrumentId: string
    label: string
    summary: string
  }>
  providerProvenance: Array<{
    provider: MarketProviderId
    label: string
    role: 'prices' | 'macro' | 'overlay'
    freshnessLabel: string
    note: string
  }>
  confidence: {
    level: 'low' | 'medium' | 'high'
    score: number
    caveats: string[]
  }
}

export type DashboardMarketsOverviewResponse = {
  source: 'demo_fixture' | 'cache'
  dataset?: {
    version: string
    source: 'demo_fixture' | 'admin_live' | 'admin_fallback'
    mode: 'demo' | 'admin'
    isDemoData: boolean
  }
  requestId: string
  generatedAt: string
  freshness: {
    lastSuccessAt: string | null
    stale: boolean
    staleAgeSeconds: number | null
    staleAfterMinutes: number
    degradedReason: string | null
  }
  summary: {
    headline: string
    tone: 'risk' | 'opportunity' | 'neutral'
    badge: string
    openCount: number
    closedCount: number
    positiveCount: number
    negativeCount: number
    primarySourceLabel: string
  }
  panorama: {
    items: DashboardMarketQuote[]
  }
  macro: {
    items: DashboardMarketMacroSeries[]
  }
  watchlist: {
    items: DashboardMarketQuote[]
    groups: Array<{
      id: string
      label: string
      itemIds: string[]
    }>
  }
  signals: {
    items: DashboardMarketSignal[]
  }
  contextBundle: MarketContextBundle
  providers: DashboardMarketProviderHealth[]
}

export type DashboardMarketsRefreshResponse = {
  ok: boolean
  requestId: string
  refreshedAt: string
  quoteCount: number
  macroObservationCount: number
  signalCount: number
  providerResults: Array<{
    provider: MarketProviderId
    status: 'success' | 'failed' | 'skipped'
    requestId: string
    fetchedCount: number
    durationMs: number
    errorCode: string | null
    errorMessage: string | null
  }>
}
