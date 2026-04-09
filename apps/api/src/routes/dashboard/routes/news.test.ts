import { afterEach, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from '../plugin'
import { getDashboardNewsFixture } from '../domain/static-fixture-pack'
import { createNewsRoute } from './news'
import type { DashboardNewsResponse, DashboardRouteRuntime } from '../types'

const createNewsPayload = (requestId: string): DashboardNewsResponse => ({
  ...getDashboardNewsFixture(requestId),
  source: 'cache',
})

const createDashboardRuntime = (overrides?: Partial<DashboardRouteRuntime['useCases']>): DashboardRouteRuntime => ({
  repositories: {
    readModel: {} as DashboardRouteRuntime['repositories']['readModel'],
    news: {} as NonNullable<DashboardRouteRuntime['repositories']['news']>,
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
    getNewsContextBundle: async ({ requestId, range }) => ({
      range,
      generatedAt: requestId,
      freshness: {
        lastUpdatedAt: null,
        staleCache: false,
        providerFailureRate: 0,
        requestId,
      },
      topSignals: [],
      clusteredEvents: [],
      mostImpactedSectors: [],
      mostImpactedEntities: [],
      regulatorHighlights: [],
      centralBankHighlights: [],
      filingsHighlights: [],
      thematicHighlights: {
        ai: [],
        cyber: [],
        geopolitics: [],
        macro: [],
      },
      contradictorySignals: [],
      causalHypotheses: [],
      references: [],
    }),
    ingestNews: async () => ({ fetchedCount: 0, insertedCount: 0, mergedCount: 0, dedupeDropCount: 0 }),
    ...overrides,
  },
})

const createNewsTestApp = ({
  mode,
  hasValidInternalToken = false,
  runtime,
}: {
  mode: 'admin' | 'demo'
  hasValidInternalToken?: boolean
  runtime?: DashboardRouteRuntime
}) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      internalAuth: {
        hasValidToken: hasValidInternalToken,
        tokenSource: hasValidInternalToken ? 'x-internal-token' : null,
      } as const,
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
  it('keeps GET /news cache-only and never triggers live ingestion', async () => {
    let ingestCalls = 0
    const app = createNewsTestApp({
      mode: 'admin',
      runtime: createDashboardRuntime({
        ingestNews: async () => {
          ingestCalls += 1
          return { fetchedCount: 0, insertedCount: 0, mergedCount: 0, dedupeDropCount: 0 }
        },
      }),
    })

    const response = await app.handle(new Request('http://finance-os.local/news'))

    expect(response.status).toBe(200)
    expect(ingestCalls).toBe(0)
  })

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
      version: 'dashboard-fixture-pack:2026-04-09',
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
      version: 'dashboard-fixture-pack:2026-04-09',
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
      version: 'dashboard-fixture-pack:2026-04-09',
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

  it('allows context bundle reads with a valid internal token', async () => {
    const app = createNewsTestApp({
      mode: 'demo',
      hasValidInternalToken: true,
    })

    const response = await app.handle(new Request('http://finance-os.local/news/context?range=24h'))
    const payload = (await response.json()) as { range: string }

    expect(response.status).toBe(200)
    expect(payload.range).toBe('24h')
  })

  it('rejects live ingestion in demo mode without an internal token', async () => {
    const app = createNewsTestApp({ mode: 'demo' })

    const response = await app.handle(
      new Request('http://finance-os.local/news/ingest', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          trigger: 'manual',
        }),
      })
    )
    const payload = (await response.json()) as { code: string }

    expect(response.status).toBe(403)
    expect(payload.code).toBe('DEMO_MODE_FORBIDDEN')
  })

  it('returns 503 when the ingestion runtime is unavailable', async () => {
    const runtime = createDashboardRuntime()
    delete runtime.useCases.ingestNews

    const app = createNewsTestApp({
      mode: 'admin',
      runtime,
    })

    const response = await app.handle(
      new Request('http://finance-os.local/news/ingest', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          trigger: 'manual',
        }),
      })
    )
    const payload = (await response.json()) as { code: string }

    expect(response.status).toBe(503)
    expect(payload.code).toBe('NEWS_INGESTION_UNAVAILABLE')
  })

  it('returns 503 with a safe envelope when providers fail', async () => {
    const app = createNewsTestApp({
      mode: 'admin',
      runtime: createDashboardRuntime({
        ingestNews: async () => {
          throw new Error('provider-down')
        },
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/news/ingest', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          trigger: 'manual',
        }),
      })
    )
    const payload = (await response.json()) as { code: string }

    expect(response.status).toBe(503)
    expect(payload.code).toBe('NEWS_PROVIDER_UNAVAILABLE')
  })

  it('allows live ingestion from admin mode and returns counters', async () => {
    const app = createNewsTestApp({
      mode: 'admin',
      runtime: createDashboardRuntime({
        ingestNews: async () => ({
          fetchedCount: 18,
          insertedCount: 9,
          mergedCount: 4,
          dedupeDropCount: 4,
        }),
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/news/ingest', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          trigger: 'manual',
        }),
      })
    )
    const payload = (await response.json()) as {
      ok: boolean
      fetchedCount: number
      insertedCount: number
      mergedCount: number
      dedupeDropCount: number
    }

    expect(response.status).toBe(200)
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        fetchedCount: 18,
        insertedCount: 9,
        mergedCount: 4,
        dedupeDropCount: 4,
      })
    )
  })
})
