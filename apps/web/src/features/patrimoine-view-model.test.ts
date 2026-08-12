import { describe, expect, it } from 'vitest'
import { getDemoDashboardSummary } from './demo-data'
import { buildPatrimoineViewModel } from './patrimoine-view-model'

describe('patrimoine view model', () => {
  it('uses the canonical valuation total instead of the legacy balance', () => {
    const summary = getDemoDashboardSummary('30d')
    summary.totals.balance = 1
    if (!summary.valuation) throw new Error('Demo valuation is required')
    summary.valuation = { ...summary.valuation, totalValueBase: 42_000 }
    expect(buildPatrimoineViewModel(summary).totalValue).toBe(42_000)
  })

  it('keeps a missing canonical total unavailable', () => {
    const summary = getDemoDashboardSummary('30d')
    summary.valuation = null
    expect(buildPatrimoineViewModel(summary).totalValue).toBeNull()
  })

  it('does not sum a native non-EUR valuation without a base value', () => {
    const summary = getDemoDashboardSummary('30d')
    const asset = summary.assets[0]
    if (!asset) throw new Error('Demo asset is required')
    summary.assets = [
      {
        ...asset,
        type: 'cash',
        currency: 'USD',
        valuation: 12_000,
        valueBase: null,
      },
    ]
    const cash = buildPatrimoineViewModel(summary).buckets.find(bucket => bucket.key === 'cash')
    expect(cash?.value).toBeNull()
    expect(cash?.unknownValueCount).toBe(1)
  })

  it('respects an explicitly unavailable base value', () => {
    const summary = getDemoDashboardSummary('30d')
    const asset = summary.assets[0]
    if (!asset) throw new Error('Demo asset is required')
    summary.assets = [{ ...asset, type: 'cash', currency: 'EUR', valueBase: null }]
    expect(
      buildPatrimoineViewModel(summary).buckets.find(bucket => bucket.key === 'cash')?.value
    ).toBeNull()
  })

  it('does not present legacy snapshots as canonical history', () => {
    const summary = getDemoDashboardSummary('30d')
    expect(summary.dailyWealthSnapshots.length).toBeGreaterThan(0)
    expect(buildPatrimoineViewModel(summary).historyAvailable).toBe(false)
  })
})
