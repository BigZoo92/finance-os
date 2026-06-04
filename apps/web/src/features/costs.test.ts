import { describe, expect, it } from 'vitest'
import { describeCostBasis } from './costs'

describe('describeCostBasis', () => {
  it('flags an estimate so the UI never presents it as a real billed amount', () => {
    const estimated = describeCostBasis('estimated')
    expect(estimated.isEstimate).toBe(true)
    expect(estimated.label).not.toMatch(/réel/i)
  })

  it('marks a fully billed window as real', () => {
    const actual = describeCostBasis('actual')
    expect(actual.isEstimate).toBe(false)
    expect(actual.label).toMatch(/réel/i)
  })

  it('flags a mixed window as still containing an estimate', () => {
    const mixed = describeCostBasis('mixed')
    expect(mixed.isEstimate).toBe(true)
    expect(mixed.label).toMatch(/estimé/i)
  })
})
