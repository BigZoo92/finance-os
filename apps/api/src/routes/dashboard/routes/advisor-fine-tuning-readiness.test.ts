// Macro Prompt 6 — /dashboard/advisor/fine-tuning-readiness route tests.

import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from '../plugin'
import type { DashboardRouteRuntime } from '../types'
import { createAdvisorFineTuningReadinessRoute } from './advisor-fine-tuning-readiness'

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
      requestMeta: { requestId: 'req-finetune-test', startedAtMs: 0 },
    }))
    .use(createDashboardRuntimePlugin(runtime))
    .use(createAdvisorFineTuningReadinessRoute())

describe('GET /dashboard/advisor/fine-tuning-readiness', () => {
  it('rejects demo callers with 403 DEMO_MODE_FORBIDDEN', async () => {
    const runtime = buildRuntime({})
    const app = buildApp({ mode: 'demo', runtime })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/fine-tuning-readiness')
    )
    expect(response.status).toBe(403)
  })

  it('returns admin response with closed-vocabulary level and blockers', async () => {
    const runtime = buildRuntime({
      getAdvisorFineTuningReadiness: async ({ mode }) => ({
        generatedAt: '2026-05-10T12:00:00.000Z',
        mode,
        ready: false,
        level: 'not_recommended',
        reasons: ['eval_case_count_below_threshold:3/25'],
        blockers: [
          'privacy_export_plan_not_accepted',
          'measurable_improvement_target_missing',
          'rollback_plan_missing',
        ],
        requiredBeforeConsidering: ['accept_privacy_export_plan'],
        safeAlternatives: [
          'prompt_template_versioning',
          'deterministic_eval_expansion',
          'retrieval_context_improvement',
          'post_mortem_review',
          'data_quality_improvement',
        ],
        caveats: [
          'gate_does_not_perform_fine_tuning',
          'gate_does_not_export_data',
          'gate_does_not_call_a_model',
        ],
      }),
    })
    const app = buildApp({ mode: 'admin', runtime })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/fine-tuning-readiness')
    )
    expect(response.status).toBe(200)
    const payload = (await response.json()) as Record<string, unknown>
    expect(payload.level).toBe('not_recommended')
    expect(payload.ready).toBe(false)

    const text = JSON.stringify(payload).toLowerCase()
    expect(text).not.toContain('freenote')
    expect(text).not.toContain('apikey')
    expect(text).not.toContain('rawpayload')
    expect(text).not.toContain('iban')
  })

  it('returns 503 when the gate use-case is not wired', async () => {
    const runtime = buildRuntime({})
    const app = buildApp({ mode: 'admin', runtime })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/fine-tuning-readiness')
    )
    expect(response.status).toBe(503)
    const payload = (await response.json()) as { code: string }
    expect(payload.code).toBe('FINE_TUNING_READINESS_NOT_AVAILABLE')
  })
})
