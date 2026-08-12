import { describe, expect, it } from 'vitest'
import { getDemoDashboardSummary } from './demo-data'
import { buildExpensePeriodViewModel, canCompareMonthlyBudgets } from './expenses-view-model'

describe('expenses view model', () => {
  it('uses authoritative summary totals independently of loaded transaction pages', () => {
    const summary = getDemoDashboardSummary('30d')
    const model = buildExpensePeriodViewModel(summary)
    expect(model.expenses).toBe(summary.totals.expenses)
    expect(model.incomes).toBe(summary.totals.incomes)
    expect(model.net).toBe(summary.totals.incomes - summary.totals.expenses)
  })

  it('does not label a mixed-currency aggregate with a currency', () => {
    const summary = getDemoDashboardSummary('30d')
    const account = summary.accounts[0]
    if (!account) throw new Error('Demo account is required')
    summary.accounts[0] = { ...account, currency: 'USD' }
    const model = buildExpensePeriodViewModel(summary)
    expect(model.currency).toBeNull()
    expect(model.expenses).toBeNull()
  })

  it('does not compare monthly budgets with rolling ranges', () => {
    expect(canCompareMonthlyBudgets('7d')).toBe(false)
    expect(canCompareMonthlyBudgets('30d')).toBe(false)
    expect(canCompareMonthlyBudgets('90d')).toBe(false)
  })
})
