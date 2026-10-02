import type { DashboardSummaryResponse } from '../types'

export interface AdvisorFinancialContext {
  range: DashboardSummaryResponse['range']
  totals: {
    /** Null when the summary balance is unknown (an enabled asset has no valuation). */
    balance: number | null
    incomes: number
    expenses: number
    netCashflow: number
    spendRatio: number
  }
  patrimoine: {
    /** Null when at least one enabled asset of the scope has no valuation. */
    totalAssets: number | null
    investmentAssets: number | null
    cashAssets: number | null
  }
  focus: {
    topExpenseLabel: string | null
    topExpenseAmount: number | null
    topExpenseCount: number | null
  }
}

const roundToTwo = (value: number) => Math.round(value * 100) / 100

const roundToTwoOrNull = (value: number | null) => (value === null ? null : roundToTwo(value))

// Sums known valuations; any unknown member makes the sum unknown, never smaller.
const sumKnownValuations = (assets: DashboardSummaryResponse['assets']): number | null => {
  let total = 0
  for (const asset of assets) {
    if (asset.valuation === null) {
      return null
    }
    total += asset.valuation
  }
  return total
}

export const buildAdvisorFinancialContext = (
  summary: DashboardSummaryResponse
): AdvisorFinancialContext => {
  const netCashflow = summary.totals.incomes - summary.totals.expenses
  const spendRatio =
    summary.totals.incomes > 0 ? summary.totals.expenses / summary.totals.incomes : 1

  const totalAssets = sumKnownValuations(summary.assets)
  const investmentAssets = sumKnownValuations(
    summary.assets.filter(asset => asset.type === 'investment')
  )
  const cashAssets = sumKnownValuations(summary.assets.filter(asset => asset.type === 'cash'))

  const topExpense = summary.topExpenseGroups[0]

  return {
    range: summary.range,
    totals: {
      balance: roundToTwoOrNull(summary.totals.balance),
      incomes: roundToTwo(summary.totals.incomes),
      expenses: roundToTwo(summary.totals.expenses),
      netCashflow: roundToTwo(netCashflow),
      spendRatio: roundToTwo(spendRatio),
    },
    patrimoine: {
      totalAssets: roundToTwoOrNull(totalAssets),
      investmentAssets: roundToTwoOrNull(investmentAssets),
      cashAssets: roundToTwoOrNull(cashAssets),
    },
    focus: {
      topExpenseLabel: topExpense?.label ?? null,
      topExpenseAmount: topExpense ? roundToTwo(topExpense.total) : null,
      topExpenseCount: topExpense?.count ?? null,
    },
  }
}
