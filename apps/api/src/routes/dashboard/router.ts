import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from './plugin'
import { createDerivedRecomputeRoute } from './routes/derived-recompute'
import { createGoalsRoute } from './routes/goals'
import { createMarketsRoute } from './routes/markets'
import { createNewsRoute } from './routes/news'
import { createSummaryRoute } from './routes/summary'
import { createAnalyticsRoute } from './routes/analytics'
import { createAdvisorRoute } from './routes/advisor'
import { createTransactionClassificationRoute } from './routes/transaction-classification'
import { createTransactionsRoute } from './routes/transactions'
import { createDashboardRouteRuntime } from './runtime'
import type { FailsoftSource } from './domain/failsoft-policy'
import type { ApiDb, RedisClient } from './types'

export const createDashboardRoutes = ({
  db,
  redisClient,
  featureEnabled,
  liveNewsIngestionEnabled,
  transactionsSnapshotStaleAfterMinutes,
  failsoftPolicyEnabled,
  failsoftSourceOrder,
  failsoftNewsEnabled,
  aiContextBundleEnabled,
  maxNewsItemsPerProvider,
  metadataFetchEnabled,
  metadataFetchTimeoutMs,
  metadataFetchMaxBytes,
  metadataFetchUserAgent,
  newsProviderHnEnabled,
  newsProviderHnQuery,
  newsProviderGdeltEnabled,
  newsProviderGdeltQuery,
  newsProviderEcbRssEnabled,
  newsProviderEcbRssFeedUrls,
  newsProviderEcbDataEnabled,
  newsProviderEcbDataSeriesKeys,
  newsProviderFedEnabled,
  newsProviderFedFeedUrls,
  newsProviderSecEnabled,
  newsProviderSecUserAgent,
  newsProviderSecTickers,
  newsProviderFredEnabled,
  newsProviderFredApiKey,
  newsProviderFredSeriesIds,
  marketDataEnabled,
  marketDataRefreshEnabled,
  marketDataForceFixtureFallback,
  marketDataStaleAfterMinutes,
  marketDataEodhdEnabled,
  marketDataTwelveDataEnabled,
  marketDataFredEnabled,
  marketDataUsFreshOverlayEnabled,
  marketDataDefaultWatchlistIds,
  marketDataFredSeriesIds,
  eodhdApiKey,
  twelveDataApiKey,
}: {
  db: ApiDb
  redisClient: RedisClient
  featureEnabled: boolean
  liveNewsIngestionEnabled: boolean
  transactionsSnapshotStaleAfterMinutes: number
  failsoftPolicyEnabled: boolean
  failsoftSourceOrder: FailsoftSource[]
  failsoftNewsEnabled: boolean
  aiContextBundleEnabled: boolean
  maxNewsItemsPerProvider: number
  metadataFetchEnabled: boolean
  metadataFetchTimeoutMs: number
  metadataFetchMaxBytes: number
  metadataFetchUserAgent: string
  newsProviderHnEnabled: boolean
  newsProviderHnQuery: string
  newsProviderGdeltEnabled: boolean
  newsProviderGdeltQuery: string
  newsProviderEcbRssEnabled: boolean
  newsProviderEcbRssFeedUrls: string[]
  newsProviderEcbDataEnabled: boolean
  newsProviderEcbDataSeriesKeys: string[]
  newsProviderFedEnabled: boolean
  newsProviderFedFeedUrls: string[]
  newsProviderSecEnabled: boolean
  newsProviderSecUserAgent: string
  newsProviderSecTickers: string[]
  newsProviderFredEnabled: boolean
  newsProviderFredApiKey: string | undefined
  newsProviderFredSeriesIds: string[]
  marketDataEnabled: boolean
  marketDataRefreshEnabled: boolean
  marketDataForceFixtureFallback: boolean
  marketDataStaleAfterMinutes: number
  marketDataEodhdEnabled: boolean
  marketDataTwelveDataEnabled: boolean
  marketDataFredEnabled: boolean
  marketDataUsFreshOverlayEnabled: boolean
  marketDataDefaultWatchlistIds: string[]
  marketDataFredSeriesIds: string[]
  eodhdApiKey: string | undefined
  twelveDataApiKey: string | undefined
}) => {
  const runtime = createDashboardRouteRuntime({
    db,
    redisClient,
    featureEnabled,
    liveNewsIngestionEnabled,
    transactionsSnapshotStaleAfterMinutes,
    failsoftPolicyEnabled,
    failsoftSourceOrder,
    failsoftNewsEnabled,
    aiContextBundleEnabled,
    maxNewsItemsPerProvider,
    metadataFetchEnabled,
    metadataFetchTimeoutMs,
    metadataFetchMaxBytes,
    metadataFetchUserAgent,
    newsProviderHnEnabled,
    newsProviderHnQuery,
    newsProviderGdeltEnabled,
    newsProviderGdeltQuery,
    newsProviderEcbRssEnabled,
    newsProviderEcbRssFeedUrls,
    newsProviderEcbDataEnabled,
    newsProviderEcbDataSeriesKeys,
    newsProviderFedEnabled,
    newsProviderFedFeedUrls,
    newsProviderSecEnabled,
    newsProviderSecUserAgent,
    newsProviderSecTickers,
    newsProviderFredEnabled,
    newsProviderFredApiKey,
    newsProviderFredSeriesIds,
    marketDataEnabled,
    marketDataRefreshEnabled,
    marketDataStaleAfterMinutes,
    marketDataEodhdEnabled,
    marketDataTwelveDataEnabled,
    marketDataFredEnabled,
    marketDataUsFreshOverlayEnabled,
    marketDataDefaultWatchlistIds,
    marketDataFredSeriesIds,
    eodhdApiKey,
    twelveDataApiKey,
  })

  return new Elysia({ prefix: '/dashboard' })
    .use(createDashboardRuntimePlugin(runtime))
    .use(createSummaryRoute())
    .use(createNewsRoute())
    .use(
      createMarketsRoute({
        marketDataForceFixtureFallback,
      })
    )
    .use(createAnalyticsRoute())
    .use(createAdvisorRoute())
    .use(createDerivedRecomputeRoute())
    .use(createGoalsRoute())
    .use(createTransactionsRoute())
    .use(createTransactionClassificationRoute())
}
