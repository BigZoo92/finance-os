import type { MarketProviderId } from '@finance-os/api-contract/markets'

export type {
  DashboardMarketMacroSeries,
  DashboardMarketProviderHealth,
  DashboardMarketQuote,
  DashboardMarketSignal,
  DashboardMarketsOverviewResponse,
  MarketAssetClass,
  MarketContextBundle,
  MarketProviderId,
  MarketRegion,
} from '@finance-os/api-contract/markets'

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
