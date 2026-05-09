// Macro Prompt 2 — Internal provider migration: knowledge-service context bundle.
//
// Thin Provider<C> wrapper around `KnowledgeServiceClient.contextBundle`. The wrapper is
// the canonical contract entry point for `knowledge.context_bundle.read`; the existing
// route helpers continue to use `createKnowledgeServiceClient` directly until a follow-up
// macro prompt rewires them. Public API response shapes are NOT touched in this batch.
//
// Invariants:
//  - mode='demo' refuses with `demo_mode_forbidden` (knowledge-service is admin-side).
//  - !config.enabled → `disabled_by_flag` (caller must remain fail-soft).
//  - Network / non-2xx responses → `transient` or `provider_unavailable`.
//  - The raw upstream JSON never leaves this module: only typed bundle fields surface.
//  - Every emission goes through `logProviderEvent` (closed vocab + redaction).
//  - Health is precomputed from the last call's outcome — `getHealth()` never does IO.
//
// This module performs read-only retrieval and never ingests. Graph-write capabilities are
// not part of `ALLOWED_PROVIDER_CAPABILITIES` and remain out of scope.

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
import {
  type KnowledgeContextBundleInput,
  type KnowledgeServiceClientConfig,
  KnowledgeServiceUnavailableError,
} from '../knowledge-service-client'

const PROVIDER_ID = asProviderId('knowledge-service')
const CAPABILITY = 'knowledge.context_bundle.read' as const

/**
 * Trimmed projection of a knowledge-service context-bundle response. Only fields that
 * Finance-OS owns are surfaced; everything else stays inside the upstream response and
 * never leaves the wrapper.
 */
export interface KnowledgeContextBundleOutput {
  readonly bundle: Readonly<Record<string, unknown>>
  readonly retrievedAt: string
}

/** Narrowed fetch signature so tests can inject without satisfying every browser-fetch overload. */
export type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>

export interface KnowledgeContextBundleProviderDeps {
  readonly config: KnowledgeServiceClientConfig
  readonly logTarget: ProviderLogTarget
  /** Injected fetch keeps the provider testable without monkey-patching globals. */
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

export const createKnowledgeContextBundleProvider = (
  deps: KnowledgeContextBundleProviderDeps
): Provider<typeof CAPABILITY, KnowledgeContextBundleInput, KnowledgeContextBundleOutput> => {
  const { config, logTarget } = deps
  const fetchImpl: FetchImpl = deps.fetchImpl ?? ((input, init) => fetch(input, init))
  const now = deps.now ?? (() => new Date())

  const health: HealthState = {
    status: config.enabled ? 'ok' : 'down',
    lastSuccessAt: null,
    lastErrorCode: config.enabled ? null : 'disabled_by_flag',
    ...(config.enabled ? {} : { note: 'knowledge service disabled by flag' }),
  }

  const baseUrl = config.url.replace(/\/+$/, '')

  return {
    id: PROVIDER_ID,
    capability: CAPABILITY,
    call: async (
      input: KnowledgeContextBundleInput,
      ctx: ProviderCallContext
    ): Promise<ProviderResult<KnowledgeContextBundleOutput>> => {
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
        },
      })

      if (ctx.mode === 'demo') {
        const error = createProviderError({
          code: 'demo_mode_forbidden',
          providerId: PROVIDER_ID,
          message: 'knowledge-service is admin-only',
          capability: CAPABILITY,
          requestId: ctx.requestId,
        })
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

      if (!config.enabled) {
        const error = createProviderError({
          code: 'disabled_by_flag',
          providerId: PROVIDER_ID,
          message: 'knowledge-service disabled by feature flag',
          capability: CAPABILITY,
          requestId: ctx.requestId,
        })
        health.status = 'down'
        health.lastErrorCode = 'disabled_by_flag'
        health.note = 'knowledge service disabled by flag'
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

      const body = {
        ...input,
        maxTokens: input.maxTokens ?? config.maxContextTokens,
        maxPathDepth: input.maxPathDepth ?? config.maxPathDepth,
        retrievalMode: input.retrievalMode ?? config.retrievalMode,
        filters: {
          minConfidence: config.minConfidence,
          ...(input.filters ?? {}),
        },
      }

      const url = `${baseUrl}/knowledge/context-bundle`

      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), config.timeoutMs)
        let response: Response
        try {
          response = await fetchImpl(url, {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
              'x-request-id': ctx.requestId,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          })
        } finally {
          clearTimeout(timer)
        }

        if (!response.ok) {
          const isServer = response.status >= 500
          const code = isServer
            ? 'transient'
            : response.status === 401 || response.status === 403
              ? 'auth_failed'
              : response.status === 404
                ? 'not_found'
                : response.status === 429
                  ? 'rate_limited'
                  : 'provider_unavailable'
          const error = createProviderError({
            code,
            providerId: PROVIDER_ID,
            message: `knowledge-service responded HTTP ${response.status}`,
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
        const output: KnowledgeContextBundleOutput = { bundle: raw, retrievedAt }

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
            durationMs: Date.now() - startedAt,
            cacheStatus: 'miss',
            freshnessMinutes: 0,
          },
        })

        return providerOk(output, meta(Date.now() - startedAt, 0, false))
      } catch (cause) {
        const isUnavailable = cause instanceof KnowledgeServiceUnavailableError
        const error = normalizeProviderError(cause, {
          providerId: PROVIDER_ID,
          capability: CAPABILITY,
          requestId: ctx.requestId,
          defaultCode: isUnavailable ? 'provider_unavailable' : 'transient',
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
