import { describe, expect, it, vi } from 'vitest'
import { getDemoDashboardSummary } from './demo-data'
import { adaptDashboardSummaryLegacy } from './dashboard-legacy-adapter'

describe('adaptDashboardSummaryLegacy', () => {
  it('returns deterministic fallback payload when summary is missing', () => {
    const adapted = adaptDashboardSummaryLegacy({
      range: '30d',
      summary: undefined,
      mode: 'demo',
    })

    expect(adapted.range).toBe('30d')
    expect(adapted.totals).toEqual({
      balance: 0,
      incomes: 0,
      expenses: 0,
    })
    expect(adapted.connections).toEqual([])
    expect(adapted.assets).toEqual([])
    expect(adapted.positions).toEqual([])
    expect(adapted.dailyWealthSnapshots).toEqual([])
    expect(adapted.topExpenseGroups).toEqual([])
  })

  it('preserves a complete payload and logs divergence for range mismatch', () => {
    const base = getDemoDashboardSummary('7d')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const adapted = adaptDashboardSummaryLegacy({
      range: '30d',
      summary: base,
      mode: 'admin',
    })

    expect(adapted.totals).toEqual(base.totals)
    expect(adapted.connections).toEqual(base.connections)
    expect(adapted.topExpenseGroups).toEqual(base.topExpenseGroups)
    expect(consoleError).toHaveBeenCalledOnce()

    consoleError.mockRestore()
  })
})
