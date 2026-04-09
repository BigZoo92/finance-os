import { logApiEvent, toErrorLogFields } from '../../../observability/logger'
import { buildNewsClusters, buildNewsContextBundle } from './news-context-bundle'
import { buildFailsoftEnvelope, type FailsoftSource } from './failsoft-policy'
import type {
  DashboardNewsRepository,
  DashboardNewsResponse,
  DashboardNewsUseCases,
} from '../types'
import type { LiveNewsIngestionSummary } from '../services/fetch-live-news'

const STALE_AFTER_MS = 1000 * 60 * 60 * 6

const toRangeWindowStart = (range: '24h' | '7d' | '30d') => {
  const now = new Date()
  const hours = range === '24h' ? 24 : range === '7d' ? 24 * 7 : 24 * 30
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString()
}

export const createDashboardNewsUseCases = ({
  repository,
  runLiveIngestion,
  liveIngestionEnabled,
  failsoftPolicyEnabled,
  failsoftSourceOrder,
  failsoftNewsEnabled,
  aiContextBundleEnabled,
}: {
  repository: DashboardNewsRepository
  runLiveIngestion: (input: { requestId: string }) => Promise<LiveNewsIngestionSummary>
  liveIngestionEnabled: boolean
  failsoftPolicyEnabled: boolean
  failsoftSourceOrder: FailsoftSource[]
  failsoftNewsEnabled: boolean
  aiContextBundleEnabled: boolean
}): DashboardNewsUseCases => ({
  getNews: async input => {
    const state = await repository.getNewsCacheState()
    const items = await repository.listNewsArticles(input)
    const providers = await repository.listNewsProviderHealth()

    const nowMs = Date.now()
    const lastUpdatedAt = state?.lastSuccessAt?.toISOString() ?? null
    const staleAgeSeconds =
      state?.lastSuccessAt === null || state?.lastSuccessAt === undefined
        ? null
        : Math.max(0, Math.round((nowMs - state.lastSuccessAt.getTime()) / 1000))
    const staleCache =
      state?.lastSuccessAt === null || state?.lastSuccessAt === undefined
        ? true
        : nowMs - state.lastSuccessAt.getTime() > STALE_AFTER_MS
    const providerFailureRate =
      state && state.ingestionCount > 0
        ? state.providerFailureCount / state.ingestionCount
        : state && state.providerFailureCount > 0
          ? 1
          : 0

    const resilience = buildFailsoftEnvelope({
      mode: 'admin',
      domain: 'news',
      requestId: input.requestId,
      staleAgeSeconds,
      hasCacheData: items.length > 0,
      providerFailureRate,
      cacheStale: staleCache,
      sourceOrder: failsoftSourceOrder,
      policyEnabled: failsoftPolicyEnabled,
      domainEnabled: failsoftNewsEnabled,
    })

    const contextPreview = buildNewsContextBundle({
      items,
      range: '7d',
      lastUpdatedAt,
      staleCache,
      providerFailureRate,
      requestId: input.requestId,
    })

    logApiEvent({
      level: resilience.status === 'ok' ? 'info' : 'warn',
      msg: 'dashboard news cache query',
      requestId: input.requestId,
      filter_topic: input.topic ?? null,
      filter_source: input.sourceName ?? null,
      filter_event_type: input.eventType ?? null,
      filter_domain: input.domain ?? null,
      result_count: items.length,
      failsoft_domain: resilience.domain,
      failsoft_status: resilience.status,
      failsoft_source: resilience.source,
      failsoft_reason_code: resilience.reasonCode,
      failsoft_policy_enabled: resilience.policy.enabled,
      failsoft_degraded_rate: resilience.slo.degradedRate,
      failsoft_hard_fail_rate: resilience.slo.hardFailRate,
      failsoft_stale_age_seconds: resilience.slo.staleAgeSeconds,
    })

    return {
      source: 'cache',
      resilience,
      lastUpdatedAt,
      staleCache,
      providerError:
        state?.lastErrorCode && state.lastErrorMessage
          ? {
              code: state.lastErrorCode,
              message: state.lastErrorMessage,
            }
          : null,
      metrics: {
        cacheHitRate: items.length > 0 ? 1 : 0,
        dedupeDropRate:
          state && state.ingestionCount > 0 ? state.dedupeDropCount / state.ingestionCount : 0,
        providerFailureRate,
        lastFetchedCount: state?.lastFetchedCount ?? null,
        lastInsertedCount: state?.lastInsertedCount ?? null,
        lastMergedCount: state?.lastMergedCount ?? null,
      },
      filters: {
        applied: {
          ...(input.topic ? { topic: input.topic } : {}),
          ...(input.sourceName ? { sourceName: input.sourceName } : {}),
          ...(input.sourceType ? { sourceType: input.sourceType } : {}),
          ...(input.domain ? { domain: input.domain } : {}),
          ...(input.eventType ? { eventType: input.eventType } : {}),
          ...(input.minSeverity !== undefined ? { minSeverity: input.minSeverity } : {}),
          ...(input.region ? { region: input.region } : {}),
          ...(input.ticker ? { ticker: input.ticker } : {}),
          ...(input.sector ? { sector: input.sector } : {}),
          ...(input.direction ? { direction: input.direction } : {}),
          ...(input.from ? { from: input.from } : {}),
          ...(input.to ? { to: input.to } : {}),
        },
      },
      providers,
      clusters: buildNewsClusters(items),
      contextPreview: {
        topSignals: contextPreview.topSignals,
        mostImpactedSectors: contextPreview.mostImpactedSectors,
        mostImpactedEntities: contextPreview.mostImpactedEntities,
        contradictorySignals: contextPreview.contradictorySignals,
        causalHypotheses: contextPreview.causalHypotheses,
      },
      items,
    } satisfies DashboardNewsResponse
  },

  getNewsContextBundle: async ({ requestId, range }) => {
    const state = await repository.getNewsCacheState()
    const items = await repository.listNewsArticles({
      limit: 120,
      from: toRangeWindowStart(range),
    })
    const providerFailureRate =
      state && state.ingestionCount > 0
        ? state.providerFailureCount / state.ingestionCount
        : state && state.providerFailureCount > 0
          ? 1
          : 0

    if (!aiContextBundleEnabled) {
      return buildNewsContextBundle({
        items: [],
        range,
        lastUpdatedAt: state?.lastSuccessAt?.toISOString() ?? null,
        staleCache: true,
        providerFailureRate,
        requestId,
      })
    }

    return buildNewsContextBundle({
      items,
      range,
      lastUpdatedAt: state?.lastSuccessAt?.toISOString() ?? null,
      staleCache:
        state?.lastSuccessAt === null || state?.lastSuccessAt === undefined
          ? true
          : Date.now() - state.lastSuccessAt.getTime() > STALE_AFTER_MS,
      providerFailureRate,
      requestId,
    })
  },

  ingestNews: async ({ requestId }) => {
    const startedAt = Date.now()

    if (!liveIngestionEnabled) {
      await repository.upsertNewsCacheState({
        lastAttemptAt: new Date(),
        lastErrorCode: 'FEATURE_DISABLED',
        lastErrorMessage: 'Live news ingestion is disabled.',
        lastRequestId: requestId,
      })

      throw Object.assign(new Error('FEATURE_DISABLED'), { code: 'FEATURE_DISABLED' })
    }

    try {
      const result = await runLiveIngestion({ requestId })
      const signalCount = await repository.countNewsArticles()
      const failedProviderCount = result.providerResults.filter(provider => provider.status === 'failed').length
      const finishedAt = Date.now()

      await repository.upsertNewsCacheState({
        lastAttemptAt: new Date(),
        lastSuccessAt: new Date(),
        lastErrorCode: failedProviderCount > 0 ? 'PARTIAL_PROVIDER_FAILURE' : null,
        lastErrorMessage:
          failedProviderCount > 0 ? 'One or more providers failed. Cached signals remain usable.' : null,
        lastRequestId: requestId,
        ingestionCountIncrement: 1,
        dedupeDropCountIncrement: result.dedupeDropCount,
        providerFailureCountIncrement: failedProviderCount,
        lastIngestDurationMs: finishedAt - startedAt,
        lastFetchedCount: result.fetchedCount,
        lastInsertedCount: result.insertedCount,
        lastMergedCount: result.mergedCount,
        lastProviderCount: result.providerResults.filter(provider => provider.status !== 'skipped').length,
        lastSignalCount: signalCount,
      })

      logApiEvent({
        level: failedProviderCount > 0 ? 'warn' : 'info',
        msg: 'dashboard news ingested',
        requestId,
        fetched_count: result.fetchedCount,
        inserted_count: result.insertedCount,
        merged_count: result.mergedCount,
        dedupe_drop_count: result.dedupeDropCount,
        failed_provider_count: failedProviderCount,
        ingest_latency_ms: finishedAt - startedAt,
      })

      return {
        fetchedCount: result.fetchedCount,
        insertedCount: result.insertedCount,
        mergedCount: result.mergedCount,
        dedupeDropCount: result.dedupeDropCount,
      }
    } catch (error) {
      const finishedAt = Date.now()
      const safeErrorCode = error instanceof Error ? error.message.slice(0, 64) : 'PROVIDER_ERROR'

      await repository.upsertNewsCacheState({
        lastAttemptAt: new Date(),
        lastFailureAt: new Date(),
        lastErrorCode: safeErrorCode,
        lastErrorMessage: 'News providers unavailable. Showing cached results.',
        lastRequestId: requestId,
        ingestionCountIncrement: 1,
        providerFailureCountIncrement: 1,
        lastIngestDurationMs: finishedAt - startedAt,
      })

      logApiEvent({
        level: 'warn',
        msg: 'dashboard news ingestion failed',
        requestId,
        ingest_latency_ms: finishedAt - startedAt,
        ...toErrorLogFields({
          error,
          includeStack: false,
        }),
      })

      throw error
    }
  },
})
