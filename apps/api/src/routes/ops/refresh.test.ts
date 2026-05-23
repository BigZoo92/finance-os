import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createOpsRefreshRoute } from './refresh'
import type { DashboardRouteRuntime } from '../dashboard/types'

const config = {
  externalInvestmentsEnabled: true,
  ibkrFlexEnabled: true,
  binanceSpotEnabled: true,
  newsEnabled: true,
  marketsEnabled: true,
  advisorEnabled: true,
  socialEnabled: false,
}

const createRuntime = (
  overrides?: Partial<DashboardRouteRuntime['useCases']>
): DashboardRouteRuntime =>
  ({
    repositories: {},
    useCases: {
      runAdvisorManualRefreshAndAnalysis: async () => ({
        ok: true,
        requestId: 'req-ops-test',
        alreadyRunning: false,
        operation: {
          operationId: 'manual-op-1',
          status: 'queued',
          triggerSource: 'manual-global',
          requestId: 'req-ops-test',
          currentStage: null,
          statusMessage: null,
          startedAt: '2026-05-03T00:00:00.000Z',
          finishedAt: null,
          durationMs: null,
          degraded: false,
          errorCode: null,
          errorMessage: null,
          advisorRunId: null,
          advisorRun: null,
          steps: [],
          outputDigest: null,
        },
      }),
      requestTransactionsBackgroundRefresh: async () => true,
      runDerivedRecompute: async () => ({
        featureEnabled: true,
        state: 'completed',
        currentSnapshot: null,
        latestRun: null,
      }),
      triggerExternalInvestmentProviderSync: async () => undefined,
      generateExternalInvestmentContextBundle: async () => ({
        generatedAt: '2026-05-03T00:00:00.000Z',
      }),
      ingestNews: async () => ({ inserted: 1, updated: 0, skipped: 0 }),
      getNewsContextBundle: async () => ({
        generatedAt: '2026-05-03T00:00:00.000Z',
        range: '7d',
        topSignals: [],
        stale: false,
        degraded: false,
      }),
      refreshMarkets: async () => ({
        providerResults: [],
        quoteCount: 1,
        macroObservationCount: 1,
        signalCount: 1,
      }),
      reviewDueInvestmentHypotheses: async () => ({
        reviewedCount: 0,
        dueCount: 0,
        calibration: null,
      }),
      generateInvestmentPlan: async () => ({
        plan: { items: [], warnings: [] },
        warnings: [],
        hypotheses: [],
      }),
      runAdvisorDaily: async () => ({
        run: {
          id: 'advisor-run-1',
          status: 'completed',
          fallbackReason: null,
        },
      }),
      ...overrides,
    },
  }) as unknown as DashboardRouteRuntime

const createApp = ({
  mode,
  runtime,
  internalToken = false,
}: {
  mode: 'admin' | 'demo'
  runtime?: DashboardRouteRuntime
  internalToken?: boolean
}) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      internalAuth: {
        hasValidToken: internalToken,
        tokenSource: internalToken ? ('x-internal-token' as const) : null,
      } as const,
      requestMeta: {
        requestId: 'req-ops-test',
        startedAtMs: 0,
      },
    }))
    .use(createOpsRefreshRoute({ runtime: runtime ?? createRuntime(), config }))

describe('createOpsRefreshRoute', () => {
  it('returns deterministic job metadata in demo mode without triggering providers', async () => {
    const app = createApp({
      mode: 'demo',
      runtime: createRuntime({
        runAdvisorManualRefreshAndAnalysis: async () => {
          throw new Error('must not be called')
        },
      }),
    })

    const response = await app.handle(new Request('http://finance-os.local/ops/refresh/status'))
    const payload = (await response.json()) as {
      mode: string
      latestRun: unknown
      jobs: Array<{ id: string }>
    }

    expect(response.status).toBe(200)
    expect(payload.mode).toBe('demo')
    expect(payload.latestRun).toBeNull()
    expect(payload.jobs.map(job => job.id)).toContain('powens')
  })

  it('blocks manual global trigger in demo mode', async () => {
    const app = createApp({ mode: 'demo' })

    const response = await app.handle(
      new Request('http://finance-os.local/ops/refresh/all', {
        method: 'POST',
      })
    )
    const payload = (await response.json()) as { code: string; requestId: string }

    expect(response.status).toBe(403)
    expect(payload.code).toBe('DEMO_MODE_FORBIDDEN')
    expect(payload.requestId).toBe('req-ops-test')
  })

  it('accepts POST /ops/refresh/all when only a valid internal token is supplied (worker → API path)', async () => {
    const app = createApp({ mode: 'demo', internalToken: true })

    const response = await app.handle(
      new Request('http://finance-os.local/ops/refresh/all', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trigger: 'scheduled', runKind: 'night', dryRun: true }),
      })
    )
    const payload = (await response.json()) as {
      ok: boolean
      status: string
      dryRun: boolean
    }

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.status).toBe('planned')
    expect(payload.dryRun).toBe(true)
  })

  it('executes the topological refresh plan in admin mode', async () => {
    const calls: string[] = []
    const app = createApp({
      mode: 'admin',
      runtime: createRuntime({
        requestTransactionsBackgroundRefresh: async () => {
          calls.push('powens')
          return true
        },
        runDerivedRecompute: async () => {
          calls.push('transactions-categorization')
          return {
            featureEnabled: true,
            state: 'completed',
            currentSnapshot: null,
            latestRun: null,
          }
        },
        reviewDueInvestmentHypotheses: async () => {
          calls.push('investment-learning-review')
          return {
            reviewedCount: 1,
            dueCount: 1,
            calibration: null,
          }
        },
        generateInvestmentPlan: async () => {
          calls.push('investment-action-plan')
          return {
            plan: { items: [{}], warnings: [] },
            warnings: [],
            hypotheses: [{}],
          }
        },
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/ops/refresh/all', {
        method: 'POST',
      })
    )
    const payload = (await response.json()) as {
      ok: boolean
      status: string
      jobs: Array<{ jobId: string; status: string }>
    }

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.status).toBe('success')
    expect(payload.jobs.map(job => job.jobId)).toContain('powens')
    expect(calls.indexOf('powens')).toBeLessThan(calls.indexOf('transactions-categorization'))
    expect(calls).toContain('investment-learning-review')
    expect(calls).toContain('investment-action-plan')
    expect(calls.indexOf('investment-learning-review')).toBeLessThan(
      calls.indexOf('investment-action-plan')
    )
  })

  it('supports a dry-run plan without executing jobs', async () => {
    let refreshCalls = 0
    const app = createApp({
      mode: 'admin',
      runtime: createRuntime({
        requestTransactionsBackgroundRefresh: async () => {
          refreshCalls += 1
          return true
        },
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/ops/refresh/all', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trigger: 'scheduled', runKind: 'night', dryRun: true }),
      })
    )
    const payload = (await response.json()) as {
      status: string
      dryRun: boolean
      jobs: Array<{ jobId: string; status: string }>
    }

    expect(response.status).toBe(200)
    expect(payload.status).toBe('planned')
    expect(payload.dryRun).toBe(true)
    expect(payload.jobs.find(job => job.jobId === 'powens')?.status).toBe('pending')
    expect(payload.jobs.find(job => job.jobId === 'investment-learning-review')?.status).toBe(
      'pending'
    )
    expect(payload.jobs.find(job => job.jobId === 'investment-action-plan')?.status).toBe(
      'pending'
    )
    expect(refreshCalls).toBe(0)
  })

  it('triggers an individual job in admin mode', async () => {
    let refreshCalls = 0
    const app = createApp({
      mode: 'admin',
      runtime: createRuntime({
        requestTransactionsBackgroundRefresh: async () => {
          refreshCalls += 1
          return true
        },
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/ops/refresh/jobs/powens/run', {
        method: 'POST',
      })
    )
    const payload = (await response.json()) as { jobId: string; status: string }

    expect(response.status).toBe(200)
    expect(payload.jobId).toBe('powens')
    expect(payload.status).toBe('queued')
    expect(refreshCalls).toBe(1)
  })

  it('POST /ops/refresh/stale-runs/recover calls the use case and returns the post-update payload', async () => {
    let receivedStaleAfterMs: number | undefined
    const fakeOperation = {
      operationId: 'manual-op-stale',
      requestId: 'req-recovered',
      status: 'failed' as const,
      currentStage: null,
      statusMessage: null,
      triggerSource: 'cron',
      startedAt: '2026-05-03T00:00:00.000Z',
      finishedAt: '2026-05-03T01:00:00.000Z',
      durationMs: 3_600_000,
      degraded: true,
      errorCode: 'STALE_TIMED_OUT',
      errorMessage: 'Run did not finalize within 30 minutes; marked stale.',
      advisorRunId: null,
      advisorRun: null,
      steps: [],
      outputDigest: null,
    }
    const app = createApp({
      mode: 'admin',
      runtime: createRuntime({
        recoverStaleAdvisorManualOperations: async ({ staleAfterMs }) => {
          receivedStaleAfterMs = staleAfterMs
          return { recovered: [fakeOperation], skipped: [] }
        },
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/ops/refresh/stale-runs/recover', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ staleAfterMs: 600_000 }),
      })
    )
    const payload = (await response.json()) as {
      ok: boolean
      recoveredCount: number
      recovered: Array<{ operationId: string; errorCode: string }>
    }

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.recoveredCount).toBe(1)
    expect(payload.recovered[0]?.errorCode).toBe('STALE_TIMED_OUT')
    expect(receivedStaleAfterMs).toBe(600_000)
  })

  it('POST /ops/refresh/stale-runs/recover falls back to listing stale candidates when no use case is wired', async () => {
    const stillRunning = {
      operationId: 'manual-op-stuck',
      requestId: 'req-stuck',
      status: 'running' as const,
      currentStage: null,
      statusMessage: null,
      triggerSource: 'cron',
      startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      finishedAt: null,
      durationMs: null,
      degraded: false,
      errorCode: null,
      errorMessage: null,
      advisorRunId: null,
      advisorRun: null,
      steps: [],
      outputDigest: null,
    }
    // Intentionally omit recoverStaleAdvisorManualOperations from overrides so
    // the runtime hook is undefined and the route takes the fallback path.
    const app = createApp({
      mode: 'admin',
      runtime: createRuntime({
        listAdvisorManualOperations: async () => [stillRunning],
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/ops/refresh/stale-runs/recover', {
        method: 'POST',
      })
    )
    const payload = (await response.json()) as {
      ok: boolean
      recoveredCount: number
      skippedCount: number
      warning?: string
    }

    expect(response.status).toBe(200)
    expect(payload.recoveredCount).toBe(0)
    expect(payload.skippedCount).toBe(1)
    expect(payload.warning).toBeDefined()
  })

  it('POST /ops/refresh/runs/:runId/cancel calls the use case and returns the cancelled operation', async () => {
    let receivedOperationId: string | undefined
    const cancelledOperation = {
      operationId: 'manual-op-cancel',
      requestId: 'req-cancel',
      status: 'failed' as const,
      currentStage: null,
      statusMessage: null,
      triggerSource: 'manual',
      startedAt: '2026-05-03T00:00:00.000Z',
      finishedAt: '2026-05-03T00:05:00.000Z',
      durationMs: 300_000,
      degraded: true,
      errorCode: 'CANCELLED',
      errorMessage: 'Cancelled via /ops/refresh/runs/:runId/cancel.',
      advisorRunId: null,
      advisorRun: null,
      steps: [],
      outputDigest: null,
    }
    const app = createApp({
      mode: 'admin',
      runtime: createRuntime({
        cancelAdvisorManualOperation: async ({ operationId }) => {
          receivedOperationId = operationId
          return cancelledOperation
        },
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/ops/refresh/runs/manual-op-cancel/cancel', {
        method: 'POST',
      })
    )
    const payload = (await response.json()) as {
      ok: boolean
      run: { operationId: string; errorCode: string }
    }

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.run.errorCode).toBe('CANCELLED')
    expect(receivedOperationId).toBe('manual-op-cancel')
  })

  it('POST /ops/refresh/runs/:runId/cancel returns 404 when use case returns null (run absent)', async () => {
    const app = createApp({
      mode: 'admin',
      runtime: createRuntime({
        cancelAdvisorManualOperation: async () => null,
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/ops/refresh/runs/missing-run/cancel', {
        method: 'POST',
      })
    )
    const payload = (await response.json()) as { ok: boolean; code: string }

    expect(response.status).toBe(404)
    expect(payload.code).toBe('REFRESH_RUN_NOT_FOUND')
  })

  it('demo mode blocks both stale-runs/recover and runs/:id/cancel', async () => {
    const app = createApp({ mode: 'demo' })

    const recoverResponse = await app.handle(
      new Request('http://finance-os.local/ops/refresh/stale-runs/recover', {
        method: 'POST',
      })
    )
    expect(recoverResponse.status).toBe(403)

    const cancelResponse = await app.handle(
      new Request('http://finance-os.local/ops/refresh/runs/manual-op/cancel', {
        method: 'POST',
      })
    )
    expect(cancelResponse.status).toBe(403)
  })
})
