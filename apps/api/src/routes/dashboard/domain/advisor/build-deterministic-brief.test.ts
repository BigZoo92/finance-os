import { describe, expect, it } from 'bun:test'
import { calculateAdvisorSnapshot } from '@finance-os/finance-engine'
import { buildDeterministicBrief } from './build-deterministic-brief'

const valuedInput = {
  asOf: '2026-09-25T08:00:00.000Z',
  range: '30d' as const,
  currency: 'EUR',
  monthlyIncome: 4_000,
  monthlyExpenses: 2_500,
  liquidCashValue: 10_000,
  positions: [
    { id: 'cash', name: 'Cash', value: 10_000, assetClass: 'cash' as const },
    { id: 'world', name: 'ETF World', value: 30_000, assetClass: 'equity_global' as const },
  ],
  goals: [],
  dailyWealth: [],
  topExpenses: [],
}

describe('buildDeterministicBrief', () => {
  it('prints observed liquidity metrics when they are known', () => {
    const snapshot = calculateAdvisorSnapshot(valuedInput)
    const brief = buildDeterministicBrief({ snapshot, recommendations: [], signals: [] })

    expect(brief.keyFacts).toContain('Fonds d urgence: 4 mois de depenses')
    expect(brief.watchItems.some(item => item.startsWith('Runway estime: '))).toBe(true)
    expect(brief.watchItems).not.toContain('Runway estime: indisponible')
  })

  it('never prints 0 months or 0% for unknown liquidity or an unvalued portfolio', () => {
    const snapshot = calculateAdvisorSnapshot({
      ...valuedInput,
      liquidCashValue: null,
      positions: [],
    })
    const brief = buildDeterministicBrief({ snapshot, recommendations: [], signals: [] })

    expect(brief.title).toBe('Point quotidien conservative: valorisation indisponible')
    expect(brief.keyFacts).toContain('Fonds d urgence: indisponible')
    expect(brief.keyFacts).toContain('Cash drag estime: indisponible')
    expect(brief.keyFacts).toContain('Concentration max: indisponible')
    expect(brief.watchItems).toContain('Runway estime: indisponible')
    expect(brief.summary).not.toContain('cash represente 0%')
    expect(brief.summary).toContain('Aucune position valorisee')
    expect(JSON.stringify(brief)).not.toMatch(/: 0 mois|cash 0%/)
  })
})
