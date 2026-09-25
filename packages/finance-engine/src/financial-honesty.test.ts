import { describe, expect, it } from 'bun:test'
import { calculateAdvisorSnapshot } from './metrics/calculate-advisor-snapshot'
import { generateAdvisorRecommendations } from './recommendations/generate-advisor-recommendations'
import type { FinanceEngineInput } from './types'

// Financial invariants: unknown is not zero, unavailable is not 0%, true zero
// stays representable. These tests pin the engine to those rules.

const baseInput: FinanceEngineInput = {
  asOf: '2026-09-25T08:00:00.000Z',
  range: '30d',
  currency: 'EUR',
  monthlyIncome: 4_000,
  monthlyExpenses: 2_500,
  liquidCashValue: 12_000,
  positions: [
    { id: 'cash', name: 'Cash', value: 12_000, assetClass: 'cash' },
    { id: 'world', name: 'ETF World', value: 30_000, assetClass: 'equity_global' },
    { id: 'bonds', name: 'Bonds', value: 8_000, assetClass: 'fixed_income' },
  ],
  goals: [],
  dailyWealth: [],
  // 12% of monthly expenses: below the 20% concentration trigger.
  topExpenses: [{ label: 'Loyer', category: 'housing', merchant: 'Bailleur', total: 300, count: 1 }],
}

describe('financial honesty: unknown values', () => {
  it('keeps the savings rate unknown when no income is observed and does not flag weak savings', () => {
    const snapshot = calculateAdvisorSnapshot({ ...baseInput, monthlyIncome: 0 })
    expect(snapshot.metrics.savingsRatePct).toBeNull()

    const recommendations = generateAdvisorRecommendations({ snapshot })
    const spendDiscipline = recommendations.find(item => item.id === 'spend-discipline')
    // Top expense share stays under 20% here, so an unknown savings rate must not trigger it.
    expect(spendDiscipline).toBeUndefined()
  })

  it('words an unknown savings rate as unavailable rather than 0% in evidence', () => {
    const snapshot = calculateAdvisorSnapshot({
      ...baseInput,
      monthlyIncome: 0,
      topExpenses: [
        { label: 'Loyer', category: 'housing', merchant: 'Bailleur', total: 1_500, count: 1 },
      ],
    })
    const recommendations = generateAdvisorRecommendations({ snapshot })
    const spendDiscipline = recommendations.find(item => item.id === 'spend-discipline')

    expect(spendDiscipline).toBeDefined()
    expect(spendDiscipline?.evidence).toContain('Taux d epargne observe: indisponible')
    expect(spendDiscipline?.evidence.join(' ')).not.toContain('observe: 0%')
  })

  it('keeps emergency fund and runway unavailable when liquid cash is partially unknown', () => {
    const snapshot = calculateAdvisorSnapshot({ ...baseInput, liquidCashValue: null })

    expect(snapshot.metrics.emergencyFundMonths).toBeNull()
    expect(snapshot.metrics.runwayMonths).toBeNull()
    expect(snapshot.assumptions.map(item => item.key)).toContain('liquid_cash_scope')

    const recommendations = generateAdvisorRecommendations({ snapshot })
    expect(recommendations.find(item => item.id === 'emergency-fund-gap')).toBeUndefined()
  })

  it('reports no drift and no allocation-based recommendation for an unvalued portfolio', () => {
    const snapshot = calculateAdvisorSnapshot({
      ...baseInput,
      liquidCashValue: null,
      positions: [],
    })

    expect(snapshot.metrics.totalValue).toBe(0)
    expect(snapshot.driftSignals).toEqual([])
    expect(snapshot.assumptions.map(item => item.key)).toContain('portfolio_valuation_scope')

    const recommendations = generateAdvisorRecommendations({ snapshot })
    expect(recommendations.some(item => item.type === 'rebalance_band')).toBe(false)
    expect(recommendations.some(item => item.type === 'rebalance_cash_drag')).toBe(false)
    expect(recommendations.some(item => item.type === 'reduce_concentration')).toBe(false)
  })

  it('keeps a true zero representable', () => {
    const snapshot = calculateAdvisorSnapshot({
      ...baseInput,
      monthlyIncome: 2_500,
      monthlyExpenses: 2_500,
    })

    expect(snapshot.metrics.savingsRatePct).toBe(0)
    expect(snapshot.metrics.netMonthlyCashflow).toBe(0)

    const recommendations = generateAdvisorRecommendations({ snapshot })
    const spendDiscipline = recommendations.find(item => item.id === 'spend-discipline')
    expect(spendDiscipline?.evidence).toContain('Taux d epargne observe: 0%')
  })
})
