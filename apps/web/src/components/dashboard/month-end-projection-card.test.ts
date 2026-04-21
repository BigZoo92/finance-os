import { describe, expect, it } from 'vitest'
import { calculateMonthEndProjection, calculateMonthlyRecurringOverview, calculateProjectionTrend } from './month-end-projection-card'

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

  it('builds a daily trajectory for observed and projected month-end net values', () => {
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
      ],
    })

    expect(projection).not.toBeNull()
    if (!projection) {
      return
    }

    const trend = calculateProjectionTrend(projection)
    expect(trend).toHaveLength(30)
    expect(trend[0]).toEqual({ day: 1, cumulativeNet: 120 })
    expect(trend[9]).toEqual({ day: 10, cumulativeNet: 1200 })
    expect(trend.at(-1)).toEqual({ day: 30, cumulativeNet: 3600 })
  })
})

describe('calculateMonthlyRecurringOverview', () => {
  it('estimates monthly fixed charges and expected incomes from recurring transactions', () => {
    const overview = calculateMonthlyRecurringOverview([
      {
        id: 1,
        bookingDate: '2026-01-05',
        amount: -900,
        currency: 'EUR',
        direction: 'expense',
        label: 'LOYER APPARTEMENT JAN',
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
      {
        id: 2,
        bookingDate: '2026-02-05',
        amount: -905,
        currency: 'EUR',
        direction: 'expense',
        label: 'LOYER APPARTEMENT FEB',
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
      {
        id: 3,
        bookingDate: '2026-03-05',
        amount: -895,
        currency: 'EUR',
        direction: 'expense',
        label: 'LOYER APPARTEMENT MAR',
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
      {
        id: 4,
        bookingDate: '2026-01-28',
        amount: 2100,
        currency: 'EUR',
        direction: 'income',
        label: 'SALAIRE ACME JAN',
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
        accountName: null,
      },
      {
        id: 5,
        bookingDate: '2026-02-28',
        amount: 2090,
        currency: 'EUR',
        direction: 'income',
        label: 'SALAIRE ACME FEB',
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
        accountName: null,
      },
      {
        id: 6,
        bookingDate: '2026-03-28',
        amount: 2110,
        currency: 'EUR',
        direction: 'income',
        label: 'SALAIRE ACME MAR',
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
        accountName: null,
      },
    ])

    expect(overview).not.toBeNull()
    expect(overview?.fixedChargesMonthlyTotal).toBe(895)
    expect(overview?.expectedIncomeMonthlyTotal).toBe(2110)
    expect(overview?.expectedNetMonthlyAfterFixedCharges).toBe(1215)
    expect(overview?.fixedCharges).toEqual([
      {
        canonicalLabel: 'loyer appartement',
        lastKnownAmount: 895,
        occurrences: 3,
      },
    ])
    expect(overview?.expectedIncomes).toEqual([
      {
        canonicalLabel: 'salaire acme',
        lastKnownAmount: 2110,
        occurrences: 3,
      },
    ])
  })
})
