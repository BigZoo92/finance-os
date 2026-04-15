import {
  createArchiveDashboardGoalUseCase,
  createCreateDashboardGoalUseCase,
  createGetDashboardGoalsUseCase,
  createUpdateDashboardGoalUseCase,
} from './domain/dashboard-goals'
import { createDashboardManualAssetUseCases } from './domain/dashboard-manual-assets'
import {
  createGetDashboardDerivedRecomputeStatusUseCase,
  createRunDashboardDerivedRecomputeUseCase,
} from './domain/derived-recompute'
import { createDashboardAdvisorUseCases } from './domain/advisor/create-dashboard-advisor-use-cases'
import { createAdvisorManualRefreshAndRunUseCases } from './domain/advisor/create-manual-refresh-and-run-use-case'
import { createGetDashboardSummaryUseCase } from './domain/create-get-dashboard-summary-use-case'
import { createDashboardNewsUseCases } from './domain/dashboard-news'
import { createDashboardMarketsUseCases } from './domain/dashboard-markets'
import { DEFAULT_FAILSOFT_SOURCE_ORDER, type FailsoftSource } from './domain/failsoft-policy'
import { createGetDashboardTransactionsUseCase } from './domain/create-get-dashboard-transactions-use-case'
import { createUpdateTransactionClassificationUseCase } from './domain/create-update-transaction-classification-use-case'
import { createDashboardAdvisorRepository } from './repositories/dashboard-advisor-repository'
import { createDashboardDerivedRecomputeRepository } from './repositories/dashboard-derived-recompute-repository'
import { createDashboardMarketsRepository } from './repositories/dashboard-markets-repository'
import { createDashboardNewsRepository } from './repositories/dashboard-news-repository'
import { createDashboardReadRepository } from './repositories/dashboard-read-repository'
import { createLiveMarketDataRefreshService } from './services/fetch-live-market-data'
import { createLiveNewsIngestionService } from './services/fetch-live-news'
import { createEcbDataNewsProvider } from './services/providers/ecb-data-news-provider'
import { createEcbRssNewsProvider } from './services/providers/ecb-rss-news-provider'
import { createFedRssNewsProvider } from './services/providers/fed-rss-news-provider'
import { createFredNewsProvider } from './services/providers/fred-news-provider'
import { createGdeltNewsProvider } from './services/providers/gdelt-news-provider'
import { createHnNewsProvider } from './services/providers/hn-news-provider'
import { createSecEdgarNewsProvider } from './services/providers/sec-edgar-news-provider'
import { createPowensJobQueueRepository } from '../integrations/powens/repositories/powens-job-queue-repository'
import type { ApiDb, DashboardRouteRuntime, RedisClient } from './types'

export const createDashboardRouteRuntime = ({
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
  aiAdvisorEnabled,
  aiAdvisorAdminOnly,
  aiAdvisorForceLocalOnly,
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
  marketDataEnabled: boolean
  marketDataRefreshEnabled: boolean
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
}): DashboardRouteRuntime => {
  const readModel = createDashboardReadRepository({ db })
  const newsRepository = createDashboardNewsRepository({ db })
  const marketsRepository = createDashboardMarketsRepository({ db })
  const advisorRepository = createDashboardAdvisorRepository({ db })
  const derivedRecompute = createDashboardDerivedRecomputeRepository({ db })
  const powensJobs = createPowensJobQueueRepository(redisClient)

  const getSummary = createGetDashboardSummaryUseCase({
    listAccountsWithConnections: readModel.listAccountsWithConnections,
    listAssets: readModel.listAssets,
    listInvestmentPositions: readModel.listInvestmentPositions,
    getFlowTotals: readModel.getFlowTotals,
    listDailyNetFlows: readModel.listDailyNetFlows,
    listTopExpenseGroups: readModel.listTopExpenseGroups,
  })

  const getTransactions = createGetDashboardTransactionsUseCase({
    listTransactions: readModel.listTransactions,
    listTransactionSyncMetadata: readModel.listTransactionSyncMetadata,
    now: () => new Date(),
    staleAfterMinutes: transactionsSnapshotStaleAfterMinutes,
  })
  const requestTransactionsBackgroundRefresh: DashboardRouteRuntime['useCases']['requestTransactionsBackgroundRefresh'] =
    async ({ requestId }) => {
      const dedupeKey = 'powens:dashboard:transactions:background-refresh'
      const dedupeResult = await redisClient.set(dedupeKey, requestId, {
        NX: true,
        EX: 120,
      })
      if (dedupeResult !== 'OK') {
        return false
      }
      await powensJobs.enqueueAllConnectionsSync({ requestId })
      return true
    }
  const updateTransactionClassification = createUpdateTransactionClassificationUseCase({
    updateTransactionClassification: readModel.updateTransactionClassification,
  })
  const getGoals = createGetDashboardGoalsUseCase({
    listGoals: readModel.listGoals,
  })
  const manualAssets = createDashboardManualAssetUseCases({
    repository: readModel,
  })
  const createGoal = createCreateDashboardGoalUseCase({
    createGoal: readModel.createGoal,
  })
  const updateGoal = createUpdateDashboardGoalUseCase({
    getGoalById: readModel.getGoalById,
    updateGoal: readModel.updateGoal,
  })
  const archiveGoal = createArchiveDashboardGoalUseCase({
    archiveGoal: readModel.archiveGoal,
  })
  const getDerivedRecomputeStatus = createGetDashboardDerivedRecomputeStatusUseCase({
    featureEnabled,
    repository: derivedRecompute,
  })
  const runDerivedRecompute = createRunDashboardDerivedRecomputeUseCase({
    featureEnabled,
    repository: derivedRecompute,
  })

  const liveNewsIngestion = createLiveNewsIngestionService({
    repository: newsRepository,
    providers: [
      createHnNewsProvider({
        enabled: newsProviderHnEnabled,
        query: newsProviderHnQuery,
      }),
      createGdeltNewsProvider({
        enabled: newsProviderGdeltEnabled,
        query: newsProviderGdeltQuery,
      }),
      createEcbRssNewsProvider({
        enabled: newsProviderEcbRssEnabled,
        feedUrls: newsProviderEcbRssFeedUrls,
      }),
      createEcbDataNewsProvider({
        enabled: newsProviderEcbDataEnabled,
        seriesKeys: newsProviderEcbDataSeriesKeys,
      }),
      createFedRssNewsProvider({
        enabled: newsProviderFedEnabled,
        feedUrls: newsProviderFedFeedUrls,
      }),
      createSecEdgarNewsProvider({
        enabled: newsProviderSecEnabled,
        userAgent: newsProviderSecUserAgent,
        watchlistTickers: newsProviderSecTickers,
      }),
      createFredNewsProvider({
        enabled: newsProviderFredEnabled,
        apiKey: newsProviderFredApiKey,
        seriesIds: newsProviderFredSeriesIds,
      }),
    ],
    maxItemsPerProvider: maxNewsItemsPerProvider,
    metadataFetchEnabled,
    metadataFetchTimeoutMs,
    metadataFetchMaxBytes,
    metadataUserAgent: metadataFetchUserAgent,
  })

  const news = createDashboardNewsUseCases({
    repository: newsRepository,
    runLiveIngestion: liveNewsIngestion.run,
    liveIngestionEnabled: liveNewsIngestionEnabled,
    failsoftPolicyEnabled,
    failsoftSourceOrder:
      failsoftSourceOrder.length > 0 ? failsoftSourceOrder : DEFAULT_FAILSOFT_SOURCE_ORDER,
    failsoftNewsEnabled,
    aiContextBundleEnabled,
  })

  const marketRefresh = createLiveMarketDataRefreshService({
    marketDataEodhdEnabled,
    marketDataTwelveDataEnabled,
    marketDataFredEnabled,
    marketDataUsFreshOverlayEnabled,
    eodhdApiKey,
    twelveDataApiKey,
    fredApiKey: newsProviderFredApiKey,
  })

  const markets = createDashboardMarketsUseCases({
    repository: marketsRepository,
    runLiveRefresh: marketRefresh.run,
    marketDataEnabled,
    marketDataRefreshEnabled,
    staleAfterMinutes: marketDataStaleAfterMinutes,
    defaultWatchlistIds: marketDataDefaultWatchlistIds,
    fredSeriesIds: marketDataFredSeriesIds,
    providerEnabledMap: {
      eodhd: marketDataEodhdEnabled,
      twelve_data: marketDataTwelveDataEnabled && marketDataUsFreshOverlayEnabled,
      fred: marketDataFredEnabled,
    },
  })

  const advisor = createDashboardAdvisorUseCases({
    repository: advisorRepository,
    getSummary,
    getGoals,
    getNewsContextBundle: news.getNewsContextBundle,
    getTransactions,
    config: {
      advisorEnabled: aiAdvisorEnabled,
      adminOnly: aiAdvisorAdminOnly,
      forceLocalOnly: aiAdvisorForceLocalOnly,
      chatEnabled: aiChatEnabled,
      challengerEnabled: aiChallengerEnabled,
      relabelEnabled: aiRelabelEnabled,
      dailyBudgetUsd: aiBudgetDailyUsd,
      monthlyBudgetUsd: aiBudgetMonthlyUsd,
      challengerDisableRatio: aiBudgetDisableChallengerRatio,
      deepAnalysisDisableRatio: aiBudgetDisableDeepAnalysisRatio,
      maxChatMessagesContext: aiMaxChatMessagesContext,
      usdToEurRate: aiUsdToEurRate,
      openAi: aiOpenAiApiKey
        ? {
            apiKey: aiOpenAiApiKey,
            ...(aiOpenAiBaseUrl ? { baseUrl: aiOpenAiBaseUrl } : {}),
            classifierModel: aiOpenAiClassifierModel,
            dailyModel: aiOpenAiDailyModel,
            deepModel: aiOpenAiDeepModel,
          }
        : null,
      anthropic: aiAnthropicApiKey
        ? {
            apiKey: aiAnthropicApiKey,
            ...(aiAnthropicBaseUrl ? { baseUrl: aiAnthropicBaseUrl } : {}),
            challengerModel: aiAnthropicChallengerModel,
          }
        : null,
    },
  })

  const manualAdvisorOrchestration = createAdvisorManualRefreshAndRunUseCases({
    repository: advisorRepository,
    readModel,
    newsRepository,
    marketsRepository,
    enqueueAllConnectionsSync: powensJobs.enqueueAllConnectionsSync,
    ingestNews: news.ingestNews,
    refreshMarkets: markets.refreshMarkets,
    runAdvisorDaily: advisor.runAdvisorDaily,
    redisClient,
  })

  return {
    repositories: {
      readModel,
      news: newsRepository,
      markets: marketsRepository,
      advisor: advisorRepository,
      derivedRecompute,
    },
    useCases: {
      getSummary,
      getManualAssets: async () => manualAssets.getManualAssets(),
      createManualAsset: async input => manualAssets.createManualAsset(input),
      updateManualAsset: async (assetId, input) => manualAssets.updateManualAsset(assetId, input),
      deleteManualAsset: async assetId => manualAssets.deleteManualAsset(assetId),
      getTransactions,
      requestTransactionsBackgroundRefresh,
      updateTransactionClassification,
      getGoals,
      createGoal,
      updateGoal,
      archiveGoal,
      getDerivedRecomputeStatus,
      runDerivedRecompute,
      getNews: news.getNews,
      getNewsContextBundle: news.getNewsContextBundle,
      ingestNews: news.ingestNews,
      getMarketsOverview: markets.getOverview,
      getMarketsWatchlist: markets.getWatchlist,
      getMarketsMacro: markets.getMacro,
      getMarketsContextBundle: markets.getContextBundle,
      refreshMarkets: markets.refreshMarkets,
      getAdvisorOverview: advisor.getAdvisorOverview,
      getAdvisorDailyBrief: advisor.getAdvisorDailyBrief,
      getAdvisorRecommendations: advisor.getAdvisorRecommendations,
      getAdvisorRuns: advisor.getAdvisorRuns,
      getAdvisorAssumptions: advisor.getAdvisorAssumptions,
      getAdvisorSignals: advisor.getAdvisorSignals,
      getAdvisorSpend: advisor.getAdvisorSpend,
      runAdvisorDaily: advisor.runAdvisorDaily,
      getLatestAdvisorManualOperation: async () =>
        manualAdvisorOrchestration.getLatestManualOperation(),
      getAdvisorManualOperationById: async ({ operationId }) =>
        manualAdvisorOrchestration.getManualOperationById(operationId),
      runAdvisorManualRefreshAndAnalysis: async ({ requestId, triggerSource }) =>
        manualAdvisorOrchestration.startManualRefreshAndRun({
          requestId,
          triggerSource,
        }),
      relabelAdvisorTransactions: advisor.relabelAdvisorTransactions,
      getAdvisorChat: advisor.getAdvisorChat,
      postAdvisorChat: advisor.postAdvisorChat,
      getAdvisorEvals: advisor.getAdvisorEvals,
    },
  }
}
