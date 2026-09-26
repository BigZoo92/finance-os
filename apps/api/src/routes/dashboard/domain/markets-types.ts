import type {
  DashboardMarketMacroSeries,
  DashboardMarketProviderHealth,
  DashboardMarketQuote,
  DashboardMarketsOverviewResponse,
  MarketContextBundle,
  MarketHistoryPoint,
  MarketProviderId,
} from '@finance-os/api-contract/markets'
import type { MarketInstrumentDefinition, MarketMacroSeriesDefinition } from './market-definitions'

export type {
  DashboardMarketMacroSeries,
  DashboardMarketProviderHealth,
  DashboardMarketQuote,
  DashboardMarketSignal,
  DashboardMarketsOverviewResponse,
  MarketContextBundle,
  MarketDatasetSource,
  MarketHistoryPoint,
} from '@finance-os/api-contract/markets'

export type MarketProviderRunStatus = 'success' | 'failed' | 'skipped'

export interface DashboardMarketsWatchlistResponse {
  requestId: string
  generatedAt: string
  freshness: DashboardMarketsOverviewResponse['freshness']
  items: DashboardMarketQuote[]
  groups: DashboardMarketsOverviewResponse['watchlist']['groups']
  providers: DashboardMarketProviderHealth[]
}

export interface DashboardMarketsMacroResponse {
  requestId: string
  generatedAt: string
  freshness: DashboardMarketsOverviewResponse['freshness']
  items: DashboardMarketMacroSeries[]
  providers: DashboardMarketProviderHealth[]
}

export interface DashboardMarketsContextBundleResponse {
  requestId: string
  generatedAt: string
  freshness: DashboardMarketsOverviewResponse['freshness']
  bundle: MarketContextBundle
}

export interface MarketQuotePersistInput {
  instrument: MarketInstrumentDefinition
  sourceProvider: MarketProviderId
  baselineProvider: MarketProviderId
  overlayProvider: MarketProviderId | null
  sourceMode: 'eod' | 'delayed' | 'intraday'
  sourceDelayLabel: string
  sourceReason: string
  quoteDate: string
  quoteAsOf: Date | null
  capturedAt: Date
  marketState: 'open' | 'closed'
  marketOpen: boolean
  isDelayed: boolean
  freshnessMinutes: number | null
  price: number
  previousClose: number | null
  dayChangePct: number | null
  weekChangePct: number | null
  monthChangePct: number | null
  ytdChangePct: number | null
  history: MarketHistoryPoint[]
  metadata: Record<string, unknown> | null
}

export interface MarketMacroObservationPersistInput {
  series: MarketMacroSeriesDefinition
  observationDate: string
  value: number
  metadata: Record<string, unknown> | null
}

export interface MarketProviderRunResult {
  provider: MarketProviderId
  status: MarketProviderRunStatus
  requestId: string
  fetchedCount: number
  durationMs: number
  errorCode: string | null
  errorMessage: string | null
}
