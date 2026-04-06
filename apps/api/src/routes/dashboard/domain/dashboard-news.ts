import { logApiEvent, toErrorLogFields } from '../../../observability/logger'
import {
  buildFailsoftEnvelope,
  type FailsoftSource,
} from './failsoft-policy'
import type { DashboardNewsResponse, DashboardNewsUseCases, DashboardReadRepository } from '../types'

const STALE_AFTER_MS = 1000 * 60 * 60 * 6

export const createDashboardNewsUseCases = ({
  readModel,
  fetchLiveNews,
  liveIngestionEnabled,
  failsoftPolicyEnabled,
  failsoftSourceOrder,
  failsoftNewsEnabled,
}: {
  readModel: DashboardReadRepository
  fetchLiveNews: (input: { requestId: string }) => Promise<
    Array<{
      providerArticleId: string
      dedupeKey: string
      title: string
      summary: string | null
      url: string
      sourceName: string
      topic: string
      language: string
      publishedAt: Date
      metadata: Record<string, unknown> | null
    }>
  >
  liveIngestionEnabled: boolean
  failsoftPolicyEnabled: boolean
  failsoftSourceOrder: FailsoftSource[]
  failsoftNewsEnabled: boolean
}): DashboardNewsUseCases => ({
  getNews: async ({ topic, sourceName, limit, requestId }) => {
    const state = await readModel.getNewsCacheState()
    const rows = await readModel.listNewsArticles({
      ...(topic ? { topic } : {}),
      ...(sourceName ? { sourceName } : {}),
      limit,
    })
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
      requestId,
      staleAgeSeconds,
      hasCacheData: rows.length > 0,
      providerFailureRate,
      cacheStale: staleCache,
      sourceOrder: failsoftSourceOrder,
      policyEnabled: failsoftPolicyEnabled,
      domainEnabled: failsoftNewsEnabled,
    })
    logApiEvent({
      level: resilience.status === 'ok' ? 'info' : 'warn',
      msg: 'dashboard news cache query',
      requestId,
      filter_topic: topic ?? null,
      filter_source: sourceName ?? null,
      result_count: rows.length,
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
        cacheHitRate: rows.length > 0 ? 1 : 0,
        dedupeDropRate:
          state && state.ingestionCount > 0 ? state.dedupeDropCount / state.ingestionCount : 0,
        providerFailureRate,
      },
      items: rows.map(row => ({
        id: String(row.id),
        title: row.title,
        summary: row.summary,
        url: row.url,
        sourceName: row.sourceName,
        topic: row.topic,
        language: row.language,
        publishedAt: row.publishedAt.toISOString(),
      })),
    } satisfies DashboardNewsResponse
  },

  ingestNews: async ({ requestId }) => {
    const startedAt = Date.now()

    if (!liveIngestionEnabled) {
      await readModel.upsertNewsCacheState({
        lastAttemptAt: new Date(),
        lastErrorCode: 'FEATURE_DISABLED',
        lastErrorMessage: 'Live news ingestion is disabled.',
        lastRequestId: requestId,
      })

      throw Object.assign(new Error('FEATURE_DISABLED'), { code: 'FEATURE_DISABLED' })
    }

    try {
      const liveArticles = await fetchLiveNews({ requestId })
      const { insertedCount, dedupeDropCount } = await readModel.upsertNewsArticles(liveArticles)
      const finishedAt = Date.now()
      await readModel.upsertNewsCacheState({
        lastAttemptAt: new Date(),
        lastSuccessAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        lastRequestId: requestId,
        ingestionCountIncrement: 1,
        dedupeDropCountIncrement: dedupeDropCount,
        providerFailureCountIncrement: 0,
        lastIngestDurationMs: finishedAt - startedAt,
      })

      logApiEvent({
        level: 'info',
        msg: 'dashboard news ingested',
        requestId,
        fetched_count: liveArticles.length,
        inserted_count: insertedCount,
        dedupe_drop_count: dedupeDropCount,
        ingest_latency_ms: finishedAt - startedAt,
      })

      return {
        fetchedCount: liveArticles.length,
        insertedCount,
        dedupeDropCount,
      }
    } catch (error) {
      const finishedAt = Date.now()
      const safeErrorCode = error instanceof Error ? error.message.slice(0, 64) : 'PROVIDER_ERROR'
      await readModel.upsertNewsCacheState({
        lastAttemptAt: new Date(),
        lastFailureAt: new Date(),
        lastErrorCode: safeErrorCode,
        lastErrorMessage: 'News provider unavailable. Showing cached results.',
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
