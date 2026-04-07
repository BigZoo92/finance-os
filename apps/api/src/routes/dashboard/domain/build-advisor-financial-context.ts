import type { DashboardSummaryResponse } from '../types'

export interface AdvisorFinancialContext {
  range: DashboardSummaryResponse['range']
  totals: {
    balance: number
    incomes: number
    expenses: number
    netCashflow: number
    spendRatio: number
  }
  patrimoine: {
    totalAssets: number
    investmentAssets: number
    cashAssets: number
  }
  focus: {
    topExpenseLabel: string | null
    topExpenseAmount: number | null
    topExpenseCount: number | null
  }
}

const roundToTwo = (value: number) => Math.round(value * 100) / 100

export const buildAdvisorFinancialContext = (
  summary: DashboardSummaryResponse
): AdvisorFinancialContext => {
  const netCashflow = summary.totals.incomes - summary.totals.expenses
  const spendRatio =
    summary.totals.incomes > 0 ? summary.totals.expenses / summary.totals.incomes : 1

  const totalAssets = summary.assets.reduce((acc, asset) => acc + asset.valuation, 0)
  const investmentAssets = summary.assets
    .filter(asset => asset.type === 'investment')
    .reduce((acc, asset) => acc + asset.valuation, 0)
  const cashAssets = summary.assets
    .filter(asset => asset.type === 'cash')
    .reduce((acc, asset) => acc + asset.valuation, 0)

  const topExpense = summary.topExpenseGroups[0]

  return {
    range: summary.range,
    totals: {
      balance: roundToTwo(summary.totals.balance),
      incomes: roundToTwo(summary.totals.incomes),
      expenses: roundToTwo(summary.totals.expenses),
      netCashflow: roundToTwo(netCashflow),
      spendRatio: roundToTwo(spendRatio),
    },
    patrimoine: {
      totalAssets: roundToTwo(totalAssets),
      investmentAssets: roundToTwo(investmentAssets),
      cashAssets: roundToTwo(cashAssets),
    },
    focus: {
      topExpenseLabel: topExpense?.label ?? null,
      topExpenseAmount: topExpense ? roundToTwo(topExpense.total) : null,
      topExpenseCount: topExpense?.count ?? null,
    },
  }
}
