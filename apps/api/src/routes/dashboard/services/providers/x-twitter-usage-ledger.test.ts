import { describe, expect, it } from 'bun:test'
import { resolveCostBasis } from './x-twitter-usage-ledger'

describe('x usage cost basis (actual prioritized, estimate labeled)', () => {
  it('labels the window as estimated when no row carries a billed amount', () => {
    expect(resolveCostBasis(0, 5)).toBe('estimated')
    expect(resolveCostBasis(0, 0)).toBe('estimated')
  })

  it('labels the window as actual when every row is billed (actual takes precedence)', () => {
    expect(resolveCostBasis(5, 5)).toBe('actual')
  })

  it('labels the window as mixed when only some rows are billed', () => {
    expect(resolveCostBasis(2, 5)).toBe('mixed')
  })
})
