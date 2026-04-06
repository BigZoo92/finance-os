import { describe, expect, it } from 'vitest'
import { getTrendDirection, summarizeCashflowDirection } from './trend-visuals'

describe('trend visuals', () => {
  it('detects direction from start/end values', () => {
    expect(getTrendDirection({ start: 100, end: 150 })).toBe('up')
    expect(getTrendDirection({ start: 100, end: 30 })).toBe('down')
    expect(getTrendDirection({ start: 100, end: 100.001, epsilon: 0.01 })).toBe('neutral')
  })

  it('returns balanced shares and neutral direction when totals are empty', () => {
    expect(summarizeCashflowDirection({ incomes: 0, expenses: 0 })).toEqual({
      net: 0,
      direction: 'neutral',
      incomeSharePercent: 50,
      expenseSharePercent: 50,
    })
  })

  it('computes signed net and relative income/expense shares', () => {
    expect(summarizeCashflowDirection({ incomes: 700, expenses: 300 })).toEqual({
      net: 400,
      direction: 'up',
      incomeSharePercent: 70,
      expenseSharePercent: 30,
    })
  })
})
