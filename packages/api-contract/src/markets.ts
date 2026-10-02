import { z } from 'zod'

/*
 * Markets transport contract (quotes, macro series, signals, context bundle).
 *
 * Every price or observation typed `.nullable()` means "unknown" when null;
 * it is never a 0 in disguise.
 */

export const marketProviderIdSchema = z.enum(['eodhd', 'fred', 'twelve_data'])
export type MarketProviderId = z.infer<typeof marketProviderIdSchema>

export const marketAssetClassSchema = z.enum(['etf', 'equity', 'bond', 'commodity'])
export type MarketAssetClass = z.infer<typeof marketAssetClassSchema>

export const marketRegionSchema = z.enum(['us', 'europe', 'world', 'asia', 'emerging', 'africa'])
export type MarketRegion = z.infer<typeof marketRegionSchema>

export const marketProviderRoleSchema = z.enum(['prices', 'macro', 'overlay'])
export type MarketProviderRole = z.infer<typeof marketProviderRoleSchema>

export const marketQuoteModeSchema = z.enum(['eod', 'delayed', 'intraday'])
export type MarketQuoteMode = z.infer<typeof marketQuoteModeSchema>

export const marketMacroSeriesGroupSchema = z.enum(['rates', 'inflation', 'labor'])
export type MarketMacroSeriesGroup = z.infer<typeof marketMacroSeriesGroupSchema>

export const marketMacroSeriesUnitSchema = z.enum(['percent', 'spread', 'index'])
export type MarketMacroSeriesUnit = z.infer<typeof marketMacroSeriesUnitSchema>

export const marketDatasetSourceSchema = z.enum(['demo_fixture', 'admin_live', 'admin_fallback'])
export type MarketDatasetSource = z.infer<typeof marketDatasetSourceSchema>

export const marketToneSchema = z.enum(['risk', 'opportunity', 'neutral'])
export type MarketTone = z.infer<typeof marketToneSchema>

// --- Quotes -------------------------------------------------------------------

export const marketHistoryPointSchema = z.object({
  date: z.string(),
  value: z.number(),
  provider: z.string(),
})
export type MarketHistoryPoint = z.infer<typeof marketHistoryPointSchema>

export const dashboardMarketQuoteSourceSchema = z.object({
  provider: marketProviderIdSchema,
  baselineProvider: marketProviderIdSchema,
  overlayProvider: marketProviderIdSchema.nullable(),
  mode: marketQuoteModeSchema,
  delayLabel: z.string(),
  reason: z.string(),
  quoteDate: z.string(),
  quoteAsOf: z.string().nullable(),
  capturedAt: z.string(),
  freshnessMinutes: z.number().nullable(),
  isDelayed: z.boolean(),
})
export type DashboardMarketQuoteSource = z.infer<typeof dashboardMarketQuoteSourceSchema>

export const dashboardMarketSessionSchema = z.object({
  state: z.enum(['open', 'closed']),
  isOpen: z.boolean(),
  label: z.string(),
})
export type DashboardMarketSession = z.infer<typeof dashboardMarketSessionSchema>

export const dashboardMarketQuoteSchema = z.object({
  instrumentId: z.string(),
  label: z.string(),
  shortLabel: z.string(),
  symbol: z.string(),
  assetClass: marketAssetClassSchema,
  region: marketRegionSchema,
  exchange: z.string(),
  currency: z.string(),
  proxyLabel: z.string().nullable(),
  tags: z.array(z.string()),
  /** Null when the quote could not be priced; never 0. */
  price: z.number().nullable(),
  previousClose: z.number().nullable(),
  dayChangePct: z.number().nullable(),
  weekChangePct: z.number().nullable(),
  monthChangePct: z.number().nullable(),
  ytdChangePct: z.number().nullable(),
  history: z.array(marketHistoryPointSchema),
  source: dashboardMarketQuoteSourceSchema,
  marketSession: dashboardMarketSessionSchema,
})
export type DashboardMarketQuote = z.infer<typeof dashboardMarketQuoteSchema>

// --- Macro --------------------------------------------------------------------

export const dashboardMarketMacroSeriesSchema = z.object({
  seriesId: z.string(),
  label: z.string(),
  shortLabel: z.string(),
  group: marketMacroSeriesGroupSchema,
  unit: marketMacroSeriesUnitSchema,
  description: z.string(),
  latestValue: z.number().nullable(),
  previousValue: z.number().nullable(),
  change: z.number().nullable(),
  changePct: z.number().nullable(),
  changeDirection: z.enum(['up', 'down', 'flat']),
  displayValue: z.string(),
  comparisonLabel: z.string(),
  comparisonValue: z.string().nullable(),
  observationDate: z.string().nullable(),
  history: z.array(z.object({ date: z.string(), value: z.number() })),
  source: z.object({
    provider: z.literal('fred'),
    freshnessLabel: z.string(),
    observationCount: z.number(),
  }),
})
export type DashboardMarketMacroSeries = z.infer<typeof dashboardMarketMacroSeriesSchema>

// --- Signals and providers ---------------------------------------------------

export const dashboardMarketSignalSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  tone: marketToneSchema,
  severity: z.enum(['low', 'medium', 'high']),
  evidence: z.array(z.string()),
  dataRefs: z.array(z.string()),
})
export type DashboardMarketSignal = z.infer<typeof dashboardMarketSignalSchema>

export const dashboardMarketProviderHealthSchema = z.object({
  provider: marketProviderIdSchema,
  label: z.string(),
  role: marketProviderRoleSchema,
  enabled: z.boolean(),
  status: z.enum(['healthy', 'degraded', 'failing', 'idle']),
  lastSuccessAt: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
  lastFailureAt: z.string().nullable(),
  lastErrorCode: z.string().nullable(),
  lastErrorMessage: z.string().nullable(),
  lastFetchedCount: z.number(),
  successCount: z.number(),
  failureCount: z.number(),
  skippedCount: z.number(),
  freshnessLabel: z.string(),
})
export type DashboardMarketProviderHealth = z.infer<typeof dashboardMarketProviderHealthSchema>

// --- Context bundle -----------------------------------------------------------

export const marketContextCoverageSummarySchema = z.object({
  instrumentCount: z.number(),
  macroSeriesCount: z.number(),
  providers: z.array(
    z.object({
      provider: marketProviderIdSchema,
      role: marketProviderRoleSchema,
      coverageCount: z.number(),
      freshnessLabel: z.string(),
    })
  ),
})
export type MarketContextCoverageSummary = z.infer<typeof marketContextCoverageSummarySchema>

export const marketContextQuoteFreshnessSchema = z.object({
  intradayCount: z.number(),
  delayedCount: z.number(),
  eodCount: z.number(),
  staleCount: z.number(),
})
export type MarketContextQuoteFreshness = z.infer<typeof marketContextQuoteFreshnessSchema>

export const marketContextMoverSchema = z.object({
  instrumentId: z.string(),
  label: z.string(),
  dayChangePct: z.number(),
})
export type MarketContextMover = z.infer<typeof marketContextMoverSchema>

export const marketContextKeyMoversSchema = z.object({
  gainers: z.array(marketContextMoverSchema),
  losers: z.array(marketContextMoverSchema),
})
export type MarketContextKeyMovers = z.infer<typeof marketContextKeyMoversSchema>

export const marketContextBreadthSchema = z.object({
  positiveCount: z.number(),
  negativeCount: z.number(),
  flatCount: z.number(),
  strongestRegion: z.string().nullable(),
})
export type MarketContextBreadth = z.infer<typeof marketContextBreadthSchema>

export const marketContextMacroRegimeSchema = z.object({
  rates: z.array(z.string()),
  inflation: z.array(z.string()),
  labor: z.array(z.string()),
})
export type MarketContextMacroRegime = z.infer<typeof marketContextMacroRegimeSchema>

export const marketContextRatesSummarySchema = z.object({
  fedFunds: z.number().nullable(),
  sofr: z.number().nullable(),
  ust2y: z.number().nullable(),
  ust10y: z.number().nullable(),
  spread10y2y: z.number().nullable(),
})
export type MarketContextRatesSummary = z.infer<typeof marketContextRatesSummarySchema>

export const marketContextInflationSummarySchema = z.object({
  cpiYoY: z.number().nullable(),
  direction: z.enum(['cooling', 'heating', 'stable', 'unknown']),
})
export type MarketContextInflationSummary = z.infer<typeof marketContextInflationSummarySchema>

export const marketContextLaborSummarySchema = z.object({
  unemploymentRate: z.number().nullable(),
  direction: z.enum(['tightening', 'softening', 'stable', 'unknown']),
})
export type MarketContextLaborSummary = z.infer<typeof marketContextLaborSummarySchema>

export const marketContextWatchlistHighlightSchema = z.object({
  instrumentId: z.string(),
  label: z.string(),
  summary: z.string(),
})
export type MarketContextWatchlistHighlight = z.infer<typeof marketContextWatchlistHighlightSchema>

export const marketContextProviderProvenanceSchema = z.object({
  provider: marketProviderIdSchema,
  label: z.string(),
  role: marketProviderRoleSchema,
  freshnessLabel: z.string(),
  note: z.string(),
})
export type MarketContextProviderProvenance = z.infer<typeof marketContextProviderProvenanceSchema>

export const marketContextConfidenceSchema = z.object({
  level: z.enum(['low', 'medium', 'high']),
  score: z.number(),
  caveats: z.array(z.string()),
})
export type MarketContextConfidence = z.infer<typeof marketContextConfidenceSchema>

export const marketContextBundleSchema = z.object({
  schemaVersion: z.literal('2026-04-10'),
  generatedAt: z.string(),
  coverageSummary: marketContextCoverageSummarySchema,
  quoteFreshness: marketContextQuoteFreshnessSchema,
  keyMovers: marketContextKeyMoversSchema,
  marketBreadth: marketContextBreadthSchema,
  marketRegimeHints: z.array(z.string()),
  macroRegime: marketContextMacroRegimeSchema,
  ratesSummary: marketContextRatesSummarySchema,
  inflationSummary: marketContextInflationSummarySchema,
  laborSummary: marketContextLaborSummarySchema,
  riskFlags: z.array(z.string()),
  anomalies: z.array(z.string()),
  warnings: z.array(z.string()),
  watchlistHighlights: z.array(marketContextWatchlistHighlightSchema),
  providerProvenance: z.array(marketContextProviderProvenanceSchema),
  confidence: marketContextConfidenceSchema,
})
export type MarketContextBundle = z.infer<typeof marketContextBundleSchema>

// --- Overview -----------------------------------------------------------------

export const dashboardMarketsDatasetSchema = z.object({
  version: z.string(),
  source: marketDatasetSourceSchema,
  mode: z.enum(['demo', 'admin']),
  isDemoData: z.boolean(),
})
export type DashboardMarketsDataset = z.infer<typeof dashboardMarketsDatasetSchema>

export const dashboardMarketsFreshnessSchema = z.object({
  lastSuccessAt: z.string().nullable(),
  stale: z.boolean(),
  staleAgeSeconds: z.number().nullable(),
  staleAfterMinutes: z.number(),
  degradedReason: z.string().nullable(),
})
export type DashboardMarketsFreshness = z.infer<typeof dashboardMarketsFreshnessSchema>

export const dashboardMarketsSummarySchema = z.object({
  headline: z.string(),
  tone: marketToneSchema,
  badge: z.string(),
  openCount: z.number(),
  closedCount: z.number(),
  positiveCount: z.number(),
  negativeCount: z.number(),
  primarySourceLabel: z.string(),
})
export type DashboardMarketsSummary = z.infer<typeof dashboardMarketsSummarySchema>

export const dashboardMarketsWatchlistGroupSchema = z.object({
  id: z.string(),
  label: z.string(),
  itemIds: z.array(z.string()),
})
export type DashboardMarketsWatchlistGroup = z.infer<typeof dashboardMarketsWatchlistGroupSchema>

export const dashboardMarketsOverviewResponseSchema = z.object({
  source: z.enum(['demo_fixture', 'cache']),
  dataset: dashboardMarketsDatasetSchema.optional(),
  requestId: z.string(),
  generatedAt: z.string(),
  freshness: dashboardMarketsFreshnessSchema,
  summary: dashboardMarketsSummarySchema,
  panorama: z.object({ items: z.array(dashboardMarketQuoteSchema) }),
  macro: z.object({ items: z.array(dashboardMarketMacroSeriesSchema) }),
  watchlist: z.object({
    items: z.array(dashboardMarketQuoteSchema),
    groups: z.array(dashboardMarketsWatchlistGroupSchema),
  }),
  signals: z.object({ items: z.array(dashboardMarketSignalSchema) }),
  contextBundle: marketContextBundleSchema,
  providers: z.array(dashboardMarketProviderHealthSchema),
})
export type DashboardMarketsOverviewResponse = z.infer<
  typeof dashboardMarketsOverviewResponseSchema
>
