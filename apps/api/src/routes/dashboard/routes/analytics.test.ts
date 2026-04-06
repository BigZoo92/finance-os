import { afterEach, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from '../plugin'
import { createAnalyticsRoute } from './analytics'
import type { DashboardRouteRuntime, DashboardSummaryResponse } from '../types'

const buildSummary = (range: '7d' | '30d' | '90d'): DashboardSummaryResponse => ({
  range,
  totals: {
    balance: 100,
    incomes: 80,
    expenses: 20,
  },
  connections: [],
  accounts: [],
  assets: [
    {
      assetId: 1,
      type: 'investment',
      origin: 'provider',
      source: 'powens',
      provider: 'powens',
      providerConnectionId: 'pc-1',
      providerInstitutionName: 'Demo Bank',
      powensConnectionId: 'conn-1',
      powensAccountId: 'acc-1',
      name: 'Brokerage',
      currency: 'EUR',
      valuation: 60,
      valuationAsOf: '2026-04-01T00:00:00.000Z',
      enabled: true,
      metadata: null,
    },
    {
      assetId: 2,
      type: 'cash',
      origin: 'provider',
      source: 'powens',
      provider: 'powens',
      providerConnectionId: 'pc-1',
      providerInstitutionName: 'Demo Bank',
      powensConnectionId: 'conn-1',
      powensAccountId: 'acc-2',
      name: 'Checking',
      currency: 'EUR',
      valuation: 40,
      valuationAsOf: '2026-04-01T00:00:00.000Z',
      enabled: true,
      metadata: null,
    },
  ],
  positions: [],
  dailyWealthSnapshots: [{ date: '2026-04-01', balance: 90 }],
  topExpenseGroups: [
    { label: 'Housing', category: 'housing', merchant: 'Landlord', total: 20, count: 1 },
    { label: 'Groceries', category: 'food', merchant: 'Market', total: 15, count: 2 },
    { label: 'Transport', category: 'mobility', merchant: 'Metro', total: 5, count: 3 },
  ],
})

const createDashboardRuntime = (
  overrides?: Partial<DashboardRouteRuntime['useCases']>
): DashboardRouteRuntime => ({
  repositories: {
    readModel: {} as DashboardRouteRuntime['repositories']['readModel'],
    derivedRecompute: {} as DashboardRouteRuntime['repositories']['derivedRecompute'],
  },
  useCases: {
    getSummary: async range => buildSummary(range),
    getTransactions: async () => ({
      schemaVersion: '2026-04-05',
      range: '30d',
      limit: 500,
      nextCursor: null,
      freshness: {
        strategy: 'snapshot-first',
        lastSyncedAt: null,
        syncStatus: 'fresh',
        degradedReason: null,
        snapshotAgeSeconds: null,
        refreshRequested: false,
      },
      items: [],
    }),
    requestTransactionsBackgroundRefresh: async () => false,
    updateTransactionClassification: async () => null,
    getGoals: async () => ({ items: [] }),
    createGoal: async () => {
      throw new Error('not used in analytics tests')
    },
    updateGoal: async () => null,
    archiveGoal: async () => null,
    getDerivedRecomputeStatus: async () => {
      throw new Error('not used in analytics tests')
    },
    runDerivedRecompute: async () => {
      throw new Error('not used in analytics tests')
    },
    ...overrides,
  },
})

const createAnalyticsTestApp = ({
  mode,
  runtime,
}: {
  mode: 'admin' | 'demo'
  runtime?: DashboardRouteRuntime
}) => {
  return new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      requestMeta: {
        requestId: 'req-analytics-test',
        startedAtMs: 0,
      },
    }))
    .use(createDashboardRuntimePlugin(runtime ?? createDashboardRuntime()))
    .use(createAnalyticsRoute())
}

afterEach(() => {
  delete process.env.DASHBOARD_ANALYTICS_FORCE_DEMO_ADAPTER
  delete process.env.DASHBOARD_ANALYTICS_DISABLED_WIDGETS
})

describe('createAnalyticsRoute', () => {
  it('uses demo adapter in demo mode and never calls admin use case', async () => {
    let getSummaryCalls = 0
    const app = createAnalyticsTestApp({
      mode: 'demo',
      runtime: createDashboardRuntime({
        getSummary: async range => {
          getSummaryCalls += 1
          return buildSummary(range)
        },
      }),
    })

    const response = await app.handle(new Request('http://finance-os.local/analytics?range=30d'))
    const payload = (await response.json()) as any

    expect(response.status).toBe(200)
    expect(payload.source).toBe('demoAdapter')
    expect(getSummaryCalls).toBe(0)
    expect(payload.recurringSpend.fixedCharges.totalMonthly).toBe(520)
    expect(payload.recurringSpend.subscriptions.totalMonthly).toBe(12.99)
    expect(payload.recurringSpend.fixedCharges.items[0]).toEqual({
      label: 'virement loyer',
      monthlyAmount: 520,
      occurrences: 2,
    })
    expect(payload.recurringSpend.subscriptions.items[0]).toEqual({
      label: 'spotify premium',
      monthlyAmount: 12.99,
      occurrences: 2,
    })
  })

  it('uses admin adapter in admin mode by default', async () => {
    let getSummaryCalls = 0
    const app = createAnalyticsTestApp({
      mode: 'admin',
      runtime: createDashboardRuntime({
        getSummary: async range => {
          getSummaryCalls += 1
          return buildSummary(range)
        },
      }),
    })

    const response = await app.handle(new Request('http://finance-os.local/analytics?range=7d'))
    const payload = (await response.json()) as any

    expect(response.status).toBe(200)
    expect(payload.source).toBe('adminAdapter')
    expect(payload.range).toBe('7d')
    expect(getSummaryCalls).toBe(1)
  })

  it('forces demo adapter for admin when kill-switch is enabled', async () => {
    process.env.DASHBOARD_ANALYTICS_FORCE_DEMO_ADAPTER = '1'
    let getSummaryCalls = 0
    const app = createAnalyticsTestApp({
      mode: 'admin',
      runtime: createDashboardRuntime({
        getSummary: async range => {
          getSummaryCalls += 1
          return buildSummary(range)
        },
      }),
    })

    const response = await app.handle(new Request('http://finance-os.local/analytics?range=90d'))
    const payload = (await response.json()) as any

    expect(response.status).toBe(200)
    expect(payload.source).toBe('demoAdapter')
    expect(getSummaryCalls).toBe(0)
  })

  it('marks disabled widgets as degraded while keeping payload available', async () => {
    process.env.DASHBOARD_ANALYTICS_DISABLED_WIDGETS =
      'timeseries,categorySplit,portfolioAllocation,allocationEvolution'
    const app = createAnalyticsTestApp({
      mode: 'admin',
    })

    const response = await app.handle(new Request('http://finance-os.local/analytics?range=30d'))
    const payload = (await response.json()) as any

    expect(response.status).toBe(200)
    expect(payload.availability.timeseries).toBe(false)
    expect(payload.availability.categorySplit).toBe(false)
    expect(payload.availability.portfolioAllocation).toBe(false)
    expect(payload.availability.allocationEvolution).toBe(false)
    expect(payload.timeseries.state).toBe('degraded')
    expect(payload.categorySplit.state).toBe('degraded')
    expect(payload.portfolioAllocation.state).toBe('degraded')
    expect(payload.allocationEvolution.state).toBe('degraded')
  })

  it('returns allocation and allocation evolution from summary assets and snapshots', async () => {
    const app = createAnalyticsTestApp({
      mode: 'admin',
    })

    const response = await app.handle(new Request('http://finance-os.local/analytics?range=30d'))
    const payload = (await response.json()) as any

    expect(response.status).toBe(200)
    expect(payload.portfolioAllocation.items).toEqual([
      { type: 'cash', total: 40, ratio: 0.4 },
      { type: 'investment', total: 60, ratio: 0.6 },
    ])
    expect(payload.allocationEvolution.points).toEqual([
      { date: '2026-04-01', total: 90, cash: 36, investment: 54, manual: 0 },
    ])
  })

  it('computes recurring spend and concentration widgets in admin mode', async () => {
    const app = createAnalyticsTestApp({
      mode: 'admin',
      runtime: createDashboardRuntime({
        getTransactions: async () => ({
          schemaVersion: '2026-04-05',
          range: '30d',
          limit: 500,
          nextCursor: null,
          freshness: {
            strategy: 'snapshot-first',
            lastSyncedAt: null,
            syncStatus: 'fresh',
            degradedReason: null,
            snapshotAgeSeconds: null,
            refreshRequested: false,
          },
          items: [
            {
              id: 1,
              bookingDate: '2026-03-05',
              amount: -50,
              currency: 'EUR',
              direction: 'expense',
              label: 'Gym Membership 03',
              merchant: 'Gym',
              category: 'sports',
              subcategory: null,
              resolvedCategory: 'sports',
              resolutionSource: 'fallback',
              resolutionRuleId: null,
              resolutionTrace: [],
              incomeType: null,
              tags: [],
              powensConnectionId: 'conn-1',
              powensAccountId: 'acc-1',
              accountName: 'Checking',
            },
            {
              id: 2,
              bookingDate: '2026-04-05',
              amount: -51,
              currency: 'EUR',
              direction: 'expense',
              label: 'Gym Membership 04',
              merchant: 'Gym',
              category: 'sports',
              subcategory: null,
              resolvedCategory: 'sports',
              resolutionSource: 'fallback',
              resolutionRuleId: null,
              resolutionTrace: [],
              incomeType: null,
              tags: [],
              powensConnectionId: 'conn-1',
              powensAccountId: 'acc-1',
              accountName: 'Checking',
            },
            {
              id: 3,
              bookingDate: '2026-03-06',
              amount: -12,
              currency: 'EUR',
              direction: 'expense',
              label: 'Spotify Premium Mar',
              merchant: 'Spotify',
              category: 'entertainment',
              subcategory: null,
              resolvedCategory: 'entertainment',
              resolutionSource: 'fallback',
              resolutionRuleId: null,
              resolutionTrace: [],
              incomeType: null,
              tags: [],
              powensConnectionId: 'conn-1',
              powensAccountId: 'acc-1',
              accountName: 'Checking',
            },
            {
              id: 4,
              bookingDate: '2026-04-06',
              amount: -12,
              currency: 'EUR',
              direction: 'expense',
              label: 'Spotify Premium Apr',
              merchant: 'Spotify',
              category: 'entertainment',
              subcategory: null,
              resolvedCategory: 'entertainment',
              resolutionSource: 'fallback',
              resolutionRuleId: null,
              resolutionTrace: [],
              incomeType: null,
              tags: [],
              powensConnectionId: 'conn-1',
              powensAccountId: 'acc-1',
              accountName: 'Checking',
            },
          ],
        }),
      }),
    })

    const response = await app.handle(new Request('http://finance-os.local/analytics?range=30d'))
    const payload = (await response.json()) as any

    expect(response.status).toBe(200)
    expect(payload.recurringSpend.fixedCharges.totalMonthly).toBe(51)
    expect(payload.recurringSpend.subscriptions.totalMonthly).toBe(12)
    expect(payload.recurringSpend.fixedCharges.items[0]).toEqual({
      label: 'gym membership',
      monthlyAmount: 51,
      occurrences: 2,
    })
    expect(payload.recurringSpend.subscriptions.items[0]).toEqual({
      label: 'spotify premium',
      monthlyAmount: 12,
      occurrences: 2,
    })
    expect(payload.spendConcentration.topMerchantShare).toBe(0.5)
    expect(payload.spendConcentration.top3Share).toBe(1)
    expect(payload.spendConcentration.hhi).toBe(0.4063)
    expect(payload.spendConcentration.dominantMerchantLabel).toBe('Housing')
  })
})
