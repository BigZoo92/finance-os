import {
  createAnthropicMessagesClient,
  createOpenAiResponsesClient,
  type KnowledgeContextBundle,
} from '@finance-os/ai'
import { createExternalInvestmentsRepository } from '@finance-os/external-investments'
import { buildAdvisorKnowledgeContextQuery } from '@finance-os/finance-engine'
import { computeProviderDiagnostics } from '@finance-os/provider-runtime'
import { getAdvisorPostMortemListMock } from '../../mocks/advisorPostMortem.mock'
import { logApiEvent, toErrorLogFields } from '../../observability/logger'
import { createExternalInvestmentsJobQueueRepository } from '../integrations/external-investments/repositories/external-investments-job-queue-repository'
import { createPowensConnectionRepository } from '../integrations/powens/repositories/powens-connection-repository'
import { createPowensJobQueueRepository } from '../integrations/powens/repositories/powens-job-queue-repository'
import {
  type AdvisorKnowledgeContextFetcher,
  createDashboardAdvisorUseCases,
} from './domain/advisor/create-dashboard-advisor-use-cases'
import { createDecisionJournalUseCases } from './domain/advisor/create-decision-journal-use-cases'
import { createAdvisorManualRefreshAndRunUseCases } from './domain/advisor/create-manual-refresh-and-run-use-case'
import { createAdvisorBehaviorAnalyticsUseCase } from './domain/advisor/get-advisor-behavior-analytics'
import { createAdvisorEvalTrendsUseCase } from './domain/advisor/get-advisor-eval-trends'
import { createFineTuningReadinessUseCase } from './domain/advisor/fine-tuning/create-fine-tuning-readiness-use-case'
import { createPostMortemUseCases } from './domain/advisor/post-mortem/create-post-mortem-use-cases'
import { createAdvisorReplayUseCase } from './domain/advisor/replay/create-replay-use-case'
import { createAdvisorV2UseCases } from './domain/advisor/v2/create-advisor-v2-use-cases'
import { createGetDashboardSummaryUseCase } from './domain/create-get-dashboard-summary-use-case'
import { createGetDashboardTransactionsUseCase } from './domain/create-get-dashboard-transactions-use-case'
import { createUpdateTransactionClassificationUseCase } from './domain/create-update-transaction-classification-use-case'
import {
  createArchiveDashboardGoalUseCase,
  createCreateDashboardGoalUseCase,
  createGetDashboardGoalsUseCase,
  createUpdateDashboardGoalUseCase,
} from './domain/dashboard-goals'
import { createDashboardManualAssetUseCases } from './domain/dashboard-manual-assets'
import { createDashboardMarketsUseCases } from './domain/dashboard-markets'
import { createDashboardNewsUseCases } from './domain/dashboard-news'
import { createGetDataQualityUseCase } from './domain/data-quality/create-get-data-quality-use-case'
import {
  createGetDashboardDerivedRecomputeStatusUseCase,
  createRunDashboardDerivedRecomputeUseCase,
} from './domain/derived-recompute'
import { DEFAULT_FAILSOFT_SOURCE_ORDER, type FailsoftSource } from './domain/failsoft-policy'
import { recordCategorizationMigrationSnapshot } from './domain/transaction-categorization-migration-observability'
import { createDashboardAdvisorPostMortemRepository } from './repositories/dashboard-advisor-post-mortem-repository'
import { createDashboardAdvisorRepository } from './repositories/dashboard-advisor-repository'
import { createDashboardDerivedRecomputeRepository } from './repositories/dashboard-derived-recompute-repository'
import { createDashboardMarketsRepository } from './repositories/dashboard-markets-repository'
import { createDashboardNewsRepository } from './repositories/dashboard-news-repository'
import { createDashboardReadRepository } from './repositories/dashboard-read-repository'
import {
  sendDecisionPointToKnowledgeGraph,
  sendPostMortemToKnowledgeGraph,
} from './services/advisor-graph-ingest'
import { createLiveMarketDataRefreshService } from './services/fetch-live-market-data'
import { createLiveNewsIngestionService } from './services/fetch-live-news'
import {
  createKnowledgeServiceClient,
  type KnowledgeServiceClientConfig,
  KnowledgeServiceUnavailableError,
} from './services/knowledge-service-client'
import { createEcbDataNewsProvider } from './services/providers/ecb-data-news-provider'
import { createEcbRssNewsProvider } from './services/providers/ecb-rss-news-provider'
import { createFedRssNewsProvider } from './services/providers/fed-rss-news-provider'
import { createFredNewsProvider } from './services/providers/fred-news-provider'
import { createGdeltNewsProvider } from './services/providers/gdelt-news-provider'
import { createHnNewsProvider } from './services/providers/hn-news-provider'
import { createInternalProviderRegistry } from './services/providers/internal-provider-registry'
import { createSecEdgarNewsProvider } from './services/providers/sec-edgar-news-provider'
import { createXTwitterNewsProvider } from './services/providers/x-twitter-news-provider'
import type { ApiDb, DashboardRouteRuntime, RedisClient } from './types'

export const createDashboardRouteRuntime = ({
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
  aiAdvisorV2Enabled,
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
  aiPostMortemEnabled,
  aiPostMortemHorizonDays,
  aiPostMortemBatchLimit,
  aiPostMortemModel,
  advisorXSignalsMode,
  knowledgeConfig,
  quantServiceEnabled,
  quantServiceUrl,
  quantServiceTimeoutMs,
  advisorGraphIngestEnabled,
  externalInvestmentsEnabled,
  externalInvestmentsSafeMode,
  externalInvestmentsStaleAfterMinutes,
  ibkrFlexEnabled,
  binanceSpotEnabled,
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
  aiAdvisorV2Enabled: boolean
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
  aiPostMortemEnabled: boolean
  aiPostMortemHorizonDays: number
  aiPostMortemBatchLimit: number
  aiPostMortemModel: string
  advisorXSignalsMode: 'off' | 'shadow' | 'enforced'
  knowledgeConfig: KnowledgeServiceClientConfig
  quantServiceEnabled: boolean
  quantServiceUrl: string
  quantServiceTimeoutMs: number
  advisorGraphIngestEnabled: boolean
  externalInvestmentsEnabled: boolean
  externalInvestmentsSafeMode: boolean
  externalInvestmentsStaleAfterMinutes: number
  ibkrFlexEnabled: boolean
  binanceSpotEnabled: boolean
}): DashboardRouteRuntime => {
  const readModel = createDashboardReadRepository({ db })
  const newsRepository = createDashboardNewsRepository({ db })
  const marketsRepository = createDashboardMarketsRepository({ db })
  const advisorRepository = createDashboardAdvisorRepository({ db })
  const derivedRecompute = createDashboardDerivedRecomputeRepository({ db })
  const powensJobs = createPowensJobQueueRepository(redisClient)
  const powensConnections = createPowensConnectionRepository(db, redisClient)
  const externalInvestmentJobs = createExternalInvestmentsJobQueueRepository(redisClient)
  const externalInvestments = createExternalInvestmentsRepository({
    db,
    staleAfterMinutes: externalInvestmentsStaleAfterMinutes,
  })

  // Macro Prompt 4 — closures that produce browser-safe local snapshots for the
  // sensitive provider wrappers. They MUST NOT call Powens / IBKR Flex / Binance and
  // MUST NOT include credentials, tokens, account ids, or raw payloads. Each closure
  // is invoked only when the diagnostics route triggers `refreshProviderHealth`.
  const listPowensProviderSnapshots = async () => {
    const rows = await powensConnections.listConnectionStatuses()
    return rows.map(row => ({
      status: row.status,
      lastSyncStatus:
        row.lastSyncStatus === 'OK' || row.lastSyncStatus === 'KO' ? row.lastSyncStatus : null,
      lastSuccessAt: row.lastSuccessAt,
      lastFailedAt: row.lastFailedAt,
    }))
  }
  const buildExternalInvestmentsSnapshot = async (
    provider: 'ibkr' | 'binance',
    enabledFlag: boolean
  ) => {
    const status = await externalInvestments.getStatus()
    const healthRow = status.health.find(item => item.provider === provider) ?? null
    const connection = status.connections.find(item => item.provider === provider) ?? null
    if (!healthRow && !connection) {
      return null
    }
    return {
      enabled: enabledFlag,
      status: (healthRow?.status ?? 'idle') as 'healthy' | 'degraded' | 'failing' | 'idle',
      lastSuccessAt: healthRow?.lastSuccessAt ?? connection?.lastSuccessAt ?? null,
      lastFailureAt: healthRow?.lastFailureAt ?? connection?.lastFailedAt ?? null,
      credentialConfigured: connection?.credentialStatus === 'configured',
      successCount: healthRow?.successCount ?? 0,
      failureCount: healthRow?.failureCount ?? 0,
    }
  }

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
    categorizationMigration: {
      enabled: transactionsCategorizationMigrationEnabled,
      rolloutPercent: transactionsCategorizationRolloutPercent,
      alertDisagreementRate: transactionsCategorizationDisagreementAlertRate,
      shadowLatencyBudgetMs: transactionsCategorizationShadowLatencyBudgetMs,
    },
    onCategorizationMigrationEvaluated: recordCategorizationMigrationSnapshot,
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

  const newsAdapters = [
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
    createXTwitterNewsProvider({
      enabled: newsProviderXTwitterEnabled,
      query: newsProviderXTwitterQuery,
      bearerToken: newsProviderXTwitterBearerToken,
    }),
  ]

  const liveNewsIngestion = createLiveNewsIngestionService({
    repository: newsRepository,
    providers: newsAdapters,
    maxItemsPerProvider: maxNewsItemsPerProvider,
    metadataFetchEnabled,
    metadataFetchTimeoutMs,
    metadataFetchMaxBytes,
    metadataUserAgent: metadataFetchUserAgent,
  })

  // Macro Prompt 3 — internal provider registry for `/dashboard/providers/diagnostics`.
  // Mounts the migrated wrappers (knowledge-service, quant-service, news-service). Only
  // `quant-service` is consumed by a production route today; the others are surfaced via
  // the diagnostics endpoint's `getHealth()` snapshots only.
  // Macro Prompt 4 — also mounts the health-only Powens / IBKR / Binance wrappers; their
  // `call()` paths return `unsupported_capability` (deferred read routing).
  const internalProviderRegistry = createInternalProviderRegistry({
    knowledge: { config: knowledgeConfig },
    quantPatterns: {
      config: {
        enabled: quantServiceEnabled,
        url: quantServiceUrl,
        timeoutMs: quantServiceTimeoutMs,
      },
    },
    news: {
      adapters: newsAdapters,
      defaultMaxItems: maxNewsItemsPerProvider,
    },
    powens: {
      listConnectionStatuses: listPowensProviderSnapshots,
    },
    ibkr: {
      getProviderSnapshot: () => buildExternalInvestmentsSnapshot('ibkr', ibkrFlexEnabled),
    },
    binance: {
      getProviderSnapshot: () => buildExternalInvestmentsSnapshot('binance', binanceSpotEnabled),
    },
    logTarget: { logEvent: logApiEvent },
  })
  const providerRegistry = internalProviderRegistry.registry
  const refreshProviderHealth = internalProviderRegistry.refreshSensitiveProviderHealth

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

  const knowledgeClient = createKnowledgeServiceClient(knowledgeConfig)

  const getKnowledgeContextBundle: AdvisorKnowledgeContextFetcher = async ({
    requestId,
    mode,
    snapshot,
    recommendations,
    advisorTask,
  }) => {
    if (!knowledgeConfig.enabled || mode === 'demo') {
      return null
    }
    const hint = buildAdvisorKnowledgeContextQuery({ snapshot, recommendations })
    try {
      const raw = await knowledgeClient.contextBundle(
        {
          query: hint.query,
          mode,
          maxResults: hint.maxResults,
          maxPathDepth: hint.maxPathDepth,
          retrievalMode: knowledgeConfig.retrievalMode,
          includeContradictions: true,
          includeEvidence: true,
          maxTokens: knowledgeConfig.maxContextTokens,
          advisorTask,
          filters: { tags: hint.tags },
        },
        requestId
      )
      return raw as unknown as KnowledgeContextBundle
    } catch (error) {
      logApiEvent({
        level: 'warn',
        msg: 'advisor knowledge context fetch failed',
        requestId,
        advisor_task: advisorTask,
        knowledge_service_unavailable: error instanceof KnowledgeServiceUnavailableError,
        ...toErrorLogFields({ error, includeStack: false }),
      })
      return null
    }
  }

  const advisor = createDashboardAdvisorUseCases({
    repository: advisorRepository,
    getSummary,
    getGoals,
    getNewsContextBundle: news.getNewsContextBundle,
    getInvestmentContextBundle: async () =>
      (await externalInvestments.getLatestContextBundle())?.bundle ?? null,
    getTransactions,
    getKnowledgeContextBundle,
    config: {
      advisorEnabled: aiAdvisorEnabled,
      adminOnly: aiAdvisorAdminOnly,
      forceLocalOnly: aiAdvisorForceLocalOnly,
      knowledgeRetrievalEnabled: aiKnowledgeQaRetrievalEnabled,
      chatEnabled: aiChatEnabled,
      challengerEnabled: aiChallengerEnabled,
      relabelEnabled: aiRelabelEnabled,
      dailyBudgetUsd: aiBudgetDailyUsd,
      monthlyBudgetUsd: aiBudgetMonthlyUsd,
      challengerDisableRatio: aiBudgetDisableChallengerRatio,
      deepAnalysisDisableRatio: aiBudgetDisableDeepAnalysisRatio,
      maxChatMessagesContext: aiMaxChatMessagesContext,
      usdToEurRate: aiUsdToEurRate,
      xSignalsMode: advisorXSignalsMode,
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

  // PR9 — Advisor Eval Trends. Read-only; no LLM, provider, graph, or knowledge-service call.
  const advisorEvalTrends = createAdvisorEvalTrendsUseCase({ repository: advisorRepository })

  // PR15A — Advisor Behavior Analytics. Read-only; freeNote-free read helper; no LLM,
  // provider, graph, or knowledge-service call.
  const advisorBehaviorAnalytics = createAdvisorBehaviorAnalyticsUseCase({
    repository: advisorRepository,
  })

  // PR8 — Advisor Learning Loop graph ingest hooks. Both hooks are fail-soft;
  // if KNOWLEDGE_SERVICE_ENABLED or ADVISOR_GRAPH_INGEST_ENABLED is false, the
  // adapter short-circuits with `ok=false` and never touches the network.
  const advisorDecisionJournal = createDecisionJournalUseCases({
    repository: advisorRepository,
    graphIngest: {
      ingestDecisionPoint: async ({ entry, requestId }) => {
        const result = await sendDecisionPointToKnowledgeGraph({
          knowledgeServiceUrl: knowledgeConfig.url,
          knowledgeServiceEnabled: knowledgeConfig.enabled,
          ingestEnabled: advisorGraphIngestEnabled,
          requestId,
          input: {
            decisionId: entry.id,
            decision: entry.decision,
            reasonCode: entry.reasonCode,
            decidedAt: entry.decidedAt,
            decidedBy: entry.decidedBy,
            expectedOutcomeAt: entry.expectedOutcomeAt,
            recommendationId: entry.recommendationId,
            recommendationKey: entry.recommendationKey,
            runId: entry.runId,
            freeNote: entry.freeNote,
          },
          timeoutMs: knowledgeConfig.timeoutMs,
        })
        if (!result.ok && result.reason && !result.reason.includes('disabled')) {
          logApiEvent({
            level: 'warn',
            msg: 'advisor decision point graph ingest skipped',
            requestId,
            reason: result.reason,
          })
        }
      },
    },
  })

  // PR4 — Advisor Post-Mortem.
  // Build the use-case lazily-resolved provider/budget so that demo or feature-flag-off code
  // paths NEVER touch the LLM client construction. The runner is only built on demand inside
  // the use-case factory's runStructured shim below.
  const advisorPostMortemRepository = createDashboardAdvisorPostMortemRepository({ db })

  const buildPostMortemRunner = () => {
    if (aiAnthropicApiKey) {
      return createAnthropicMessagesClient({
        apiKey: aiAnthropicApiKey,
        ...(aiAnthropicBaseUrl ? { baseUrl: aiAnthropicBaseUrl } : {}),
        usdToEurRate: aiUsdToEurRate,
      })
    }
    if (aiOpenAiApiKey) {
      return createOpenAiResponsesClient({
        apiKey: aiOpenAiApiKey,
        ...(aiOpenAiBaseUrl ? { baseUrl: aiOpenAiBaseUrl } : {}),
        usdToEurRate: aiUsdToEurRate,
      })
    }
    return null
  }

  const advisorPostMortem = createPostMortemUseCases({
    repository: advisorPostMortemRepository,
    runner: {
      runStructured: async request => {
        const client = buildPostMortemRunner()
        if (!client) {
          throw new Error('No LLM provider client configured for post-mortem.')
        }
        return client.runStructured(request)
      },
    },
    budget: {
      fetchBudgetState: async () => {
        const overview = await advisorRepository.getAdvisorOverview({
          dailyBudgetUsd: aiBudgetDailyUsd,
          monthlyBudgetUsd: aiBudgetMonthlyUsd,
          challengerDisableRatio: aiBudgetDisableChallengerRatio,
          deepAnalysisDisableRatio: aiBudgetDisableDeepAnalysisRatio,
          chatEnabled: aiChatEnabled,
        })
        // The overview returns a `spend` field with the budget state shape. If the overview is
        // unavailable (no run yet), fall back to a synthetic state computed from configured
        // budgets so post-mortem can still run from a fresh deployment.
        if (overview?.spend) {
          return {
            dailyUsdSpent: overview.spend.dailyUsdSpent,
            monthlyUsdSpent: overview.spend.monthlyUsdSpent,
            dailyBudgetUsd: overview.spend.dailyBudgetUsd,
            monthlyBudgetUsd: overview.spend.monthlyBudgetUsd,
            challengerAllowed: overview.spend.challengerAllowed,
            deepAnalysisAllowed: overview.spend.deepAnalysisAllowed,
            blocked: overview.spend.blocked,
            reasons: [...overview.spend.reasons],
          }
        }
        return {
          dailyUsdSpent: 0,
          monthlyUsdSpent: 0,
          dailyBudgetUsd: aiBudgetDailyUsd,
          monthlyBudgetUsd: aiBudgetMonthlyUsd,
          challengerAllowed: true,
          deepAnalysisAllowed: aiBudgetDailyUsd > 0 && aiBudgetMonthlyUsd > 0,
          blocked: aiBudgetDailyUsd <= 0 || aiBudgetMonthlyUsd <= 0,
          reasons: [],
        }
      },
    },
    config: {
      enabled: aiPostMortemEnabled,
      horizonDays: aiPostMortemHorizonDays,
      batchLimit: aiPostMortemBatchLimit,
      model: aiPostMortemModel,
      feature: 'post_mortem',
    },
    demoFixtures: { list: getAdvisorPostMortemListMock().items },
    graphIngest: {
      ingestPostMortemActions: async ({ persistedRow, context, parsed, requestId }) => {
        if (parsed.learningActions.length === 0) return
        const overall = parsed.overallOutcome
        const status: 'validates_recommendation' | 'invalidates_recommendation' | 'neutral' =
          overall === 'positive'
            ? 'validates_recommendation'
            : overall === 'negative'
              ? 'invalidates_recommendation'
              : 'neutral'
        const result = await sendPostMortemToKnowledgeGraph({
          knowledgeServiceUrl: knowledgeConfig.url,
          knowledgeServiceEnabled: knowledgeConfig.enabled,
          ingestEnabled: advisorGraphIngestEnabled,
          requestId,
          actions: parsed.learningActions.map((action, index) => ({
            postMortemId: persistedRow.id,
            actionIndex: index,
            title: action.title,
            description: action.description,
            appliesTo: [...action.appliesTo],
            status,
            confidence: 0.6,
            recommendationId: context.recommendationId,
            recommendationKey: context.recommendationKey,
            decisionId: context.decisionId,
            runId: context.runId,
            evaluatedAt: persistedRow.evaluatedAt,
          })),
          timeoutMs: knowledgeConfig.timeoutMs,
        })
        if (!result.ok && result.reason && !result.reason.includes('disabled')) {
          logApiEvent({
            level: 'warn',
            msg: 'advisor post-mortem graph ingest skipped',
            requestId,
            reason: result.reason,
          })
        }
      },
    },
  })

  // Macro Prompt 5 — Data quality + advisor readiness use-case. Read-only over
  // already-cached state. NO provider call, NO LLM, NO graph call, NO sync trigger.
  const getDataQuality = createGetDataQualityUseCase({
    now: () => new Date(),
    buildSnapshot: async () => {
      const [
        powensConnectionStatuses,
        externalInvestmentsStatus,
        marketCacheState,
        newsCacheState,
        latestEvalRun,
        latestPostMortems,
      ] = await Promise.all([
        powensConnections.listConnectionStatuses(),
        externalInvestments.getStatus(),
        marketsRepository.getMarketCacheState(),
        newsRepository.getNewsCacheState(),
        advisorRepository.getLatestEvalRun(),
        advisorPostMortemRepository.listPostMortems({ limit: 1 }),
      ])

      // Compute provider diagnostics in admin mode WITHOUT triggering refresh.
      // Refresh is the diagnostics-route's responsibility. Here we read whatever
      // health snapshots are already cached on the registry.
      const providerDiagnostics = computeProviderDiagnostics({
        registry: providerRegistry,
        context: {
          mode: 'admin',
          requestId: 'dashboard.data-quality.snapshot',
          now: new Date(),
          reason: 'route:dashboard.data-quality',
        },
      })

      const ibkrConnection =
        externalInvestmentsStatus.connections.find(c => c.provider === 'ibkr') ?? null
      const binanceConnection =
        externalInvestmentsStatus.connections.find(c => c.provider === 'binance') ?? null
      const ibkrHealth = externalInvestmentsStatus.health.find(h => h.provider === 'ibkr') ?? null
      const binanceHealth =
        externalInvestmentsStatus.health.find(h => h.provider === 'binance') ?? null

      const latestPostMortem = latestPostMortems.items[0] ?? null

      return {
        providerDiagnostics,
        banking: {
          powensConfigured: powensConnectionStatuses.length > 0,
          connections: powensConnectionStatuses.map(row => ({
            status: row.status,
            lastSyncStatus: row.lastSyncStatus,
            lastSuccessAt: row.lastSuccessAt,
            lastFailedAt: row.lastFailedAt,
          })),
        },
        externalInvestments: {
          enabled: externalInvestmentsEnabled,
          safeMode: externalInvestmentsSafeMode,
          ibkrEnabledByFlag: ibkrFlexEnabled,
          binanceEnabledByFlag: binanceSpotEnabled,
          health: [
            ...(ibkrHealth
              ? [
                  {
                    provider: 'ibkr' as const,
                    enabled: ibkrHealth.enabled,
                    status: ibkrHealth.status,
                    lastSuccessAt: ibkrHealth.lastSuccessAt,
                    lastFailureAt: ibkrHealth.lastFailureAt,
                  },
                ]
              : []),
            ...(binanceHealth
              ? [
                  {
                    provider: 'binance' as const,
                    enabled: binanceHealth.enabled,
                    status: binanceHealth.status,
                    lastSuccessAt: binanceHealth.lastSuccessAt,
                    lastFailureAt: binanceHealth.lastFailureAt,
                  },
                ]
              : []),
          ],
          connections: [
            ...(ibkrConnection
              ? [
                  {
                    provider: 'ibkr' as const,
                    credentialStatus: ibkrConnection.credentialStatus,
                    lastSuccessAt: ibkrConnection.lastSuccessAt,
                    lastFailedAt: ibkrConnection.lastFailedAt,
                  },
                ]
              : []),
            ...(binanceConnection
              ? [
                  {
                    provider: 'binance' as const,
                    credentialStatus: binanceConnection.credentialStatus,
                    lastSuccessAt: binanceConnection.lastSuccessAt,
                    lastFailedAt: binanceConnection.lastFailedAt,
                  },
                ]
              : []),
          ],
        },
        marketData: {
          featureEnabled: marketDataEnabled,
          cacheState: marketCacheState
            ? {
                lastSuccessAt: marketCacheState.lastSuccessAt,
                lastFailureAt: marketCacheState.lastFailureAt,
              }
            : null,
        },
        news: {
          liveIngestionEnabled: liveNewsIngestionEnabled,
          cacheState: newsCacheState
            ? {
                lastSuccessAt: newsCacheState.lastSuccessAt,
                lastFailureAt: newsCacheState.lastFailureAt,
              }
            : null,
        },
        advisorMemory: {
          knowledgeServiceEnabled: knowledgeConfig.enabled,
        },
        evals: {
          latestRun: latestEvalRun
            ? {
                status: latestEvalRun.status,
                createdAt: latestEvalRun.createdAt,
                totalCases: latestEvalRun.totalCases,
                passedCases: latestEvalRun.passedCases,
                failedCases: latestEvalRun.failedCases,
              }
            : null,
        },
        postMortems: {
          enabled: aiPostMortemEnabled,
          latest: latestPostMortem
            ? {
                latestEvaluatedAt: latestPostMortem.evaluatedAt,
                status: latestPostMortem.status,
              }
            : null,
        },
      }
    },
  })

  // Macro Prompt 6 — Advisor v2 deterministic preview (default-off, no LLM,
  // no provider, no graph, no DB write). The factory composes existing
  // read-only use-cases; it never persists recommendations.
  const advisorV2 = createAdvisorV2UseCases({
    v2Enabled: aiAdvisorV2Enabled,
    now: () => new Date(),
    getDataQuality: async ({ mode, requestId }) => getDataQuality({ mode, requestId }),
    getRecommendations: async ({ mode, requestId, limit }) =>
      advisor.getAdvisorRecommendations({ mode, requestId, limit }),
    listPostMortems: async ({ mode, requestId, limit }) =>
      advisorPostMortem.listPostMortems({ mode, requestId, limit }),
    listDecisionJournal: async ({ mode, requestId, limit }) =>
      advisorDecisionJournal.listAdvisorDecisionJournal({ mode, requestId, limit }),
  })

  // Macro Prompt 6 — Advisor replay. Read-only deterministic review.
  const advisorReplay = createAdvisorReplayUseCase({
    now: () => new Date(),
    getDataQuality: async ({ mode, requestId }) => getDataQuality({ mode, requestId }),
    getRecommendations: async ({ mode, requestId, limit }) =>
      advisor.getAdvisorRecommendations({ mode, requestId, limit }),
    listDecisionJournal: async ({ mode, requestId, limit }) =>
      advisorDecisionJournal.listAdvisorDecisionJournal({ mode, requestId, limit }),
    listPostMortems: async ({ mode, requestId, limit }) =>
      advisorPostMortem.listPostMortems({ mode, requestId, limit }),
    getLatestEvalRun: async () => advisorRepository.getLatestEvalRun(),
  })

  // Macro Prompt 6 — Fine-tuning readiness gate. Conservative defaults.
  const advisorFineTuningReadiness = createFineTuningReadinessUseCase({
    now: () => new Date(),
    getDataQuality: async ({ mode, requestId }) => getDataQuality({ mode, requestId }),
    listDecisionJournal: async ({ mode, requestId, limit }) =>
      advisorDecisionJournal.listAdvisorDecisionJournal({ mode, requestId, limit }),
    listPostMortems: async ({ mode, requestId, limit }) =>
      advisorPostMortem.listPostMortems({ mode, requestId, limit }),
    getLatestEvalRun: async () => advisorRepository.getLatestEvalRun(),
  })

  const manualAdvisorOrchestration = createAdvisorManualRefreshAndRunUseCases({
    repository: advisorRepository,
    readModel,
    newsRepository,
    marketsRepository,
    enqueueAllConnectionsSync: powensJobs.enqueueAllConnectionsSync,
    enqueueExternalInvestmentProviderSync: async ({ provider, requestId }) =>
      externalInvestmentJobs.enqueueProviderSync({
        provider,
        ...(requestId ? { requestId } : {}),
      }),
    getExternalInvestmentStatus: () => externalInvestments.getStatus(),
    generateExternalInvestmentContextBundle: ({ requestId }) =>
      externalInvestments.generateContextBundle({ requestId }),
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
      getExternalInvestmentsSummary: async ({ requestId }) => {
        const [status, latestBundle, positions] = await Promise.all([
          externalInvestments.getStatus(),
          externalInvestments.getLatestContextBundle(),
          externalInvestments.listPositions(),
        ])

        return {
          requestId,
          source: 'cache' as const,
          enabled: externalInvestmentsEnabled,
          safeModeActive: externalInvestmentsSafeMode,
          providerEnabled: {
            ibkr: ibkrFlexEnabled,
            binance: binanceSpotEnabled,
          },
          generatedAt: latestBundle?.generatedAt ?? null,
          dataStatus: latestBundle
            ? {
                status: 'ready' as const,
                message: null,
              }
            : {
                status: positions.length > 0 ? 'degraded' : 'empty',
                message:
                  positions.length > 0
                    ? 'No persisted Advisor investment bundle is available yet.'
                    : 'No external investment snapshot has been imported yet.',
              },
          status,
          bundle: latestBundle?.bundle ?? null,
          latestBundleMeta: latestBundle
            ? {
                schemaVersion: latestBundle.schemaVersion,
                generatedAt: latestBundle.generatedAt,
                requestId: latestBundle.requestId,
                staleAfterMinutes: latestBundle.staleAfterMinutes,
                updatedAt: latestBundle.updatedAt,
              }
            : null,
          positionCount: positions.length,
        }
      },
      getExternalInvestmentsAccounts: async ({ requestId }) => ({
        requestId,
        source: 'cache' as const,
        items: await externalInvestments.listAccounts(),
      }),
      getExternalInvestmentsPositions: async ({ requestId }) => ({
        requestId,
        source: 'cache' as const,
        items: await externalInvestments.listPositions(),
      }),
      getExternalInvestmentsTrades: async ({ requestId, limit = 50 }) => ({
        requestId,
        source: 'cache' as const,
        items: await externalInvestments.listTrades(limit),
      }),
      getExternalInvestmentsCashFlows: async ({ requestId, limit = 50 }) => ({
        requestId,
        source: 'cache' as const,
        items: await externalInvestments.listCashFlows(limit),
      }),
      getExternalInvestmentsContextBundle: async ({ requestId }) => ({
        requestId,
        source: 'cache' as const,
        item: await externalInvestments.getLatestContextBundle(),
      }),
      triggerExternalInvestmentProviderSync: async ({ provider, requestId }) =>
        externalInvestmentJobs.enqueueProviderSync({
          provider,
          requestId,
        }),
      generateExternalInvestmentContextBundle: ({ requestId }) =>
        externalInvestments.generateContextBundle({ requestId }),
      getAdvisorOverview: advisor.getAdvisorOverview,
      getAdvisorDailyBrief: advisor.getAdvisorDailyBrief,
      getAdvisorRecommendations: advisor.getAdvisorRecommendations,
      getAdvisorRuns: advisor.getAdvisorRuns,
      getAdvisorAssumptions: advisor.getAdvisorAssumptions,
      getAdvisorSignals: advisor.getAdvisorSignals,
      getAdvisorSpend: advisor.getAdvisorSpend,
      getAdvisorKnowledgeTopics: advisor.getAdvisorKnowledgeTopics,
      getAdvisorKnowledgeAnswer: advisor.getAdvisorKnowledgeAnswer,
      runAdvisorDaily: advisor.runAdvisorDaily,
      getLatestAdvisorManualOperation: async () =>
        manualAdvisorOrchestration.getLatestManualOperation(),
      listAdvisorManualOperations: async ({ limit }) =>
        manualAdvisorOrchestration.listManualOperations(limit),
      getAdvisorManualOperationById: async ({ operationId }) =>
        manualAdvisorOrchestration.getManualOperationById(operationId),
      runAdvisorManualRefreshAndAnalysis: async ({ requestId, triggerSource }) =>
        manualAdvisorOrchestration.startManualRefreshAndRun({
          requestId,
          triggerSource,
        }),
      recoverStaleAdvisorManualOperations: async ({ staleAfterMs }) =>
        advisorRepository.recoverStaleManualOperations({ staleAfterMs }),
      cancelAdvisorManualOperation: async ({ operationId }) =>
        advisorRepository.cancelManualOperation({ operationId }),
      relabelAdvisorTransactions: advisor.relabelAdvisorTransactions,
      getAdvisorChat: advisor.getAdvisorChat,
      postAdvisorChat: advisor.postAdvisorChat,
      getAdvisorEvals: advisor.getAdvisorEvals,
      getAdvisorEvalsTrends: advisorEvalTrends.getAdvisorEvalsTrends,
      getAdvisorBehaviorAnalytics: advisorBehaviorAnalytics.getAdvisorBehaviorAnalytics,
      listAdvisorDecisionJournal: advisorDecisionJournal.listAdvisorDecisionJournal,
      getAdvisorDecisionJournalEntry: advisorDecisionJournal.getAdvisorDecisionJournalEntry,
      createAdvisorDecisionJournalEntry: advisorDecisionJournal.createAdvisorDecisionJournalEntry,
      createAdvisorDecisionOutcome: advisorDecisionJournal.createAdvisorDecisionOutcome,
      listAdvisorPostMortems: advisorPostMortem.listPostMortems,
      getAdvisorPostMortemById: advisorPostMortem.getPostMortemById,
      runAdvisorPostMortem: advisorPostMortem.runPostMortem,
      getDataQuality,
      getAdvisorV2Capabilities: advisorV2.getCapabilities,
      buildAdvisorV2Preview: advisorV2.buildPreview,
      getAdvisorReplay: advisorReplay.getAdvisorReplay,
      getAdvisorFineTuningReadiness: advisorFineTuningReadiness.getAdvisorFineTuningReadiness,
    },
    providerRegistry,
    refreshProviderHealth,
  }
}
