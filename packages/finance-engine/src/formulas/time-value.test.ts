import { describe, expect, it } from 'bun:test'
import {
  calculateCagr,
  calculateFutureValue,
  calculatePresentValue,
  calculateRealReturn,
} from './time-value'

describe('time-value formulas', () => {
  it('computes future value with monthly contributions', () => {
    const result = calculateFutureValue({
      presentValue: 10_000,
      periodicContribution: 500,
      annualRatePct: 7,
      years: 10,
      periodsPerYear: 12,
    })

    expect(result).toBe(106639.02)
  })

  it('computes present value and CAGR with guardrails', () => {
    expect(
      calculatePresentValue({
        futureValue: 20_000,
        annualRatePct: 5,
        years: 5,
      })
    ).toBe(15670.52)

    expect(
      calculateCagr({
        beginningValue: 10_000,
        endingValue: 18_000,
        years: 6,
      })
    ).toBe(10.2924)

    expect(
      calculateCagr({
        beginningValue: 0,
        endingValue: 18_000,
        years: 6,
      })
    ).toBeNull()
  })

  it('computes inflation-adjusted return', () => {
    expect(
      calculateRealReturn({
        nominalReturnPct: 7,
        inflationPct: 2.5,
      })
    ).toBe(4.3902)
  })
})
