import { afterEach, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from '../plugin'
import { createAdvisorRoute } from './advisor'
import type { DashboardAdvisorResponse, DashboardRouteRuntime } from '../types'

const createDashboardRuntime = (overrides?: Partial<DashboardRouteRuntime['useCases']>): DashboardRouteRuntime => ({
  repositories: {
    readModel: {} as DashboardRouteRuntime['repositories']['readModel'],
    derivedRecompute: {} as DashboardRouteRuntime['repositories']['derivedRecompute'],
  },
  useCases: {
    getSummary: async range => ({
      range,
      totals: { balance: 1000, incomes: 1500, expenses: 900 },
      connections: [],
      accounts: [],
      assets: [],
      positions: [],
      dailyWealthSnapshots: [],
      topExpenseGroups: [],
    }),
    getTransactions: async () => {
      throw new Error('not used')
    },
    requestTransactionsBackgroundRefresh: async () => false,
    updateTransactionClassification: async () => null,
    getGoals: async () => ({ items: [] }),
    createGoal: async () => {
      throw new Error('not used')
    },
    updateGoal: async () => null,
    archiveGoal: async () => null,
    getDerivedRecomputeStatus: async () => {
      throw new Error('not used')
    },
    runDerivedRecompute: async () => {
      throw new Error('not used')
    },
    ...overrides,
  },
})

const createAdvisorTestApp = ({ mode, runtime }: { mode: 'admin' | 'demo'; runtime?: DashboardRouteRuntime }) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      requestMeta: {
        requestId: 'req-advisor-test',
        startedAtMs: Date.now(),
      },
    }))
    .use(createDashboardRuntimePlugin(runtime ?? createDashboardRuntime()))
    .use(createAdvisorRoute())

afterEach(() => {
  delete process.env.AI_ADVISOR_ENABLED
  delete process.env.AI_ADVISOR_ADMIN_ONLY
  delete process.env.AI_ADVISOR_FORCE_LOCAL_ONLY
})

describe('createAdvisorRoute', () => {
  it('returns deterministic local insights in demo mode', async () => {
    const app = createAdvisorTestApp({ mode: 'demo' })

    const response = await app.handle(new Request('http://finance-os.local/advisor?range=30d'))
    const payload = (await response.json()) as DashboardAdvisorResponse

    expect(response.status).toBe(200)
    expect(payload.mode).toBe('demo')
    expect(payload.source).toBe('local')
    expect(payload.fallback).toBe(false)
    expect(['sufficient', 'insufficient']).toContain(payload.dataStatus.mode)
    expect(payload.insights.length).toBeGreaterThan(0)
    expect(payload.insights[0]?.citations.length).toBeGreaterThan(0)
    expect(payload.actions.length).toBeGreaterThan(0)
    expect(payload.actions[0]?.citations.length).toBeGreaterThan(0)
    expect(payload.actions[0]?.tracking.status).toBe('suggested')
    expect(payload.actions[0]?.decisionWorkflow.checkpoints.length).toBeGreaterThan(0)
  })

  it('returns admin response from real summary path', async () => {
    const app = createAdvisorTestApp({ mode: 'admin' })

    const response = await app.handle(new Request('http://finance-os.local/advisor?range=7d'))
    const payload = (await response.json()) as DashboardAdvisorResponse

    expect(response.status).toBe(200)
    expect(payload.mode).toBe('admin')
    expect(payload.source).toBe('provider')
    expect(payload.fallback).toBe(false)
  })

  it('returns local fallback when admin summary path throws', async () => {
    const app = createAdvisorTestApp({
      mode: 'admin',
      runtime: createDashboardRuntime({
        getSummary: async () => {
          throw new Error('db-down')
        },
      }),
    })

    const response = await app.handle(new Request('http://finance-os.local/advisor'))
    const payload = (await response.json()) as DashboardAdvisorResponse

    expect(response.status).toBe(200)
    expect(payload.source).toBe('local')
    expect(payload.fallback).toBe(true)
    expect(payload.degradedMessage).toBe('Conseils limites, source externe indisponible')
  })


  it('uses local fallback path when force-local flag is enabled for admin', async () => {
    process.env.AI_ADVISOR_FORCE_LOCAL_ONLY = '1'
    const app = createAdvisorTestApp({ mode: 'admin' })

    const response = await app.handle(new Request('http://finance-os.local/advisor'))
    const payload = (await response.json()) as DashboardAdvisorResponse

    expect(response.status).toBe(200)
    expect(payload.mode).toBe('admin')
    expect(payload.source).toBe('local')
    expect(payload.fallback).toBe(true)
    expect(payload.fallbackReason).toBe('force_local_only')
  })

  it('blocks demo when admin-only flag is enabled', async () => {
    process.env.AI_ADVISOR_ADMIN_ONLY = '1'
    const app = createAdvisorTestApp({ mode: 'demo' })

    const response = await app.handle(new Request('http://finance-os.local/advisor'))
    const payload = (await response.json()) as { code: string }

    expect(response.status).toBe(403)
    expect(payload.code).toBe('ADVISOR_ADMIN_ONLY')
  })
})
