import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { getDashboardGoalsMock } from '../../../mocks/dashboardGoals.mock'
import { createDashboardRuntimePlugin } from '../plugin'
import { createGoalsRoute } from './goals'
import type { DashboardGoalResponse, DashboardRouteRuntime } from '../types'

const createGoalPayload = (): DashboardGoalResponse => ({
  id: 91,
  name: 'Emergency runway',
  goalType: 'emergency_fund',
  currency: 'EUR',
  targetAmount: 12000,
  currentAmount: 8400,
  targetDate: '2026-09-30',
  note: 'Six months of fixed expenses.',
  progressSnapshots: [
    {
      recordedAt: '2026-03-23T18:00:00.000Z',
      amount: 8400,
      note: null,
    },
  ],
  archivedAt: null,
  createdAt: '2026-01-05T09:00:00.000Z',
  updatedAt: '2026-03-23T18:00:00.000Z',
})

const createDashboardRuntime = (
  overrides?: Partial<DashboardRouteRuntime['useCases']>
): DashboardRouteRuntime => {
  const baseGoal = createGoalPayload()

  return {
    repositories: {
      readModel: {} as DashboardRouteRuntime['repositories']['readModel'],
      derivedRecompute: {} as DashboardRouteRuntime['repositories']['derivedRecompute'],
    },
    useCases: {
      getSummary: async () => {
        throw new Error('not used in goals tests')
      },
      getTransactions: async () => {
        throw new Error('not used in goals tests')
      },
      updateTransactionClassification: async () => {
        throw new Error('not used in goals tests')
      },
      getGoals: async () => ({
        items: [baseGoal],
      }),
      createGoal: async () => baseGoal,
      updateGoal: async () => baseGoal,
      archiveGoal: async () => ({
        ...baseGoal,
        archivedAt: '2026-03-25T10:30:00.000Z',
        updatedAt: '2026-03-25T10:30:00.000Z',
      }),
      getDerivedRecomputeStatus: async () => ({
        featureEnabled: true,
        state: 'idle',
        latestRun: null,
        currentSnapshot: null,
      }),
      runDerivedRecompute: async () => ({
        featureEnabled: true,
        state: 'idle',
        latestRun: null,
        currentSnapshot: null,
      }),
      ...overrides,
    },
  }
}

const createGoalsTestApp = ({
  mode,
  runtime,
}: {
  mode: 'admin' | 'demo'
  runtime?: DashboardRouteRuntime
}) => {
  return new Elysia()
    .derive(() => ({
      auth: {
        mode,
      } as const,
      requestMeta: {
        requestId: 'req-goals-test',
        startedAtMs: 0,
      },
    }))
    .use(createDashboardRuntimePlugin(runtime ?? createDashboardRuntime()))
    .use(createGoalsRoute())
}

describe('createGoalsRoute', () => {
  it('returns deterministic demo data without calling the real use case', async () => {
    let getGoalsCalls = 0
    const app = createGoalsTestApp({
      mode: 'demo',
      runtime: createDashboardRuntime({
        getGoals: async () => {
          getGoalsCalls += 1
          return {
            items: [],
          }
        },
      }),
    })

    const response = await app.handle(new Request('http://finance-os.local/goals'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual(getDashboardGoalsMock())
    expect(getGoalsCalls).toBe(0)
  })

  it('blocks goal creation in demo mode with the safe error shape', async () => {
    const app = createGoalsTestApp({
      mode: 'demo',
    })

    const response = await app.handle(
      new Request('http://finance-os.local/goals', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Travel',
          goalType: 'travel',
          currency: 'EUR',
          targetAmount: 3200,
          currentAmount: 1200,
          targetDate: '2027-04-12',
          note: null,
        }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload).toEqual({
      ok: false,
      code: 'DEMO_MODE_FORBIDDEN',
      message: 'Admin session required',
      requestId: 'req-goals-test',
    })
  })

  it('creates a goal in admin mode', async () => {
    const createdGoal = createGoalPayload()
    let createGoalCalls = 0
    const app = createGoalsTestApp({
      mode: 'admin',
      runtime: createDashboardRuntime({
        createGoal: async input => {
          createGoalCalls += 1
          return {
            ...createdGoal,
            name: input.name,
            goalType: input.goalType,
            currency: input.currency,
            targetAmount: input.targetAmount,
            currentAmount: input.currentAmount,
            targetDate: input.targetDate,
            note: input.note,
          }
        },
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/goals', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Apartment deposit',
          goalType: 'home',
          currency: 'EUR',
          targetAmount: 45000,
          currentAmount: 18500,
          targetDate: '2028-12-31',
          note: 'Long horizon cash target.',
        }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(createGoalCalls).toBe(1)
    expect(payload).toMatchObject({
      id: createdGoal.id,
      name: 'Apartment deposit',
      goalType: 'home',
      currency: 'EUR',
      targetAmount: 45000,
      currentAmount: 18500,
      targetDate: '2028-12-31',
      note: 'Long horizon cash target.',
    })
  })

  it('returns 404 when updating a missing goal in admin mode', async () => {
    const app = createGoalsTestApp({
      mode: 'admin',
      runtime: createDashboardRuntime({
        updateGoal: async () => null,
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/goals/999', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Missing goal',
          goalType: 'custom',
          currency: 'EUR',
          targetAmount: 1000,
          currentAmount: 100,
          targetDate: null,
          note: null,
        }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload).toEqual({
      ok: false,
      code: 'NOT_FOUND',
      message: 'Goal not found',
      requestId: 'req-goals-test',
    })
  })

  it('archives an existing goal in admin mode', async () => {
    const app = createGoalsTestApp({
      mode: 'admin',
    })

    const response = await app.handle(
      new Request('http://finance-os.local/goals/91/archive', {
        method: 'POST',
      })
    )
    const payload = (await response.json()) as { archivedAt: string | null }

    expect(response.status).toBe(200)
    expect(payload.archivedAt).toBe('2026-03-25T10:30:00.000Z')
  })
})
