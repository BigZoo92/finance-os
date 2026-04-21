import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from './plugin'
import { createDerivedRecomputeRoute } from './routes/derived-recompute'
import { createGoalsRoute } from './routes/goals'
import { createMarketsRoute } from './routes/markets'
import { createNewsRoute } from './routes/news'
import { createSummaryRoute } from './routes/summary'
import { createAnalyticsRoute } from './routes/analytics'
import { createAdvisorRoute } from './routes/advisor'
import { createManualAssetsRoute } from './routes/manual-assets'
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
  newsProviderXTwitterEnabled,
  newsProviderXTwitterQuery,
  newsProviderXTwitterBearerToken,
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
  aiAdvisorEnabled,
  aiAdvisorAdminOnly,
  aiAdvisorForceLocalOnly,
  aiKnowledgeQaRetrievalEnabled,
  aiChatEnabled,
  aiChallengerEnabled,
  aiRelabelEnabled,
  aiOpenAiApiKey,
  aiOpenAiBaseUrl,
  aiOpenAiClassifierModel,
  aiOpenAiDailyModel,
  aiOpenAiDeepModel,
  aiAnthropicApiKey,
  aiAnthropicBaseUrl,
  aiAnthropicChallengerModel,
  aiBudgetDailyUsd,
  aiBudgetMonthlyUsd,
  aiBudgetDisableChallengerRatio,
  aiBudgetDisableDeepAnalysisRatio,
  aiMaxChatMessagesContext,
  aiUsdToEurRate,
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
  newsProviderXTwitterEnabled: boolean
  newsProviderXTwitterQuery: string
  newsProviderXTwitterBearerToken: string | undefined
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
  aiAdvisorEnabled: boolean
  aiAdvisorAdminOnly: boolean
  aiAdvisorForceLocalOnly: boolean
  aiKnowledgeQaRetrievalEnabled: boolean
  aiChatEnabled: boolean
  aiChallengerEnabled: boolean
  aiRelabelEnabled: boolean
  aiOpenAiApiKey: string | undefined
  aiOpenAiBaseUrl: string | undefined
  aiOpenAiClassifierModel: string
  aiOpenAiDailyModel: string
  aiOpenAiDeepModel: string
  aiAnthropicApiKey: string | undefined
  aiAnthropicBaseUrl: string | undefined
  aiAnthropicChallengerModel: string
  aiBudgetDailyUsd: number
  aiBudgetMonthlyUsd: number
  aiBudgetDisableChallengerRatio: number
  aiBudgetDisableDeepAnalysisRatio: number
  aiMaxChatMessagesContext: number
  aiUsdToEurRate: number
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
    newsProviderXTwitterEnabled,
    newsProviderXTwitterQuery,
    newsProviderXTwitterBearerToken,
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
    aiAdvisorEnabled,
    aiAdvisorAdminOnly,
    aiAdvisorForceLocalOnly,
    aiKnowledgeQaRetrievalEnabled,
    aiChatEnabled,
    aiChallengerEnabled,
    aiRelabelEnabled,
    aiOpenAiApiKey,
    aiOpenAiBaseUrl,
    aiOpenAiClassifierModel,
    aiOpenAiDailyModel,
    aiOpenAiDeepModel,
    aiAnthropicApiKey,
    aiAnthropicBaseUrl,
    aiAnthropicChallengerModel,
    aiBudgetDailyUsd,
    aiBudgetMonthlyUsd,
    aiBudgetDisableChallengerRatio,
    aiBudgetDisableDeepAnalysisRatio,
    aiMaxChatMessagesContext,
    aiUsdToEurRate,
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
    .use(createManualAssetsRoute())
    .use(
      createAdvisorRoute({
        advisorEnabled: aiAdvisorEnabled,
        adminOnly: aiAdvisorAdminOnly,
        chatEnabled: aiChatEnabled,
        relabelEnabled: aiRelabelEnabled,
      })
    )
    .use(createDerivedRecomputeRoute())
    .use(createGoalsRoute())
    .use(createTransactionsRoute())
    .use(createTransactionClassificationRoute())
}
