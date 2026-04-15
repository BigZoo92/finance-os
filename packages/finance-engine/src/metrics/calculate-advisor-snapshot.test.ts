import { describe, expect, it } from 'bun:test'
import { calculateAdvisorSnapshot } from './calculate-advisor-snapshot'

describe('calculateAdvisorSnapshot', () => {
  it('infers a conservative profile and quantifies cash drag, drawdown, and resilience', () => {
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
          name: 'Compte courant',
          value: 30_000,
          assetClass: 'cash',
        },
        {
          id: 'world-etf',
          name: 'ETF World',
          value: 20_000,
          assetClass: 'equity_global',
          feesBps: 20,
        },
        {
          id: 'bonds',
          name: 'Obligations',
          value: 10_000,
          assetClass: 'fixed_income',
        },
      ],
      goals: [],
      dailyWealth: [
        { date: '2026-04-10', balance: 60_000 },
        { date: '2026-04-11', balance: 62_000 },
        { date: '2026-04-12', balance: 57_000 },
        { date: '2026-04-13', balance: 63_000 },
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
      signals: [
        {
          id: 'macro-risk',
          title: 'Tension sur les taux',
          direction: 'risk',
          severity: 68,
          confidence: 74,
          whyItMatters: ['pression sur les actifs de duration'],
        },
      ],
    })

    expect(snapshot.riskProfile).toBe('conservative')
    expect(snapshot.metrics.totalValue).toBe(60_000)
    expect(snapshot.metrics.cashAllocationPct).toBe(50)
    expect(snapshot.metrics.cashDragPct).toBe(1.189)
    expect(snapshot.metrics.savingsRatePct).toBe(40)
    expect(snapshot.metrics.emergencyFundMonths).toBe(10)
    expect(snapshot.metrics.runwayMonths).toBe(10.67)
    expect(snapshot.metrics.observedMaxDrawdownPct).toBe(8.06)
    expect(snapshot.driftSignals.find(item => item.bucket === 'cash')?.status).toBe('overweight')
    expect(snapshot.assumptions.find(item => item.key === 'risk_profile')?.source).toBe('inferred')
    expect(snapshot.scenarios).toHaveLength(3)
  })

  it('honors an explicit risk profile override', () => {
    const snapshot = calculateAdvisorSnapshot({
      asOf: '2026-04-14T08:00:00.000Z',
      range: '90d',
      currency: 'EUR',
      monthlyIncome: 4_200,
      monthlyExpenses: 2_700,
      liquidCashValue: 8_000,
      explicitRiskProfile: 'growth',
      positions: [
        {
          id: 'cash-buffer',
          name: 'Cash',
          value: 8_000,
          assetClass: 'cash',
        },
        {
          id: 'us-etf',
          name: 'US Equity',
          value: 32_000,
          assetClass: 'equity_us',
        },
        {
          id: 'gold',
          name: 'Gold',
          value: 4_000,
          assetClass: 'gold',
        },
      ],
      goals: [],
      dailyWealth: [
        { date: '2026-04-10', balance: 44_000 },
        { date: '2026-04-11', balance: 44_500 },
      ],
      topExpenses: [],
    })

    expect(snapshot.riskProfile).toBe('growth')
    expect(snapshot.targets.emergencyFundMonths).toBe(5)
    expect(snapshot.assumptions.find(item => item.key === 'risk_profile')?.source).toBe('observed')
  })
})
