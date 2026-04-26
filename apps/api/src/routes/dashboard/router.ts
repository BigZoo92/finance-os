import { Elysia } from 'elysia'
import type { FailsoftSource } from './domain/failsoft-policy'
import { createDashboardRuntimePlugin } from './plugin'
import { createAdvisorRoute } from './routes/advisor'
import { createAdvisorKnowledgeRoute } from './routes/advisor-knowledge'
import { createAnalyticsRoute } from './routes/analytics'
import { createDerivedRecomputeRoute } from './routes/derived-recompute'
import { createGoalsRoute } from './routes/goals'
import { createManualAssetsRoute } from './routes/manual-assets'
import { createMarketsRoute } from './routes/markets'
import { createNewsRoute } from './routes/news'
import { createSignalSourcesRoute } from './routes/signal-sources'
import { createSummaryRoute } from './routes/summary'
import { createTransactionClassificationRoute } from './routes/transaction-classification'
import { createTransactionsRoute } from './routes/transactions'
import { createDashboardRouteRuntime } from './runtime'
import type { ApiDb, RedisClient } from './types'

export const createDashboardRoutes = ({
  db,
  redisClient,
  featureEnabled,
  liveNewsIngestionEnabled,
  transactionsSnapshotStaleAfterMinutes,
  transactionsCategorizationMigrationEnabled,
  transactionsCategorizationRolloutPercent,
  transactionsCategorizationDisagreementAlertRate,
  transactionsCategorizationShadowLatencyBudgetMs,
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
  advisorXSignalsMode,
  knowledgeServiceEnabled,
  knowledgeServiceUrl,
  knowledgeServiceTimeoutMs,
  knowledgeGraphMaxContextTokens,
  knowledgeGraphRetrievalMode,
  knowledgeGraphMaxPathDepth,
  knowledgeGraphMinConfidence,
}: {
  db: ApiDb
  redisClient: RedisClient
  featureEnabled: boolean
  liveNewsIngestionEnabled: boolean
  transactionsSnapshotStaleAfterMinutes: number
  transactionsCategorizationMigrationEnabled: boolean
  transactionsCategorizationRolloutPercent: number
  transactionsCategorizationDisagreementAlertRate: number
  transactionsCategorizationShadowLatencyBudgetMs: number
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
  advisorXSignalsMode: 'off' | 'shadow' | 'enforced'
  knowledgeServiceEnabled: boolean
  knowledgeServiceUrl: string
  knowledgeServiceTimeoutMs: number
  knowledgeGraphMaxContextTokens: number
  knowledgeGraphRetrievalMode: 'hybrid' | 'graph' | 'vector' | 'fulltext'
  knowledgeGraphMaxPathDepth: number
  knowledgeGraphMinConfidence: number
}) => {
  const runtime = createDashboardRouteRuntime({
    db,
    redisClient,
    featureEnabled,
    liveNewsIngestionEnabled,
    transactionsSnapshotStaleAfterMinutes,
    transactionsCategorizationMigrationEnabled,
    transactionsCategorizationRolloutPercent,
    transactionsCategorizationDisagreementAlertRate,
    transactionsCategorizationShadowLatencyBudgetMs,
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
    advisorXSignalsMode,
    knowledgeConfig: {
      enabled: knowledgeServiceEnabled,
      url: knowledgeServiceUrl,
      timeoutMs: knowledgeServiceTimeoutMs,
      maxContextTokens: knowledgeGraphMaxContextTokens,
      retrievalMode: knowledgeGraphRetrievalMode,
      maxPathDepth: knowledgeGraphMaxPathDepth,
      minConfidence: knowledgeGraphMinConfidence,
    },
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
    .use(
      createAdvisorKnowledgeRoute({
        advisorEnabled: aiAdvisorEnabled,
        adminOnly: aiAdvisorAdminOnly,
        knowledgeConfig: {
          enabled: knowledgeServiceEnabled,
          url: knowledgeServiceUrl,
          timeoutMs: knowledgeServiceTimeoutMs,
          maxContextTokens: knowledgeGraphMaxContextTokens,
          retrievalMode: knowledgeGraphRetrievalMode,
          maxPathDepth: knowledgeGraphMaxPathDepth,
          minConfidence: knowledgeGraphMinConfidence,
        },
      })
    )
    .use(createDerivedRecomputeRoute())
    .use(createGoalsRoute())
    .use(createTransactionsRoute())
    .use(createTransactionClassificationRoute())
    .use(createSignalSourcesRoute({ db }))
}
