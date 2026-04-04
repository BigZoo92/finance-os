import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { getDashboardDerivedRecomputeStatusMock } from '../../../mocks/dashboardDerivedRecompute.mock'
import {
  DashboardDerivedRecomputeAlreadyRunningError,
  DashboardDerivedRecomputeDisabledError,
} from '../domain/derived-recompute'
import { createDashboardRuntimePlugin } from '../plugin'
import { createDerivedRecomputeRoute } from './derived-recompute'
import type { DashboardDerivedRecomputeStatusResponse, DashboardRouteRuntime } from '../types'

const createDerivedRecomputePayload = () => ({
  featureEnabled: true,
  state: 'completed' as const,
  currentSnapshot: {
    snapshotVersion: 'derived-20260326T101500Z',
    finishedAt: '2026-03-26T10:15:18.000Z',
    rowCounts: {
      rawTransactionCount: 24,
      transactionMatchedCount: 24,
      transactionUpdatedCount: 4,
      transactionUnchangedCount: 20,
      transactionSkippedCount: 0,
      rawImportTimestampUpdatedCount: 1,
      snapshotRowCount: 24,
    },
  },
  latestRun: {
    snapshotVersion: 'derived-20260326T101500Z',
    status: 'completed' as const,
    triggerSource: 'admin' as const,
    requestId: 'req-derived-test',
    stage: 'completed',
    rowCounts: {
      rawTransactionCount: 24,
      transactionMatchedCount: 24,
      transactionUpdatedCount: 4,
      transactionUnchangedCount: 20,
      transactionSkippedCount: 0,
      rawImportTimestampUpdatedCount: 1,
      snapshotRowCount: 24,
    },
    safeErrorCode: null,
    safeErrorMessage: null,
    startedAt: '2026-03-26T10:15:00.000Z',
    finishedAt: '2026-03-26T10:15:18.000Z',
    durationMs: 18000,
  },
})

const createDashboardRuntime = (
  overrides?: Partial<DashboardRouteRuntime['useCases']>
): DashboardRouteRuntime => {
  const payload = createDerivedRecomputePayload()

  return {
    repositories: {
      readModel: {} as DashboardRouteRuntime['repositories']['readModel'],
      derivedRecompute: {} as DashboardRouteRuntime['repositories']['derivedRecompute'],
    },
    useCases: {
      getSummary: async () => {
        throw new Error('not used in derived recompute tests')
      },
      getTransactions: async () => {
        throw new Error('not used in derived recompute tests')
      },
      requestTransactionsBackgroundRefresh: async () => {
        throw new Error('not used in derived recompute tests')
      },
      updateTransactionClassification: async () => {
        throw new Error('not used in derived recompute tests')
      },
      getGoals: async () => ({
        items: [],
      }),
      createGoal: async () => {
        throw new Error('not used in derived recompute tests')
      },
      updateGoal: async () => {
        throw new Error('not used in derived recompute tests')
      },
      archiveGoal: async () => null,
      getDerivedRecomputeStatus: async () => payload,
      runDerivedRecompute: async () => payload,
      ...overrides,
    },
  }
}

const createDerivedRecomputeTestApp = ({
  mode,
  hasValidInternalToken,
  runtime,
}: {
  mode: 'admin' | 'demo'
  hasValidInternalToken: boolean
  runtime?: DashboardRouteRuntime
}) => {
  return new Elysia()
    .derive(() => ({
      auth: {
        mode,
      } as const,
      internalAuth: {
        hasValidToken: hasValidInternalToken,
        tokenSource: hasValidInternalToken ? 'x-internal-token' : null,
      } as const,
      requestMeta: {
        requestId: 'req-derived-test',
        startedAtMs: 0,
      },
    }))
    .use(createDashboardRuntimePlugin(runtime ?? createDashboardRuntime()))
    .use(createDerivedRecomputeRoute())
}

describe('createDerivedRecomputeRoute', () => {
  it('returns deterministic demo status without calling the real use case', async () => {
    let getStatusCalls = 0
    const app = createDerivedRecomputeTestApp({
      mode: 'demo',
      hasValidInternalToken: false,
      runtime: createDashboardRuntime({
        getDerivedRecomputeStatus: async () => {
          getStatusCalls += 1
          return createDerivedRecomputePayload()
        },
      }),
    })

    const response = await app.handle(new Request('http://finance-os.local/derived-recompute'))
    const payload = (await response.json()) as DashboardDerivedRecomputeStatusResponse

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(payload).toEqual(getDashboardDerivedRecomputeStatusMock())
    expect(getStatusCalls).toBe(0)
  })

  it('allows the real status path through with a valid internal token', async () => {
    let getStatusCalls = 0
    const app = createDerivedRecomputeTestApp({
      mode: 'demo',
      hasValidInternalToken: true,
      runtime: createDashboardRuntime({
        getDerivedRecomputeStatus: async () => {
          getStatusCalls += 1
          return createDerivedRecomputePayload()
        },
      }),
    })

    const response = await app.handle(new Request('http://finance-os.local/derived-recompute'))
    const payload = (await response.json()) as DashboardDerivedRecomputeStatusResponse

    expect(response.status).toBe(200)
    expect(payload.currentSnapshot?.snapshotVersion).toBe('derived-20260326T101500Z')
    expect(getStatusCalls).toBe(1)
  })

  it('blocks recompute execution in demo mode with the safe error shape', async () => {
    const app = createDerivedRecomputeTestApp({
      mode: 'demo',
      hasValidInternalToken: false,
    })

    const response = await app.handle(
      new Request('http://finance-os.local/derived-recompute', {
        method: 'POST',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload).toEqual({
      ok: false,
      code: 'DEMO_MODE_FORBIDDEN',
      message: 'Admin session required',
      requestId: 'req-derived-test',
    })
  })

  it('returns 409 when another recompute is already running', async () => {
    const app = createDerivedRecomputeTestApp({
      mode: 'admin',
      hasValidInternalToken: false,
      runtime: createDashboardRuntime({
        runDerivedRecompute: async ({ requestId }) => {
          throw new DashboardDerivedRecomputeAlreadyRunningError(requestId)
        },
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/derived-recompute', {
        method: 'POST',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload).toEqual({
      ok: false,
      code: 'DERIVED_RECOMPUTE_RUNNING',
      message: 'Derived recompute already in progress',
      requestId: 'req-derived-test',
    })
  })

  it('returns 503 when the recompute feature flag is disabled', async () => {
    const app = createDerivedRecomputeTestApp({
      mode: 'admin',
      hasValidInternalToken: false,
      runtime: createDashboardRuntime({
        runDerivedRecompute: async ({ requestId }) => {
          throw new DashboardDerivedRecomputeDisabledError(requestId)
        },
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/derived-recompute', {
        method: 'POST',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toEqual({
      ok: false,
      code: 'DERIVED_RECOMPUTE_DISABLED',
      message: 'Derived recompute is disabled by runtime flag',
      requestId: 'req-derived-test',
    })
  })
})
