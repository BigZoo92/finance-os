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
      ...overrides,
    },
  }) as unknown as DashboardRouteRuntime

const createApp = ({
  mode,
  runtime,
}: {
  mode: 'admin' | 'demo'
  runtime?: DashboardRouteRuntime
}) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      internalAuth: {
        hasValidToken: false,
        tokenSource: null,
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
    const payload = (await response.json()) as { mode: string; latestRun: unknown; jobs: Array<{ id: string }> }

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

  it('triggers the unified orchestrator in admin mode', async () => {
    const triggerSources: string[] = []
    const app = createApp({
      mode: 'admin',
      runtime: createRuntime({
        runAdvisorManualRefreshAndAnalysis: async input => {
          triggerSources.push(input.triggerSource)
          return {
            ok: true,
            requestId: input.requestId,
            alreadyRunning: false,
            operation: {
              operationId: 'manual-op-1',
              status: 'queued',
              triggerSource: input.triggerSource,
              requestId: input.requestId,
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
          }
        },
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/ops/refresh/all', {
        method: 'POST',
      })
    )
    const payload = (await response.json()) as { ok: boolean; operation: { operationId: string } }

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.operation.operationId).toBe('manual-op-1')
    expect(triggerSources).toEqual(['manual-global'])
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
})
