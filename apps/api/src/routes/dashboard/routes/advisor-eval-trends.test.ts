import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import type { DashboardAdvisorEvalTrendsResponse } from '../advisor-contract'
import { createDashboardRuntimePlugin } from '../plugin'
import type { DashboardRouteRuntime } from '../types'
import { createAdvisorRoute } from './advisor'

interface TrendsCalls {
  count: number
  lastInput: { mode: 'admin' | 'demo'; requestId: string; windowDays?: number | null } | null
}

const buildTrendsRuntime = ({
  mode,
  calls,
  override,
}: {
  mode: 'admin' | 'demo'
  calls?: TrendsCalls
  override?: Partial<DashboardRouteRuntime['useCases']>
}): DashboardRouteRuntime => {
  const callsRef: TrendsCalls = calls ?? { count: 0, lastInput: null }
  const sample: DashboardAdvisorEvalTrendsResponse = {
    generatedAt: '2026-05-01T09:00:00.000Z',
    mode,
    windowDays: 30,
    groups: [
      {
        group: 'quality',
        totalRuns: 2,
        latestPassRate: 1,
        previousPassRate: 0.5,
        delta: 0.5,
        categories: [
          {
            category: 'causal_reasoning',
            totalRuns: 2,
            latest: {
              runId: '22',
              createdAt: '2026-05-01T08:00:00.000Z',
              passRate: 1,
              passed: 4,
              failed: 0,
              skipped: 0,
              failedCaseKeys: [],
            },
            previous: {
              runId: '21',
              createdAt: '2026-04-30T08:00:00.000Z',
              passRate: 0.5,
            },
            delta: 0.5,
            status: 'improving',
          },
        ],
      },
      { group: 'safety', totalRuns: 0, latestPassRate: null, previousPassRate: null, delta: null, categories: [] },
      {
        group: 'economics',
        totalRuns: 0,
        latestPassRate: null,
        previousPassRate: null,
        delta: null,
        categories: [],
      },
    ],
    caveats: [
      'Tendances calculées à partir des evals déterministes uniquement. Aucune affirmation de profitabilité ou de prédictivité.',
    ],
  }
  return {
    repositories: {} as unknown as DashboardRouteRuntime['repositories'],
    useCases: {
      getAdvisorEvalsTrends: async input => {
        callsRef.count += 1
        callsRef.lastInput = {
          mode: input.mode,
          requestId: input.requestId,
          windowDays: input.windowDays ?? null,
        }
        return { ...sample, mode: input.mode, windowDays: input.windowDays ?? 30 }
      },
      ...(override ?? {}),
    } as unknown as DashboardRouteRuntime['useCases'],
  }
}

const buildTrendsApp = ({
  mode,
  runtime,
}: {
  mode: 'admin' | 'demo'
  runtime: DashboardRouteRuntime
}) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      internalAuth: { hasValidToken: false, tokenSource: null },
      requestMeta: { requestId: 'req-trends-test', startedAtMs: Date.now() },
    }))
    .use(createDashboardRuntimePlugin(runtime))
    .use(
      createAdvisorRoute({
        advisorEnabled: true,
        adminOnly: false,
        knowledgeServiceEnabled: false,
        knowledgeServiceUrl: 'http://127.0.0.1:0',
        knowledgeServiceTimeoutMs: 1000,
        graphIngestEnabled: false,
        aiBudgetDailyUsd: 0,
        aiBudgetMonthlyUsd: 0,
        aiBudgetDisableChallengerRatio: 1,
        aiBudgetDisableDeepAnalysisRatio: 1,
        aiUsdToEurRate: 0.92,
        aiAdvisorForceLocalOnly: true,
        aiPostMortemEnabled: false,
        aiPostMortemHorizonDays: 30,
        aiPostMortemBatchLimit: 1,
        aiPostMortemModel: 'claude-sonnet-4-6',
      } as unknown as Parameters<typeof createAdvisorRoute>[0])
    )

describe('createAdvisorRoute · GET /advisor/evals/trends', () => {
  it('returns trends payload in admin mode and forwards windowDays', async () => {
    const calls: TrendsCalls = { count: 0, lastInput: null }
    const runtime = buildTrendsRuntime({ mode: 'admin', calls })
    const app = buildTrendsApp({ mode: 'admin', runtime })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/evals/trends?windowDays=14')
    )
    expect(response.status).toBe(200)
    const payload = (await response.json()) as DashboardAdvisorEvalTrendsResponse
    expect(payload.mode).toBe('admin')
    expect(payload.windowDays).toBe(14)
    expect(payload.groups.map(g => g.group)).toEqual(['quality', 'safety', 'economics'])
    expect(calls.count).toBe(1)
    expect(calls.lastInput?.windowDays).toBe(14)
  })

  it('returns trends payload in demo mode with mode=demo', async () => {
    const calls: TrendsCalls = { count: 0, lastInput: null }
    const runtime = buildTrendsRuntime({ mode: 'demo', calls })
    const app = buildTrendsApp({ mode: 'demo', runtime })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/evals/trends')
    )
    expect(response.status).toBe(200)
    const payload = (await response.json()) as DashboardAdvisorEvalTrendsResponse
    expect(payload.mode).toBe('demo')
    expect(calls.count).toBe(1)
    expect(calls.lastInput?.windowDays).toBeNull()
  })

  it('rejects windowDays > 90 via query schema (no use-case call)', async () => {
    const calls: TrendsCalls = { count: 0, lastInput: null }
    const runtime = buildTrendsRuntime({ mode: 'admin', calls })
    const app = buildTrendsApp({ mode: 'admin', runtime })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/evals/trends?windowDays=120')
    )
    expect(response.status).toBe(422)
    expect(calls.count).toBe(0)
  })

  it('returns 503 when the use-case is not wired', async () => {
    const runtime: DashboardRouteRuntime = {
      repositories: {} as unknown as DashboardRouteRuntime['repositories'],
      useCases: {} as unknown as DashboardRouteRuntime['useCases'],
    }
    const app = buildTrendsApp({ mode: 'admin', runtime })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/evals/trends')
    )
    expect(response.status).toBe(503)
  })
})
