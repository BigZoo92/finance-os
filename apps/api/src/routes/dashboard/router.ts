import { Elysia } from 'elysia'
import { createOpsEnvDiagnosticsRoute } from '../ops/env-diagnostics'
import { createOpsKnowledgeEnrichmentStatusRoute } from '../ops/knowledge-enrichment-status'
import { createOpsRefreshRoute } from '../ops/refresh'
import { createOpsSchedulerRoute } from '../ops/scheduler'
import type { FailsoftSource } from './domain/failsoft-policy'
import { createDashboardRuntimePlugin } from './plugin'
import { createAdvisorRoute } from './routes/advisor'
import { createAdvisorFineTuningReadinessRoute } from './routes/advisor-fine-tuning-readiness'
import { createAdvisorKnowledgeRoute } from './routes/advisor-knowledge'
import { createAdvisorReplayRoute } from './routes/advisor-replay'
import { createAdvisorV2Route } from './routes/advisor-v2'
import { createAnalyticsRoute } from './routes/analytics'
import { createDataQualityRoute } from './routes/data-quality'
import { createDerivedRecomputeRoute } from './routes/derived-recompute'
import { createExternalInvestmentsDashboardRoute } from './routes/external-investments'
import { createGoalsRoute } from './routes/goals'
import { createManualAssetsRoute } from './routes/manual-assets'
import { createMarketsRoute } from './routes/markets'
import { createNewsRoute } from './routes/news'
import { createProvidersDiagnosticsRoute } from './routes/providers-diagnostics'
import { createSignalSourcesRoute } from './routes/signal-sources'
import { createSummaryRoute } from './routes/summary'
import { createTradingLabRoute } from './routes/trading-lab'
import { createFreeFirehoseAdminRoute } from './routes/free-firehose'
import { createTransactionCategorizationBackfillRoute } from './routes/transaction-categorization-backfill'
import { createXTwitterDailySyncRoute } from './routes/x-twitter-daily-sync-route'
import { createXTwitterHealthRoute } from './routes/x-twitter-health'
import { createXTwitterLookupRoute } from './routes/x-twitter-lookup'
import { createTransactionClassificationRoute } from './routes/transaction-classification'
import { createTransactionsRoute } from './routes/transactions'
import { createDashboardOpsRefreshConfig } from './ops-refresh-config'
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
  xMaxUserReadsPerDay,
  xMaxPostReadsPerDay,
  xDailyBudgetUsd,
  xMonthlyBudgetUsd,
  xMaxTweetsPerAuthorPerDay,
  xMaxPagesPerUserPerDay,
  xRequireManualConfirmationOverEstimateUsd,
  xAdvisorRelevanceThreshold,
  xAdvisorMaxTweetsPerDay,
  xDailyPreviousDaySyncEnabled,
  xDailyPreviousDayTimezone,
  freeFirehoseEnabled,
  freeFirehoseMaxRunsPerWeek,
  freeFirehoseMaxGdeltRecords,
  freeFirehoseMaxHnRecords,
  freeFirehoseMaxSecFilings,
  freeFirehoseMaxFredSeries,
  freeFirehoseMaxEcbSeries,
  signalsSocialPollingEnabled,
  dailyIntelligenceEnabled,
  dailyIntelligenceCron,
  dailyIntelligenceNightCron,
  dailyIntelligenceMorningCron,
  dailyIntelligenceTimezone,
  dailyIntelligenceDryRunDefault,
  dailyIntelligenceManualTriggerEnabled,
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
  knowledgeServiceEnabled,
  knowledgeServiceUrl,
  knowledgeServiceTimeoutMs,
  knowledgeGraphMaxContextTokens,
  knowledgeGraphRetrievalMode,
  knowledgeGraphMaxPathDepth,
  knowledgeGraphMinConfidence,
  quantServiceEnabled,
  quantServiceUrl,
  quantServiceTimeoutMs,
  tradingLabGraphIngestEnabled,
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
  xMaxUserReadsPerDay: number
  xMaxPostReadsPerDay: number
  xDailyBudgetUsd: number
  xMonthlyBudgetUsd: number
  xMaxTweetsPerAuthorPerDay: number
  xMaxPagesPerUserPerDay: number
  xRequireManualConfirmationOverEstimateUsd: number
  xAdvisorRelevanceThreshold: number
  xAdvisorMaxTweetsPerDay: number
  xDailyPreviousDaySyncEnabled: boolean
  xDailyPreviousDayTimezone: string
  freeFirehoseEnabled: boolean
  freeFirehoseMaxRunsPerWeek: number
  freeFirehoseMaxGdeltRecords: number
  freeFirehoseMaxHnRecords: number
  freeFirehoseMaxSecFilings: number
  freeFirehoseMaxFredSeries: number
  freeFirehoseMaxEcbSeries: number
  signalsSocialPollingEnabled: boolean
  dailyIntelligenceEnabled: boolean
  dailyIntelligenceCron: string
  dailyIntelligenceNightCron: string
  dailyIntelligenceMorningCron: string
  dailyIntelligenceTimezone: string
  dailyIntelligenceDryRunDefault: boolean
  dailyIntelligenceManualTriggerEnabled: boolean
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
  knowledgeServiceEnabled: boolean
  knowledgeServiceUrl: string
  knowledgeServiceTimeoutMs: number
  knowledgeGraphMaxContextTokens: number
  knowledgeGraphRetrievalMode: 'hybrid' | 'graph' | 'vector' | 'fulltext'
  knowledgeGraphMaxPathDepth: number
  knowledgeGraphMinConfidence: number
  quantServiceEnabled: boolean
  quantServiceUrl: string
  quantServiceTimeoutMs: number
  tradingLabGraphIngestEnabled: boolean
  advisorGraphIngestEnabled: boolean
  externalInvestmentsEnabled: boolean
  externalInvestmentsSafeMode: boolean
  externalInvestmentsStaleAfterMinutes: number
  ibkrFlexEnabled: boolean
  binanceSpotEnabled: boolean
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
    knowledgeConfig: {
      enabled: knowledgeServiceEnabled,
      url: knowledgeServiceUrl,
      timeoutMs: knowledgeServiceTimeoutMs,
      maxContextTokens: knowledgeGraphMaxContextTokens,
      retrievalMode: knowledgeGraphRetrievalMode,
      maxPathDepth: knowledgeGraphMaxPathDepth,
      minConfidence: knowledgeGraphMinConfidence,
    },
    quantServiceEnabled,
    quantServiceUrl,
    quantServiceTimeoutMs,
    advisorGraphIngestEnabled,
    externalInvestmentsEnabled,
    externalInvestmentsSafeMode,
    externalInvestmentsStaleAfterMinutes,
    ibkrFlexEnabled,
    binanceSpotEnabled,
  })

  return new Elysia()
    .use(
      new Elysia({ prefix: '/dashboard' })
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
        .use(createExternalInvestmentsDashboardRoute())
        .use(createTransactionsRoute())
        .use(createTransactionClassificationRoute())
        .use(createTransactionCategorizationBackfillRoute({ db }))
        .use(
          createXTwitterLookupRoute({
            db,
            redisClient,
            env: {
              NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: newsProviderXTwitterBearerToken,
              X_MAX_USER_READS_PER_DAY: xMaxUserReadsPerDay,
            },
          })
        )
        .use(
          createXTwitterDailySyncRoute({
            db,
            env: {
              NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: newsProviderXTwitterBearerToken,
              X_DAILY_BUDGET_USD: xDailyBudgetUsd,
              X_MONTHLY_BUDGET_USD: xMonthlyBudgetUsd,
              X_MAX_POST_READS_PER_DAY: xMaxPostReadsPerDay,
              X_MAX_USER_READS_PER_DAY: xMaxUserReadsPerDay,
              X_MAX_PAGES_PER_USER_PER_DAY: xMaxPagesPerUserPerDay,
              X_MAX_TWEETS_PER_AUTHOR_PER_DAY: xMaxTweetsPerAuthorPerDay,
              X_REQUIRE_MANUAL_CONFIRMATION_OVER_ESTIMATE_USD:
                xRequireManualConfirmationOverEstimateUsd,
              X_ADVISOR_RELEVANCE_THRESHOLD: xAdvisorRelevanceThreshold,
              X_ADVISOR_MAX_TWEETS_PER_DAY: xAdvisorMaxTweetsPerDay,
              X_DAILY_PREVIOUS_DAY_TIMEZONE: xDailyPreviousDayTimezone,
            },
          })
        )
        .use(
          createXTwitterHealthRoute({
            db,
            env: {
              NEWS_PROVIDER_X_TWITTER_ENABLED: newsProviderXTwitterEnabled,
              NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: newsProviderXTwitterBearerToken,
              X_DAILY_BUDGET_USD: xDailyBudgetUsd,
              X_MONTHLY_BUDGET_USD: xMonthlyBudgetUsd,
              X_DAILY_PREVIOUS_DAY_SYNC_ENABLED: xDailyPreviousDaySyncEnabled,
            },
          })
        )
        .use(
          createFreeFirehoseAdminRoute({
            db,
            env: {
              FREE_FIREHOSE_ENABLED: freeFirehoseEnabled,
              FREE_FIREHOSE_MAX_RUNS_PER_WEEK: freeFirehoseMaxRunsPerWeek,
              FREE_FIREHOSE_MAX_GDELT_RECORDS: freeFirehoseMaxGdeltRecords,
              FREE_FIREHOSE_MAX_HN_RECORDS: freeFirehoseMaxHnRecords,
              FREE_FIREHOSE_MAX_SEC_FILINGS: freeFirehoseMaxSecFilings,
              FREE_FIREHOSE_MAX_FRED_SERIES: freeFirehoseMaxFredSeries,
              FREE_FIREHOSE_MAX_ECB_SERIES: freeFirehoseMaxEcbSeries,
              NEWS_PROVIDER_HN_QUERY: newsProviderHnQuery,
              NEWS_PROVIDER_GDELT_QUERY: newsProviderGdeltQuery,
              NEWS_PROVIDER_ECB_RSS_FEED_URLS: newsProviderEcbRssFeedUrls,
              NEWS_PROVIDER_FED_FEED_URLS: newsProviderFedFeedUrls,
              NEWS_PROVIDER_SEC_TICKERS: newsProviderSecTickers,
              NEWS_PROVIDER_FRED_SERIES_IDS: newsProviderFredSeriesIds,
              FRED_API_KEY: newsProviderFredApiKey,
              SEC_USER_AGENT: newsProviderSecUserAgent,
            },
          })
        )
        .use(createSignalSourcesRoute({ db }))
        .use(createProvidersDiagnosticsRoute())
        .use(createDataQualityRoute())
        .use(createAdvisorV2Route({ v2Enabled: aiAdvisorV2Enabled }))
        .use(createAdvisorReplayRoute())
        .use(createAdvisorFineTuningReadinessRoute())
        .use(
          createTradingLabRoute({
            db,
            quantServiceEnabled,
            quantServiceUrl,
            quantServiceTimeoutMs,
            knowledgeServiceEnabled,
            knowledgeServiceUrl,
            graphIngestEnabled: tradingLabGraphIngestEnabled,
            marketDataDeps: {
              eodhdApiKey,
              twelveDataApiKey,
              marketDataEodhdEnabled,
              marketDataTwelveDataEnabled,
              forceFixtureFallback: marketDataForceFixtureFallback,
            },
          })
        )
    )
    .use(
      createOpsRefreshRoute({
        runtime,
        config: createDashboardOpsRefreshConfig({
          externalInvestmentsEnabled,
          ibkrFlexEnabled,
          binanceSpotEnabled,
          liveNewsIngestionEnabled,
          marketDataEnabled,
          marketDataRefreshEnabled,
          aiAdvisorEnabled,
          signalsSocialPollingEnabled,
        }),
      })
    )
    .use(
      createOpsSchedulerRoute({
        config: {
          dailyIntelligenceEnabled,
          dailyIntelligenceTimezone,
          dailyIntelligenceNightCron,
          dailyIntelligenceMorningCron,
          dailyIntelligenceLegacyCron: dailyIntelligenceCron,
          dailyIntelligenceDryRunDefault,
          dailyIntelligenceManualTriggerEnabled,
          marketDataAutoRefreshEnabled: marketDataRefreshEnabled,
          signalsSocialPollingEnabled,
        },
      })
    )
    .use(
      createOpsKnowledgeEnrichmentStatusRoute({
        db,
        knowledgeServiceEnabled,
        advisorGraphIngestEnabled,
      })
    )
    .use(createOpsEnvDiagnosticsRoute())
}
