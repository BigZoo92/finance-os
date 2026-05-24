import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from '../plugin'
import type { DashboardRouteRuntime, DashboardUseCases } from '../types'
import { createInvestmentStrategyRoute } from './investment-strategy'

const buildRuntime = (useCases: Partial<DashboardUseCases>): DashboardRouteRuntime =>
  ({
    repositories: {
      readModel: {} as DashboardRouteRuntime['repositories']['readModel'],
      derivedRecompute: {} as DashboardRouteRuntime['repositories']['derivedRecompute'],
    },
    useCases: useCases as DashboardUseCases,
    providerRegistry: {
      listProviders: () => [],
    } as unknown as DashboardRouteRuntime['providerRegistry'],
  }) as DashboardRouteRuntime

const buildApp = ({
  mode,
  hasValidInternalToken = false,
  useCases,
}: {
  mode: 'demo' | 'admin'
  hasValidInternalToken?: boolean
  useCases: Partial<DashboardUseCases>
}) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      internalAuth: {
        hasValidToken: hasValidInternalToken,
        tokenSource: hasValidInternalToken ? ('x-internal-token' as const) : null,
      } as const,
      requestMeta: {
        requestId: 'req-investment-route-test',
        startedAtMs: 0,
      },
    }))
    .use(createDashboardRuntimePlugin(buildRuntime(useCases)))
    .use(createInvestmentStrategyRoute())

describe('createInvestmentStrategyRoute', () => {
  it('GET /advisor/investment-strategy forwards demo mode to the read use-case', async () => {
    const received: Array<'demo' | 'admin'> = []
    const app = buildApp({
      mode: 'demo',
      useCases: {
        getInvestmentStrategy: async input => {
          received.push(input.mode)
          return {
            requestId: input.requestId,
            mode: input.mode,
            source: 'demo_fixture',
            strategy: { name: 'demo' },
            buckets: [],
            accountPolicies: [],
            candidateUniverse: { total: 0, approved: 0, needsReview: 0, candidates: [] },
            validation: { valid: true, total: 100, missing: [], errors: [] },
            safety: { noAutoTrade: true, humanValidationRequired: true, constraints: [] },
          }
        },
      },
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/investment-strategy')
    )
    const payload = (await response.json()) as { mode: string; requestId: string }

    expect(response.status).toBe(200)
    expect(payload.mode).toBe('demo')
    expect(payload.requestId).toBe('req-investment-route-test')
    expect(received).toEqual(['demo'])
  })

  it('POST /advisor/investment-plan/generate blocks demo callers before side effects', async () => {
    let called = false
    const app = buildApp({
      mode: 'demo',
      useCases: {
        generateInvestmentPlan: async () => {
          called = true
          return {}
        },
      },
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/investment-plan/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      })
    )
    const payload = (await response.json()) as { code: string }

    expect(response.status).toBe(403)
    expect(payload.code).toBe('DEMO_MODE_FORBIDDEN')
    expect(called).toBe(false)
  })

  it('POST /advisor/investment-plan/generate accepts an internal token and forwards admin mode', async () => {
    const received: { mode: 'demo' | 'admin' | null; dryRun: boolean | undefined } = {
      mode: null,
      dryRun: undefined,
    }
    const app = buildApp({
      mode: 'demo',
      hasValidInternalToken: true,
      useCases: {
        generateInvestmentPlan: async input => {
          received.mode = input.mode
          received.dryRun = input.dryRun
          return {
            requestId: input.requestId,
            mode: input.mode,
            source: input.dryRun ? 'dry_run' : 'db',
            plan: { noAutoTrade: true, humanValidationRequired: true },
          }
        },
      },
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/investment-plan/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trigger: 'internal', dryRun: true }),
      })
    )
    const payload = (await response.json()) as { source: string; plan: { noAutoTrade: boolean } }

    expect(response.status).toBe(200)
    expect(received.mode).toBe('admin')
    expect(received.dryRun).toBe(true)
    expect(payload.source).toBe('dry_run')
    expect(payload.plan.noAutoTrade).toBe(true)
  })

  it('GET /advisor/assets/search forwards the query without requiring admin mode', async () => {
    const received: { mode: 'demo' | 'admin' | null; query: string | null } = {
      mode: null,
      query: null,
    }
    const app = buildApp({
      mode: 'demo',
      useCases: {
        searchAdvisorAssets: async input => {
          received.mode = input.mode
          received.query = input.query
          return {
            requestId: input.requestId,
            mode: input.mode,
            source: 'demo_fixture',
            query: input.query,
            items: [{ symbol: 'BTC', name: 'Bitcoin', priceability: 'priceable' }],
          }
        },
      },
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/assets/search?q=bitcoin')
    )
    const payload = (await response.json()) as { items: Array<{ symbol: string }> }

    expect(response.status).toBe(200)
    expect(received).toEqual({ mode: 'demo', query: 'bitcoin' })
    expect(payload.items[0]?.symbol).toBe('BTC')
  })

  it('POST /advisor/assets/watchlist blocks demo writes before adding assets', async () => {
    let called = false
    const app = buildApp({
      mode: 'demo',
      useCases: {
        addAdvisorAssetToWatchlist: async () => {
          called = true
          return {}
        },
      },
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/assets/watchlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          symbol: 'NVDA',
          name: 'NVIDIA',
          assetClass: 'stock',
          currency: 'USD',
        }),
      })
    )

    expect(response.status).toBe(403)
    expect(called).toBe(false)
  })

  it('GET /advisor/investment-plan/latest returns 503 when runtime is not wired', async () => {
    const app = buildApp({ mode: 'admin', useCases: {} })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/investment-plan/latest')
    )
    const payload = (await response.json()) as { code: string; requestId: string }

    expect(response.status).toBe(503)
    expect(payload.code).toBe('INVESTMENT_ADVISOR_RUNTIME_UNAVAILABLE')
    expect(payload.requestId).toBe('req-investment-route-test')
  })

  it('POST /advisor/investment-learning/lessons/:id/approve requires admin or token', async () => {
    let called = false
    const app = buildApp({
      mode: 'demo',
      useCases: {
        updateInvestmentStrategyLessonStatus: async () => {
          called = true
          return { ok: true }
        },
      },
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/investment-learning/lessons/1/approve', {
        method: 'POST',
      })
    )

    expect(response.status).toBe(403)
    expect(called).toBe(false)
  })
})
