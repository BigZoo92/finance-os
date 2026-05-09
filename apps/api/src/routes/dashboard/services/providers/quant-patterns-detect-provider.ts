// Macro Prompt 2 — Internal provider migration: quant-service pattern detection.
//
// Thin Provider<C> wrapper around the existing `/quant/patterns/detect` HTTP call shape
// used inline by [trading-lab.ts](../../routes/trading-lab.ts). The wrapper is the
// canonical contract entry point for `quant.patterns.detect`; the route's inline
// `callQuantService` continues to be the consumer until a follow-up macro prompt rewires
// it. The public `/dashboard/trading-lab/patterns/detect` response shape is NOT changed.
//
// Invariants:
//  - mode='demo' uses the deterministic `buildDemoPatternDetectionResponse` and never
//    performs a network call. The result is reported with `fromCache:true`.
//  - quantServiceEnabled=false → `disabled_by_flag`.
//  - Network / non-2xx → `transient` / `provider_unavailable`.
//  - Raw candles never reach a log line — only `candleCount` is observable.
//  - PR10 / PR15B execution-vocabulary safeguards stay where they are (in the Python
//    service); this wrapper does not introduce execution semantics.

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
  normalizeProviderError,
  type ProviderLogTarget,
  providerErr,
  providerOk,
} from '@finance-os/provider-runtime'
import { buildDemoPatternDetectionResponse } from '../pattern-detection-demo'

const PROVIDER_ID = asProviderId('quant-service')
const CAPABILITY = 'quant.patterns.detect' as const

export interface QuantPatternsDetectInput {
  readonly symbol?: string
  readonly timeframe?: string
  readonly candles?: readonly unknown[]
  readonly patterns?: readonly string[]
  readonly options?: Record<string, unknown>
}

/**
 * Trimmed projection: the wrapper returns the raw quant-service body for forward
 * compatibility with the existing route shape but never re-emits it through the logger.
 */
export interface QuantPatternsDetectOutput {
  readonly response: Readonly<Record<string, unknown>>
  readonly retrievedAt: string
}

export interface QuantPatternsDetectProviderConfig {
  readonly enabled: boolean
  readonly url: string
  readonly timeoutMs: number
}

export type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>

export interface QuantPatternsDetectProviderDeps {
  readonly config: QuantPatternsDetectProviderConfig
  readonly logTarget: ProviderLogTarget
  readonly fetchImpl?: FetchImpl
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

const candleCountOf = (input: QuantPatternsDetectInput): number =>
  Array.isArray(input.candles) ? input.candles.length : 0

export const createQuantPatternsDetectProvider = (
  deps: QuantPatternsDetectProviderDeps
): Provider<typeof CAPABILITY, QuantPatternsDetectInput, QuantPatternsDetectOutput> => {
  const { config, logTarget } = deps
  const fetchImpl: FetchImpl = deps.fetchImpl ?? ((input, init) => fetch(input, init))
  const now = deps.now ?? (() => new Date())

  const health: HealthState = {
    status: config.enabled ? 'ok' : 'down',
    lastSuccessAt: null,
    lastErrorCode: config.enabled ? null : 'disabled_by_flag',
    ...(config.enabled ? {} : { note: 'quant-service disabled by flag' }),
  }

  const url = `${config.url.replace(/\/+$/, '')}/quant/patterns/detect`

  return {
    id: PROVIDER_ID,
    capability: CAPABILITY,
    call: async (
      input: QuantPatternsDetectInput,
      ctx: ProviderCallContext
    ): Promise<ProviderResult<QuantPatternsDetectOutput>> => {
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
          itemCount: candleCountOf(input),
        },
      })

      // Demo mode: deterministic, never hits the network.
      if (ctx.mode === 'demo') {
        const response = buildDemoPatternDetectionResponse(input) as Record<string, unknown>
        const retrievedAt = now().toISOString()
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
            itemCount: candleCountOf(input),
          },
        })
        return providerOk({ response, retrievedAt }, meta(Date.now() - startedAt, 0, true))
      }

      if (!config.enabled) {
        const error = createProviderError({
          code: 'disabled_by_flag',
          providerId: PROVIDER_ID,
          message: 'quant-service disabled by flag',
          capability: CAPABILITY,
          requestId: ctx.requestId,
        })
        health.status = 'down'
        health.lastErrorCode = 'disabled_by_flag'
        health.note = 'quant-service disabled by flag'
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

      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), config.timeoutMs)
        let response: Response
        try {
          response = await fetchImpl(url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-request-id': ctx.requestId,
            },
            body: JSON.stringify(input),
            signal: controller.signal,
          })
        } finally {
          clearTimeout(timer)
        }

        if (!response.ok) {
          const isServer = response.status >= 500
          const code = isServer
            ? 'transient'
            : response.status === 429
              ? 'rate_limited'
              : response.status === 404
                ? 'not_found'
                : 'provider_unavailable'
          const error = createProviderError({
            code,
            providerId: PROVIDER_ID,
            message: `quant-service responded HTTP ${response.status}`,
            capability: CAPABILITY,
            requestId: ctx.requestId,
            safeDetails: { httpStatus: response.status },
          })
          health.status = isServer ? 'degraded' : 'down'
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
              status: String(response.status),
            },
          })
          return providerErr(error, meta(Date.now() - startedAt, null, false))
        }

        const raw = (await response.json()) as Record<string, unknown>
        const retrievedAt = now().toISOString()
        health.status = 'ok'
        health.lastSuccessAt = retrievedAt
        health.lastErrorCode = null
        delete health.note

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
            itemCount: candleCountOf(input),
          },
        })

        return providerOk({ response: raw, retrievedAt }, meta(Date.now() - startedAt, 0, false))
      } catch (cause) {
        const error = normalizeProviderError(cause, {
          providerId: PROVIDER_ID,
          capability: CAPABILITY,
          requestId: ctx.requestId,
          defaultCode: 'provider_unavailable',
        })
        health.status = 'degraded'
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
    },
    getHealth: () => ({
      status: health.status,
      lastSuccessAt: health.lastSuccessAt,
      lastErrorCode: health.lastErrorCode,
      ...(health.note !== undefined ? { note: health.note } : {}),
    }),
  }
}
