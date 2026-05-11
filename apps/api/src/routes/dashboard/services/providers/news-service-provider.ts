// Macro Prompt 3 — Internal provider migration: news aggregation read path.
//
// Aggregation-level Provider<C> wrapper around the existing `NewsProviderAdapter` pool
// (HN / GDELT / ECB / Fed / SEC EDGAR / FRED / X-Twitter, etc.). The wrapper is the
// canonical contract entry point for `news.items.read`; the existing
// `/dashboard/news` routes and `dashboard.useCases.ingestNews` continue to consume the
// adapter pool directly until a follow-up macro prompt rewires them. Public API
// response shapes are NOT touched in this batch.
//
// Why an aggregation-level wrapper rather than per-source wrappers:
//  - The current `NewsProviderAdapter` shape already enforces enabled/cooldown semantics
//    consistently; a single wrapper preserves that surface with one Provider<C> entry.
//  - Per-source wrappers would multiply test/doc surface (~9 adapters) without value
//    until the routes consume them.
//
// Invariants:
//  - mode='demo' returns a deterministic empty snapshot and never touches the network.
//  - 0 enabled adapters → `disabled_by_flag` (caller must fail-soft).
//  - Per-adapter exceptions stay inside the wrapper and are reported as failed counts.
//    The wrapper never re-throws; it returns providerOk with per-source statuses.
//  - Raw article bodies, article URLs, and provider response payloads NEVER reach a log
//    line, the output DTO, or the diagnostics surface — only counts, statuses, error
//    codes, and durations leave this module.
//  - Health is precomputed from the last call's outcome — `getHealth()` never does IO.
//
// This module performs read-only retrieval only; no DB writes, no graph ingest, no
// trading/payment side-effects.

import {
  asProviderId,
  type Provider,
  type ProviderCallContext,
  type ProviderHealth,
  type ProviderResult,
} from '@finance-os/provider-contract'
import {
  createProviderError,
  logProviderEvent,
  type ProviderLogTarget,
  providerErr,
  providerOk,
} from '@finance-os/provider-runtime'
import type { NewsProviderId } from '../../domain/news-taxonomy'
import type { NewsProviderAdapter } from '../news-provider-types'

const PROVIDER_ID = asProviderId('news-service')
const CAPABILITY = 'news.items.read' as const

const DEFAULT_MAX_ITEMS_PER_ADAPTER = 20

export type NewsProviderRunStatus = 'success' | 'skipped' | 'failed'

export interface NewsServiceProviderInput {
  /** Maximum items per upstream adapter for this call. Defaults to `defaultMaxItems`. */
  readonly maxItemsPerProvider?: number
}

export interface NewsServiceProviderRunSnapshot {
  readonly provider: NewsProviderId
  readonly status: NewsProviderRunStatus
  readonly enabled: boolean
  readonly fetchedCount: number
  readonly durationMs: number
  /** Closed-vocabulary code; never an upstream message body. */
  readonly errorCode: string | null
}

export interface NewsServiceProviderOutput {
  readonly providers: ReadonlyArray<NewsServiceProviderRunSnapshot>
  readonly fetchedCount: number
  readonly retrievedAt: string
}

export interface NewsServiceProviderDeps {
  /** Pool of news adapters. Same array used by `createLiveNewsIngestionService`. */
  readonly adapters: ReadonlyArray<NewsProviderAdapter>
  readonly logTarget: ProviderLogTarget
  readonly defaultMaxItems?: number
  readonly now?: () => Date
}

interface HealthState {
  status: ProviderHealth['status']
  lastSuccessAt: string | null
  lastErrorCode: ProviderHealth['lastErrorCode']
  note?: string
}

const sourceMeta = (freshnessMinutes: number | null, fromCache: boolean) =>
  ({
    providerId: PROVIDER_ID,
    capability: CAPABILITY,
    freshnessMinutes,
    fromCache,
  }) as const

const countEnabled = (adapters: ReadonlyArray<NewsProviderAdapter>): number =>
  adapters.reduce((acc, a) => acc + (a.enabled ? 1 : 0), 0)

export const createNewsServiceProvider = (
  deps: NewsServiceProviderDeps
): Provider<typeof CAPABILITY, NewsServiceProviderInput, NewsServiceProviderOutput> => {
  const { adapters, logTarget } = deps
  const now = deps.now ?? (() => new Date())
  const defaultMaxItems = deps.defaultMaxItems ?? DEFAULT_MAX_ITEMS_PER_ADAPTER

  const enabledCount = countEnabled(adapters)
  const health: HealthState = {
    status: enabledCount > 0 ? 'ok' : 'down',
    lastSuccessAt: null,
    lastErrorCode: enabledCount > 0 ? null : 'disabled_by_flag',
    ...(enabledCount > 0 ? {} : { note: 'no enabled news adapters' }),
  }

  return {
    id: PROVIDER_ID,
    capability: CAPABILITY,
    call: async (
      input: NewsServiceProviderInput,
      ctx: ProviderCallContext
    ): Promise<ProviderResult<NewsServiceProviderOutput>> => {
      const startedAt = Date.now()
      const meta = (durationMs: number, freshnessMinutes: number | null, fromCache: boolean) => ({
        requestId: ctx.requestId,
        durationMs,
        sources: [sourceMeta(freshnessMinutes, fromCache)],
      })

      logProviderEvent(logTarget, {
        name: 'provider.call.started',
        fields: {
          providerId: PROVIDER_ID,
          capability: CAPABILITY,
          requestId: ctx.requestId,
          mode: ctx.mode,
          itemCount: adapters.length,
        },
      })

      // Demo mode: deterministic, never hits the network.
      if (ctx.mode === 'demo') {
        const retrievedAt = now().toISOString()
        const snapshots: NewsServiceProviderRunSnapshot[] = adapters.map(adapter => ({
          provider: adapter.provider,
          status: 'skipped' as const,
          enabled: false,
          fetchedCount: 0,
          durationMs: 0,
          errorCode: null,
        }))
        logProviderEvent(logTarget, {
          name: 'provider.call.succeeded',
          fields: {
            providerId: PROVIDER_ID,
            capability: CAPABILITY,
            requestId: ctx.requestId,
            mode: ctx.mode,
            cacheStatus: 'hit',
            freshnessMinutes: 0,
            durationMs: Date.now() - startedAt,
            itemCount: 0,
          },
        })
        return providerOk(
          { providers: snapshots, fetchedCount: 0, retrievedAt },
          meta(Date.now() - startedAt, 0, true)
        )
      }

      if (enabledCount === 0) {
        const error = createProviderError({
          code: 'disabled_by_flag',
          providerId: PROVIDER_ID,
          message: 'no enabled news adapters',
          capability: CAPABILITY,
          requestId: ctx.requestId,
        })
        health.status = 'down'
        health.lastErrorCode = 'disabled_by_flag'
        health.note = 'no enabled news adapters'
        logProviderEvent(logTarget, {
          name: 'provider.call.skipped',
          fields: {
            providerId: PROVIDER_ID,
            capability: CAPABILITY,
            requestId: ctx.requestId,
            mode: ctx.mode,
            errorCode: error.code,
            durationMs: Date.now() - startedAt,
          },
        })
        return providerErr(error, meta(Date.now() - startedAt, null, false))
      }

      const maxItems = input.maxItemsPerProvider ?? defaultMaxItems
      const snapshots: NewsServiceProviderRunSnapshot[] = []
      let totalFetched = 0
      let successCount = 0
      let failureCount = 0

      for (const adapter of adapters) {
        const adapterStartedAt = Date.now()
        if (!adapter.enabled) {
          snapshots.push({
            provider: adapter.provider,
            status: 'skipped',
            enabled: false,
            fetchedCount: 0,
            durationMs: 0,
            errorCode: null,
          })
          continue
        }
        try {
          const items = await adapter.fetchItems({
            requestId: ctx.requestId,
            now: now(),
            maxItems,
          })
          const count = items.length
          totalFetched += count
          successCount += 1
          snapshots.push({
            provider: adapter.provider,
            status: 'success',
            enabled: true,
            fetchedCount: count,
            durationMs: Date.now() - adapterStartedAt,
            errorCode: null,
          })
        } catch {
          // Per-adapter failures are summarized as a closed-vocab code; the upstream
          // exception object (which can include URLs / response bodies) never leaves
          // this catch block.
          failureCount += 1
          snapshots.push({
            provider: adapter.provider,
            status: 'failed',
            enabled: true,
            fetchedCount: 0,
            durationMs: Date.now() - adapterStartedAt,
            errorCode: 'provider_unavailable',
          })
        }
      }

      const retrievedAt = now().toISOString()

      // All enabled adapters failed → surface as transient failure of the wrapper.
      if (successCount === 0 && failureCount > 0) {
        const error = createProviderError({
          code: 'provider_unavailable',
          providerId: PROVIDER_ID,
          message: 'all enabled news adapters failed',
          capability: CAPABILITY,
          requestId: ctx.requestId,
          safeDetails: { failureCount, enabledCount },
        })
        health.status = 'down'
        health.lastErrorCode = error.code
        logProviderEvent(logTarget, {
          name: 'provider.call.failed',
          fields: {
            providerId: PROVIDER_ID,
            capability: CAPABILITY,
            requestId: ctx.requestId,
            mode: ctx.mode,
            errorCode: error.code,
            retryable: error.retryable,
            durationMs: Date.now() - startedAt,
          },
        })
        return providerErr(error, meta(Date.now() - startedAt, null, false))
      }

      health.status = failureCount > 0 ? 'degraded' : 'ok'
      health.lastSuccessAt = retrievedAt
      health.lastErrorCode = failureCount > 0 ? 'provider_unavailable' : null
      if (failureCount === 0) {
        delete health.note
      } else {
        health.note = `${failureCount} adapter(s) failed`
      }

      logProviderEvent(logTarget, {
        name: 'provider.call.succeeded',
        fields: {
          providerId: PROVIDER_ID,
          capability: CAPABILITY,
          requestId: ctx.requestId,
          mode: ctx.mode,
          cacheStatus: 'miss',
          freshnessMinutes: 0,
          durationMs: Date.now() - startedAt,
          itemCount: totalFetched,
        },
      })

      return providerOk(
        { providers: snapshots, fetchedCount: totalFetched, retrievedAt },
        meta(Date.now() - startedAt, 0, false)
      )
    },
    getHealth: () => ({
      status: health.status,
      lastSuccessAt: health.lastSuccessAt,
      lastErrorCode: health.lastErrorCode,
      ...(health.note !== undefined ? { note: health.note } : {}),
    }),
  }
}
