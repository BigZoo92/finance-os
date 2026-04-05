import { describe, expect, it } from 'vitest'
import { calculateMonthEndProjection } from './month-end-projection-card'

describe('calculateMonthEndProjection', () => {
  it('returns a linear projection based on current month transactions', () => {
    const projection = calculateMonthEndProjection({
      referenceDate: new Date('2026-04-10T12:00:00.000Z'),
      transactions: [
        {
          id: 1,
          bookingDate: '2026-04-01',
          amount: 2000,
          currency: 'EUR',
          direction: 'income',
          label: 'Salaire',
          category: null,
          subcategory: null,
          resolvedCategory: null,
          resolutionSource: 'fallback',
          resolutionRuleId: null,
          resolutionTrace: [],
          incomeType: 'salary',
          tags: [],
          powensConnectionId: 'conn-a',
          powensAccountId: 'acc-a',
          accountName: 'Main',
        },
        {
          id: 2,
          bookingDate: '2026-04-05',
          amount: -800,
          currency: 'EUR',
          direction: 'expense',
          label: 'Loyer',
          category: null,
          subcategory: null,
          resolvedCategory: null,
          resolutionSource: 'fallback',
          resolutionRuleId: null,
          resolutionTrace: [],
          incomeType: null,
          tags: [],
          powensConnectionId: 'conn-a',
          powensAccountId: 'acc-a',
          accountName: 'Main',
        },
        {
          id: 3,
          bookingDate: '2026-03-28',
          amount: -999,
          currency: 'EUR',
          direction: 'expense',
          label: 'Ignored previous month',
          category: null,
          subcategory: null,
          resolvedCategory: null,
          resolutionSource: 'fallback',
          resolutionRuleId: null,
          resolutionTrace: [],
          incomeType: null,
          tags: [],
          powensConnectionId: 'conn-a',
          powensAccountId: 'acc-a',
          accountName: 'Main',
        },
      ],
    })

    expect(projection).not.toBeNull()
    expect(projection?.transactionsCount).toBe(2)
    expect(projection?.netToDate).toBe(1200)
    expect(projection?.daysElapsed).toBe(10)
    expect(projection?.daysRemaining).toBe(20)
    expect(projection?.averageNetPerDay).toBe(120)
    expect(projection?.projectedNetAtMonthEnd).toBe(3600)
  })

  it('returns null when there are no transactions in the current month', () => {
    const projection = calculateMonthEndProjection({
      referenceDate: new Date('2026-04-10T12:00:00.000Z'),
      transactions: [
        {
          id: 9,
          bookingDate: '2026-03-30',
          amount: 100,
          currency: 'EUR',
          direction: 'income',
          label: 'Old month',
          category: null,
          subcategory: null,
          resolvedCategory: null,
          resolutionSource: 'fallback',
          resolutionRuleId: null,
          resolutionTrace: [],
          incomeType: null,
          tags: [],
          powensConnectionId: 'conn-a',
          powensAccountId: 'acc-a',
          accountName: null,
        },
      ],
    })

    expect(projection).toBeNull()
  })
})
