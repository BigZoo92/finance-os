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
    expect(adapted.migration).toEqual({
      stage: 'legacy-fallback',
      fallbackFieldCount: 7,
      fallbackFields: [
        'totals',
        'connections',
        'accounts',
        'assets',
        'positions',
        'dailyWealthSnapshots',
        'topExpenseGroups',
      ],
      hasDivergence: false,
    })
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
    expect(adapted.migration).toEqual({
      stage: 'contract-divergence',
      fallbackFieldCount: 0,
      fallbackFields: [],
      hasDivergence: true,
    })
    expect(consoleError).toHaveBeenCalledOnce()

    consoleError.mockRestore()
  })

  it('reports mixed fallback when only part of the payload is present', () => {
    const base = getDemoDashboardSummary('30d')
    const partialSummary = {
      ...base,
      assets: undefined,
    } as unknown as Parameters<typeof adaptDashboardSummaryLegacy>[0]['summary']

    const adapted = adaptDashboardSummaryLegacy({
      range: '30d',
      summary: partialSummary,
      mode: 'admin',
    })

    expect(adapted.assets).toEqual([])
    expect(adapted.migration).toEqual({
      stage: 'mixed-fallback',
      fallbackFieldCount: 1,
      fallbackFields: ['assets'],
      hasDivergence: false,
    })
  })
})
