import { describe, expect, it } from 'vitest'
import { COST_PERIODS, createCostsViewModel } from './costs-view-model'
import type {
  DashboardAdvisorSpendAnalyticsResponse,
  DashboardCostOverviewResponse,
} from './dashboard-types'

const overview = (advisorStatus: 'ok' | 'degraded' = 'ok'): DashboardCostOverviewResponse => ({
  ok: true,
  mode: 'admin',
  source: 'db',
  requestId: 'test',
  generatedAt: '2026-09-01T00:00:00.000Z',
  totals: {
    recurringMonthlyByCurrency: [{ currency: 'EUR', amount: 16 }],
    recurringAnnualByCurrency: [{ currency: 'EUR', amount: 192 }],
    variableMonthlyUsd: 3,
    variableDailyUsd: 0,
  },
  recurringSubscriptions: [],
  variableUsage: {
    xTwitter: {
      dailyUsd: 0,
      monthlyUsd: 1,
      costBasisToday: 'actual',
      costBasisThisMonth: 'mixed',
    },
    advisor: {
      status: advisorStatus,
      dailyUsd: 0,
      monthlyUsd: 2,
      dailyBudgetUsd: 1,
      monthlyBudgetUsd: 20,
      lastError: advisorStatus === 'degraded' ? 'private failure' : null,
    },
  },
})

const spend: DashboardAdvisorSpendAnalyticsResponse = {
  summary: {
    dailyUsdSpent: 0,
    monthlyUsdSpent: 2,
    dailyBudgetUsd: 1,
    monthlyBudgetUsd: 20,
    blocked: false,
    reasons: [],
    challengerAllowed: true,
    deepAnalysisAllowed: true,
  },
  daily: [],
  byFeature: [],
  byModel: [],
  anomalies: [],
}

describe('createCostsViewModel', () => {
  it('keeps unavailable costs unknown instead of turning them into zero', () => {
    const model = createCostsViewModel({
      overview: null,
      spend: null,
      period: 'today',
      overviewUnavailable: true,
      spendUnavailable: true,
    })
    expect(model.lines.every(line => line.value === null)).toBe(true)
    expect(model.totals).toEqual([])
    expect(model.partial).toBe(true)
  })

  it('keeps a measured zero as a real zero', () => {
    const model = createCostsViewModel({ overview: overview(), spend, period: 'today' })
    expect(model.lines.map(line => line.value)).toEqual([0, 0])
    expect(model.totals).toEqual([{ currency: 'USD', value: 0 }])
  })

  it('keeps fixed, real and mixed provenance distinct', () => {
    const model = createCostsViewModel({ overview: overview(), spend, period: 'month' })
    expect(model.lines.map(line => line.provenanceLabel)).toEqual([
      'Fixe',
      'Réel et estimé',
      'Réel',
    ])
  })

  it('aggregates only compatible known amounts and marks a partial total', () => {
    const model = createCostsViewModel({ overview: overview('degraded'), spend, period: 'month' })
    expect(model.totals).toEqual([
      { currency: 'EUR', value: 16 },
      { currency: 'USD', value: 1 },
    ])
    expect(model.partial).toBe(true)
  })

  it('exposes only periods supported by the current cost contracts', () => {
    expect(COST_PERIODS.map(period => period.value)).toEqual(['today', 'month'])
  })
})
