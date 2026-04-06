import { describe, expect, it } from 'vitest'
import { buildSparklinePath, buildWealthHistoryExplanation, summarizeWealthHistory } from './wealth-history'

describe('wealth history helpers', () => {
  it('summarizes the visible range delta/high/low', () => {
    const summary = summarizeWealthHistory([
      { date: '2026-03-17', balance: 100 },
      { date: '2026-03-18', balance: 90 },
      { date: '2026-03-19', balance: 125 },
    ])

    expect(summary.change).toBe(25)
    expect(summary.low).toEqual({ date: '2026-03-18', balance: 90 })
    expect(summary.high).toEqual({ date: '2026-03-19', balance: 125 })
    expect(summary.latest).toEqual({ date: '2026-03-19', balance: 125 })
  })

  it('builds a deterministic sparkline path', () => {
    expect(
      buildSparklinePath([
        { date: '2026-03-17', balance: 100 },
        { date: '2026-03-18', balance: 90 },
        { date: '2026-03-19', balance: 125 },
      ], 120, 60, 10)
    ).toBe('M 10.00 38.57 L 60.00 50.00 L 110.00 10.00')
  })

  it('provides a lightweight explain-this message based on trend direction', () => {
    expect(
      buildWealthHistoryExplanation({
        change: 1200,
        periodLabel: '14 jours',
      })
    ).toContain('progresse')

    expect(
      buildWealthHistoryExplanation({
        change: -300,
        periodLabel: '7 jours',
      })
    ).toContain('recule')
  })
})
