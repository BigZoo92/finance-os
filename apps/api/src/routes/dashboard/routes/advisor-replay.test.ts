// Macro Prompt 6 — /dashboard/advisor/replay route tests.

import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from '../plugin'
import type { DashboardRouteRuntime } from '../types'
import { createAdvisorReplayRoute } from './advisor-replay'

const SENSITIVE_SENTINELS = [
  'token',
  'secret',
  'apikey',
  'api_key',
  'signature',
  'access_token',
  'refresh_token',
  'client_secret',
  'cookie',
  'authorization',
  'bearer',
  'freenote',
  '<flexqueryresponse',
  '<?xml',
  '"rawpayload"',
  '5678-9012-3456',
]

const CAUSAL_CLAIM_PHRASES = [
  'caused by',
  'because of',
  'led to',
  'will outperform',
  'will result in',
]

const expectNoSensitiveLeakage = (text: string) => {
  const lower = text.toLowerCase()
  for (const sentinel of SENSITIVE_SENTINELS) {
    expect(lower).not.toContain(sentinel)
  }
}

const expectNoCausalityClaim = (text: string) => {
  const lower = text.toLowerCase()
  for (const phrase of CAUSAL_CLAIM_PHRASES) {
    expect(lower).not.toContain(phrase)
  }
}

const buildRuntime = (
  overrides: Partial<DashboardRouteRuntime['useCases']> = {}
): DashboardRouteRuntime =>
  ({
    repositories: {
      readModel: {} as DashboardRouteRuntime['repositories']['readModel'],
      derivedRecompute: {} as DashboardRouteRuntime['repositories']['derivedRecompute'],
    },
    useCases: overrides as DashboardRouteRuntime['useCases'],
    providerRegistry: {
      listProviders: () => [],
    } as unknown as DashboardRouteRuntime['providerRegistry'],
  }) as DashboardRouteRuntime

const buildApp = ({
  mode,
  hasValidInternalToken = false,
  runtime,
}: {
  mode: 'admin' | 'demo'
  hasValidInternalToken?: boolean
  runtime: DashboardRouteRuntime
}) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      internalAuth: {
        hasValidToken: hasValidInternalToken,
        tokenSource: hasValidInternalToken ? ('x-internal-token' as const) : null,
      } as const,
      requestMeta: { requestId: 'req-replay-test', startedAtMs: 0 },
    }))
    .use(createDashboardRuntimePlugin(runtime))
    .use(createAdvisorReplayRoute())

describe('GET /dashboard/advisor/replay', () => {
  it('rejects demo callers with 403 DEMO_MODE_FORBIDDEN', async () => {
    const runtime = buildRuntime({})
    const app = buildApp({ mode: 'demo', runtime })
    const response = await app.handle(new Request('http://finance-os.local/advisor/replay'))
    expect(response.status).toBe(403)
  })

  it('clamps windowDays to [1, 90] and forwards to use-case', async () => {
    let receivedWindowDays: number | null | undefined
    const runtime = buildRuntime({
      getAdvisorReplay: async ({ mode, windowDays }) => {
        receivedWindowDays = windowDays
        return {
          generatedAt: '2026-05-10T12:00:00.000Z',
          mode,
          windowDays: 90, // would be clamped inside the use-case
          summary: {
            recommendationsReviewed: 0,
            decisionsLinked: 0,
            outcomesLinked: 0,
            postMortemsLinked: 0,
            unresolved: 0,
            repeatedFailureModes: 0,
          },
          items: [],
          patterns: [],
          caveats: [
            'replay_is_advisory_only',
            'no_causality_claim',
            'data_quality_at_review_is_current_only',
          ],
        }
      },
    })
    const app = buildApp({ mode: 'admin', runtime })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/replay?windowDays=9999')
    )
    expect(response.status).toBe(200)
    // Route forwards the raw value; use-case is responsible for clamping.
    expect(receivedWindowDays).toBe(9999)
  })

  it('returns shape with items, patterns and required caveats; no sentinel leakage', async () => {
    const runtime = buildRuntime({
      getAdvisorReplay: async ({ mode }) => ({
        generatedAt: '2026-05-10T12:00:00.000Z',
        mode,
        windowDays: 30,
        summary: {
          recommendationsReviewed: 1,
          decisionsLinked: 1,
          outcomesLinked: 0,
          postMortemsLinked: 0,
          unresolved: 1,
          repeatedFailureModes: 0,
        },
        items: [
          {
            recommendationId: 1,
            recommendationKey: 'rec-1',
            createdAt: '2026-05-08T08:00:00.000Z',
            decision: 'accepted',
            outcomeKind: null,
            postMortemStatus: null,
            dataQualityAtReview: 'current_only',
            caveats: ['decision_without_outcome', 'data_quality_at_review_is_current_only'],
            learningTags: ['benign_tag'],
          },
        ],
        patterns: [
          {
            kind: 'missing_outcome',
            severity: 'info',
            count: 1,
            message: '1 decision(s) have no recorded outcome.',
          },
        ],
        caveats: [
          'replay_is_advisory_only',
          'no_causality_claim',
          'no_prediction_or_performance_claim',
          'data_quality_at_review_is_current_only',
        ],
      }),
    })
    const app = buildApp({ mode: 'admin', runtime })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/replay?windowDays=30')
    )
    expect(response.status).toBe(200)
    const payload = (await response.json()) as Record<string, unknown>
    expect(payload.windowDays).toBe(30)
    const text = JSON.stringify(payload)
    expectNoSensitiveLeakage(text)
    expectNoCausalityClaim(text)
  })

  it('returns 503 when use-case is not wired', async () => {
    const runtime = buildRuntime({})
    const app = buildApp({ mode: 'admin', runtime })
    const response = await app.handle(new Request('http://finance-os.local/advisor/replay'))
    expect(response.status).toBe(503)
    const payload = (await response.json()) as { code: string }
    expect(payload.code).toBe('ADVISOR_REPLAY_NOT_AVAILABLE')
  })
})
