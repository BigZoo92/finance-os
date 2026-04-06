import { describe, expect, it } from 'vitest'
import { summarizeExpenseCategories, summarizeExpenseTimeline } from './expense-structure-card'
import type { DashboardTransactionsResponse } from '@/features/dashboard-types'

const buildTx = (
  overrides: Partial<DashboardTransactionsResponse['items'][number]>
): DashboardTransactionsResponse['items'][number] => ({
  id: 1,
  bookingDate: '2026-01-01',
  amount: -10,
  currency: 'EUR',
  direction: 'expense',
  label: 'transaction',
  category: 'Courses',
  subcategory: null,
  resolvedCategory: null,
  resolutionSource: 'fallback',
  resolutionRuleId: null,
  resolutionTrace: [],
  incomeType: null,
  tags: [],
  powensConnectionId: 'conn_1',
  powensAccountId: 'acc_1',
  accountName: null,
  ...overrides,
})

describe('expense structure helpers', () => {
  it('summarizes expense categories with ratios and sorting', () => {
    const rows = summarizeExpenseCategories([
      buildTx({ id: 1, amount: -60, category: 'Courses' }),
      buildTx({ id: 2, amount: -40, category: 'Transport' }),
      buildTx({ id: 3, amount: 100, direction: 'income', category: 'Revenus' }),
      buildTx({ id: 4, amount: -20, category: null }),
    ])

    expect(rows.map(row => row.category)).toEqual(['Courses', 'Transport', 'Sans categorie'])
    expect(rows.map(row => row.total)).toEqual([60, 40, 20])
    expect(rows[0]?.ratio).toBeCloseTo(50)
    expect(rows[2]?.ratio).toBeCloseTo(16.666, 2)
  })

  it('builds monthly timeline from expense transactions only', () => {
    const rows = summarizeExpenseTimeline([
      buildTx({ id: 1, bookingDate: '2026-01-10', amount: -100 }),
      buildTx({ id: 2, bookingDate: '2026-01-25', amount: -50 }),
      buildTx({ id: 3, bookingDate: '2026-02-02', amount: -75 }),
      buildTx({ id: 4, bookingDate: '2026-02-20', amount: 200, direction: 'income' }),
    ])

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ month: '2026-01', total: 150 })
    expect(rows[1]).toMatchObject({ month: '2026-02', total: 75 })
  })
})
