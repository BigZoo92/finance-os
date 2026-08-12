import type { DashboardSummaryResponse } from './dashboard-types'

export type ExpensePeriodViewModel = {
  currency: string | null
  expenses: number | null
  incomes: number | null
  net: number | null
  categories: Array<{ category: string; total: number; ratio: number }>
  structureIsPartial: boolean
}

export const buildExpensePeriodViewModel = (
  summary: DashboardSummaryResponse | null | undefined
): ExpensePeriodViewModel => {
  if (!summary) {
    return {
      currency: null,
      expenses: null,
      incomes: null,
      net: null,
      categories: [],
      structureIsPartial: false,
    }
  }

  const currencies = new Set(
    summary.accounts.filter(account => account.enabled).map(account => account.currency)
  )
  const currency = currencies.size === 1 ? ([...currencies][0] ?? null) : null
  const expenses = currency ? summary.totals.expenses : null
  const incomes = currency ? summary.totals.incomes : null
  const net = expenses === null || incomes === null ? null : incomes - expenses

  const totalsByCategory = new Map<string, number>()
  for (const group of summary.topExpenseGroups) {
    const category = group.category.trim() || 'Sans catégorie'
    totalsByCategory.set(category, (totalsByCategory.get(category) ?? 0) + group.total)
  }
  const categories = [...totalsByCategory.entries()]
    .map(([category, total]) => ({
      category,
      total,
      ratio: expenses !== null && expenses > 0 ? (total / expenses) * 100 : 0,
    }))
    .sort((left, right) => right.total - left.total)
  const represented = categories.reduce((sum, category) => sum + category.total, 0)

  return {
    currency,
    expenses,
    incomes,
    net,
    categories,
    structureIsPartial: expenses !== null && represented + 0.01 < expenses,
  }
}

export const canCompareMonthlyBudgets = (_range: '7d' | '30d' | '90d') => false
