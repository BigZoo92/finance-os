import { describe, expect, it } from 'bun:test'
import { calculateAdvisorSnapshot } from '../metrics/calculate-advisor-snapshot'
import { generateAdvisorRecommendations } from './generate-advisor-recommendations'

describe('generateAdvisorRecommendations', () => {
  it('prioritizes concentration, cash drag, drift, and macro caution when the evidence is present', () => {
    const signals = [
      {
        id: 'risk-1',
        title: 'Inflation sticky',
        direction: 'risk' as const,
        severity: 72,
        confidence: 76,
        whyItMatters: ['cash and long duration stay under pressure'],
      },
      {
        id: 'risk-2',
        title: 'Geopolitical escalation',
        direction: 'risk' as const,
        severity: 65,
        confidence: 68,
        whyItMatters: ['adds event risk and weakens confidence'],
      },
    ]

    const snapshot = calculateAdvisorSnapshot({
      asOf: '2026-04-14T08:00:00.000Z',
      range: '30d',
      currency: 'EUR',
      monthlyIncome: 5_000,
      monthlyExpenses: 3_000,
      liquidCashValue: 30_000,
      positions: [
        {
          id: 'cash-main',
          name: 'Cash',
          value: 30_000,
          assetClass: 'cash',
        },
        {
          id: 'equity-world',
          name: 'ETF World',
          value: 20_000,
          assetClass: 'equity_global',
        },
        {
          id: 'bonds',
          name: 'Bonds',
          value: 10_000,
          assetClass: 'fixed_income',
        },
      ],
      goals: [],
      dailyWealth: [
        { date: '2026-04-10', balance: 60_000 },
        { date: '2026-04-11', balance: 62_000 },
      ],
      topExpenses: [
        {
          label: 'Loyer',
          category: 'housing',
          merchant: 'Rent',
          total: 1_500,
          count: 1,
        },
      ],
      signals,
    })

    const recommendations = generateAdvisorRecommendations({
      snapshot,
      signals,
    })

    expect(recommendations.map(item => item.id)).toEqual([
      'concentration-risk',
      'cash-drag-reduction',
      'allocation-drift-cash',
      'spend-discipline',
      'macro-caution',
    ])
    expect(recommendations[0]?.riskLevel).toBe('high')
    expect(recommendations[1]?.category).toBe('cash_optimization')
    expect(recommendations[3]?.alternatives.length).toBeGreaterThan(0)
  })

  it('flags spend discipline when savings rate and expense concentration are weak', () => {
    const snapshot = calculateAdvisorSnapshot({
      asOf: '2026-04-14T08:00:00.000Z',
      range: '30d',
      currency: 'EUR',
      monthlyIncome: 3_200,
      monthlyExpenses: 3_000,
      liquidCashValue: 7_000,
      positions: [
        {
          id: 'cash-main',
          name: 'Cash',
          value: 7_000,
          assetClass: 'cash',
        },
        {
          id: 'world-etf',
          name: 'ETF World',
          value: 5_000,
          assetClass: 'equity_global',
        },
      ],
      goals: [],
      dailyWealth: [
        { date: '2026-04-10', balance: 12_000 },
        { date: '2026-04-11', balance: 12_100 },
      ],
      topExpenses: [
        {
          label: 'Loyer',
          category: 'housing',
          merchant: 'Rent',
          total: 1_200,
          count: 1,
        },
      ],
    })

    const recommendations = generateAdvisorRecommendations({
      snapshot,
    })

    expect(recommendations.some(item => item.id === 'spend-discipline')).toBe(true)
  })
})
