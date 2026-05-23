import type { env as WorkerEnv } from './env'

type WorkerEnvShape = typeof WorkerEnv

export type WorkerFeatureFlagsAudit = {
  externalIntegrationsSafeMode: boolean
  workerAutoSyncEnabled: boolean
  // Advisor / post-mortem / daily intelligence
  aiAdvisorEnabled: boolean
  aiAdvisorForceLocalOnly: boolean
  aiKnowledgeQaRetrievalEnabled: boolean
  aiDailyAutoRunEnabled: boolean
  aiDailyIntervalMs: number
  aiPostMortemAutoRunEnabled: boolean
  aiPostMortemCron: string
  aiPostMortemTimezone: string
  dailyIntelligenceEnabled: boolean
  dailyIntelligenceCron: string
  dailyIntelligenceNightCron: string
  dailyIntelligenceMorningCron: string
  dailyIntelligenceTimezone: string
  dailyIntelligenceDryRunDefault: boolean
  dailyIntelligenceManualTriggerEnabled: boolean
  // News & social
  newsAutoIngestEnabled: boolean
  newsFetchIntervalMs: number
  signalsSocialPollingEnabled: boolean
  signalsSocialPollingIntervalMs: number
  advisorXSignalsMode: 'off' | 'shadow' | 'enforced'
  // Market data
  marketDataAutoRefreshEnabled: boolean
  marketDataRefreshIntervalMs: number
  // Attention system
  attentionSystemEnabled: boolean
  attentionRebuildAutoEnabled: boolean
  attentionRebuildIntervalMs: number
  // Propagated for ops visibility (consumed by API, not worker zod schema)
  propagatedOnly: {
    aiPostMortemEnabled: PropagatedFlag
    marketDataRefreshCooldownSeconds: PropagatedFlag
    advisorGraphIngestEnabled: PropagatedFlag
    tradingLabGraphIngestEnabled: PropagatedFlag
    newsProviderXTwitterEnabled: PropagatedFlag
    newsProviderXTwitterQuery: PropagatedFlag
  }
}

type PropagatedFlag = { present: boolean; raw: string | null }

const readPropagated = (
  source: NodeJS.ProcessEnv,
  key: string,
  redact: boolean = false
): PropagatedFlag => {
  const raw = source[key]
  if (raw === undefined || raw === '') {
    return { present: false, raw: null }
  }
  return { present: true, raw: redact ? '<redacted>' : raw }
}

export const buildWorkerFeatureFlagsAudit = (
  env: WorkerEnvShape,
  processEnv: NodeJS.ProcessEnv = process.env
): WorkerFeatureFlagsAudit => ({
  externalIntegrationsSafeMode: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
  workerAutoSyncEnabled: env.WORKER_AUTO_SYNC_ENABLED,
  aiAdvisorEnabled: env.AI_ADVISOR_ENABLED,
  aiAdvisorForceLocalOnly: env.AI_ADVISOR_FORCE_LOCAL_ONLY,
  aiKnowledgeQaRetrievalEnabled: env.AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED,
  aiDailyAutoRunEnabled: env.AI_DAILY_AUTO_RUN_ENABLED,
  aiDailyIntervalMs: env.AI_DAILY_INTERVAL_MS,
  aiPostMortemAutoRunEnabled: env.AI_POST_MORTEM_AUTO_RUN_ENABLED,
  aiPostMortemCron: env.AI_POST_MORTEM_CRON,
  aiPostMortemTimezone: env.AI_POST_MORTEM_TIMEZONE,
  dailyIntelligenceEnabled: env.DAILY_INTELLIGENCE_ENABLED,
  dailyIntelligenceCron: env.DAILY_INTELLIGENCE_CRON,
  dailyIntelligenceNightCron: env.DAILY_INTELLIGENCE_NIGHT_CRON,
  dailyIntelligenceMorningCron: env.DAILY_INTELLIGENCE_MORNING_CRON,
  dailyIntelligenceTimezone: env.DAILY_INTELLIGENCE_TIMEZONE,
  dailyIntelligenceDryRunDefault: env.DAILY_INTELLIGENCE_DRY_RUN_DEFAULT,
  dailyIntelligenceManualTriggerEnabled: env.DAILY_INTELLIGENCE_MANUAL_TRIGGER_ENABLED,
  newsAutoIngestEnabled: env.NEWS_AUTO_INGEST_ENABLED,
  newsFetchIntervalMs: env.NEWS_FETCH_INTERVAL_MS,
  signalsSocialPollingEnabled: env.SIGNALS_SOCIAL_POLLING_ENABLED,
  signalsSocialPollingIntervalMs: env.SIGNALS_SOCIAL_POLLING_INTERVAL_MS,
  advisorXSignalsMode: env.ADVISOR_X_SIGNALS_MODE,
  marketDataAutoRefreshEnabled: env.MARKET_DATA_AUTO_REFRESH_ENABLED,
  marketDataRefreshIntervalMs: env.MARKET_DATA_REFRESH_INTERVAL_MS,
  attentionSystemEnabled: env.ATTENTION_SYSTEM_ENABLED,
  attentionRebuildAutoEnabled: env.ATTENTION_REBUILD_AUTO_ENABLED,
  attentionRebuildIntervalMs: env.ATTENTION_REBUILD_INTERVAL_MS,
  propagatedOnly: {
    aiPostMortemEnabled: readPropagated(processEnv, 'AI_POST_MORTEM_ENABLED'),
    marketDataRefreshCooldownSeconds: readPropagated(
      processEnv,
      'MARKET_DATA_REFRESH_COOLDOWN_SECONDS'
    ),
    advisorGraphIngestEnabled: readPropagated(processEnv, 'ADVISOR_GRAPH_INGEST_ENABLED'),
    tradingLabGraphIngestEnabled: readPropagated(processEnv, 'TRADING_LAB_GRAPH_INGEST_ENABLED'),
    newsProviderXTwitterEnabled: readPropagated(processEnv, 'NEWS_PROVIDER_X_TWITTER_ENABLED'),
    newsProviderXTwitterQuery: readPropagated(processEnv, 'NEWS_PROVIDER_X_TWITTER_QUERY'),
  },
})
