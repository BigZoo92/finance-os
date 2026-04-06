import { afterEach, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from '../plugin'
import { createNewsRoute } from './news'
import type { DashboardNewsResponse, DashboardRouteRuntime } from '../types'

const createNewsPayload = (requestId: string): DashboardNewsResponse => ({
  source: 'cache',
  resilience: {
    domain: 'news',
    status: 'ok',
    source: 'cache',
    requestId,
    reasonCode: null,
    policy: {
      enabled: true,
      sourceOrder: ['live', 'cache', 'demo'],
    },
    slo: {
      degradedRate: 0,
      hardFailRate: 0,
      staleAgeSeconds: 120,
    },
  },
  lastUpdatedAt: '2026-04-06T08:00:00.000Z',
  staleCache: false,
  providerError: null,
  metrics: {
    cacheHitRate: 1,
    dedupeDropRate: 0,
    providerFailureRate: 0,
  },
  items: [
    {
      id: 'cache-1',
      title: 'Admin news',
      summary: 'Live-backed news from cache model.',
      url: 'https://example.com/admin-news',
      sourceName: 'Admin Cache',
      topic: 'macro',
      language: 'en',
      publishedAt: '2026-04-06T07:00:00.000Z',
    },
  ],
})

const createDashboardRuntime = (overrides?: Partial<DashboardRouteRuntime['useCases']>): DashboardRouteRuntime => ({
  repositories: {
    readModel: {} as DashboardRouteRuntime['repositories']['readModel'],
    derivedRecompute: {} as DashboardRouteRuntime['repositories']['derivedRecompute'],
  },
  useCases: {
    getSummary: async () => {
      throw new Error('not used')
    },
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
    getNews: async ({ requestId }) => createNewsPayload(requestId),
    ingestNews: async () => ({ fetchedCount: 0, insertedCount: 0, dedupeDropCount: 0 }),
    ...overrides,
  },
})

const createNewsTestApp = ({ mode, runtime }: { mode: 'admin' | 'demo'; runtime?: DashboardRouteRuntime }) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      requestMeta: {
        requestId: 'req-news-test',
        startedAtMs: 0,
      },
    }))
    .use(createDashboardRuntimePlugin(runtime ?? createDashboardRuntime()))
    .use(createNewsRoute())

afterEach(() => {
  delete process.env.DASHBOARD_NEWS_FORCE_FIXTURE_FALLBACK
})

describe('createNewsRoute', () => {
  it('returns deterministic fixture payload in demo mode', async () => {
    let adminCalls = 0
    const app = createNewsTestApp({
      mode: 'demo',
      runtime: createDashboardRuntime({
        getNews: async ({ requestId }) => {
          adminCalls += 1
          return createNewsPayload(requestId)
        },
      }),
    })

    const response = await app.handle(new Request('http://finance-os.local/news'))
    const payload = (await response.json()) as DashboardNewsResponse

    expect(response.status).toBe(200)
    expect(payload.source).toBe('demo_fixture')
    expect(payload.dataset).toEqual({
      version: 'dashboard-fixture-pack:2026-04-06',
      source: 'demo_fixture',
      mode: 'demo',
      isDemoData: true,
    })
    expect(adminCalls).toBe(0)
  })

  it('uses live admin path when available', async () => {
    const app = createNewsTestApp({ mode: 'admin' })

    const response = await app.handle(new Request('http://finance-os.local/news'))
    const payload = (await response.json()) as DashboardNewsResponse

    expect(response.status).toBe(200)
    expect(payload.source).toBe('cache')
    expect(payload.dataset).toEqual({
      version: 'dashboard-fixture-pack:legacy',
      source: 'admin_live',
      mode: 'admin',
      isDemoData: false,
    })
  })

  it('falls back to fixture payload when admin live path fails', async () => {
    const app = createNewsTestApp({
      mode: 'admin',
      runtime: createDashboardRuntime({
        getNews: async () => {
          throw new Error('db-down')
        },
      }),
    })

    const response = await app.handle(new Request('http://finance-os.local/news'))
    const payload = (await response.json()) as DashboardNewsResponse

    expect(response.status).toBe(200)
    expect(payload.source).toBe('demo_fixture')
    expect(payload.dataset).toEqual({
      version: 'dashboard-fixture-pack:2026-04-06',
      source: 'admin_fallback',
      mode: 'admin',
      isDemoData: true,
    })
  })

  it('honors kill-switch to force admin fixture fallback', async () => {
    process.env.DASHBOARD_NEWS_FORCE_FIXTURE_FALLBACK = '1'
    let adminCalls = 0
    const app = createNewsTestApp({
      mode: 'admin',
      runtime: createDashboardRuntime({
        getNews: async ({ requestId }) => {
          adminCalls += 1
          return createNewsPayload(requestId)
        },
      }),
    })

    const response = await app.handle(new Request('http://finance-os.local/news'))
    const payload = (await response.json()) as DashboardNewsResponse

    expect(response.status).toBe(200)
    expect(payload.source).toBe('demo_fixture')
    expect(payload.dataset?.source).toBe('admin_fallback')
    expect(adminCalls).toBe(0)
  })
})
