import { describe, expect, it } from 'vitest'
import { getDemoDashboardSummary } from './demo-data'
import { buildCockpitViewModel } from './cockpit-view-model'

describe('buildCockpitViewModel', () => {
  it('prefers the canonical valuation total over the legacy aggregate', () => {
    const summary = getDemoDashboardSummary('30d')
    summary.totals.balance = 999_999
    if (!summary.valuation) throw new Error('Demo valuation is required')
    summary.valuation = { ...summary.valuation, totalValueBase: 67_070.44 }

    expect(buildCockpitViewModel(summary).totalWealth).toBe(67_070.44)
  })

  it('does not turn an unavailable canonical total into zero', () => {
    const summary = getDemoDashboardSummary('30d')
    if (!summary.valuation) throw new Error('Demo valuation is required')
    summary.valuation = { ...summary.valuation, totalValueBase: null }

    expect(buildCockpitViewModel(summary).totalWealth).toBeNull()
    expect(buildCockpitViewModel(undefined).totalWealth).toBeNull()
  })

  it('preserves a real zero for available cash', () => {
    const summary = getDemoDashboardSummary('30d')
    summary.assets = summary.assets
      .filter(asset => asset.type === 'cash')
      .map(asset => ({ ...asset, valuation: 0, valueBase: 0 }))

    const available = buildCockpitViewModel(summary).breakdowns.find(
      breakdown => breakdown.key === 'available'
    )
    expect(available?.value).toBe(0)
  })

  it('keeps mixed-currency liquidity unavailable without base valuation', () => {
    const summary = getDemoDashboardSummary('30d')
    summary.assets = summary.assets
      .filter(asset => asset.type === 'cash')
      .map(asset => ({ ...asset, currency: 'USD', valueBase: null }))

    const available = buildCockpitViewModel(summary).breakdowns.find(
      breakdown => breakdown.key === 'available'
    )
    expect(available?.value).toBeNull()
  })
})
