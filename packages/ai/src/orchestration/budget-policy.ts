import type { AiBudgetState } from '../types'

const round = (value: number, digits = 4) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export const computeAiBudgetState = ({
  dailyUsdSpent,
  monthlyUsdSpent,
  dailyBudgetUsd,
  monthlyBudgetUsd,
  challengerDisableRatio = 0.75,
  deepAnalysisDisableRatio = 0.5,
}: {
  dailyUsdSpent: number
  monthlyUsdSpent: number
  dailyBudgetUsd: number
  monthlyBudgetUsd: number
  challengerDisableRatio?: number
  deepAnalysisDisableRatio?: number
}): AiBudgetState => {
  const normalizedDailyBudget = Math.max(dailyBudgetUsd, 0)
  const normalizedMonthlyBudget = Math.max(monthlyBudgetUsd, 0)
  const reasons: string[] = []

  const dailyRatio =
    normalizedDailyBudget > 0 ? dailyUsdSpent / normalizedDailyBudget : Number.POSITIVE_INFINITY
  const monthlyRatio =
    normalizedMonthlyBudget > 0
      ? monthlyUsdSpent / normalizedMonthlyBudget
      : Number.POSITIVE_INFINITY

  const blocked =
    normalizedDailyBudget <= 0 ||
    normalizedMonthlyBudget <= 0 ||
    dailyUsdSpent >= normalizedDailyBudget ||
    monthlyUsdSpent >= normalizedMonthlyBudget

  if (normalizedDailyBudget <= 0) {
    reasons.push('daily_budget_non_positive')
  }

  if (normalizedMonthlyBudget <= 0) {
    reasons.push('monthly_budget_non_positive')
  }

  if (dailyUsdSpent >= normalizedDailyBudget && normalizedDailyBudget > 0) {
    reasons.push('daily_budget_exceeded')
  }

  if (monthlyUsdSpent >= normalizedMonthlyBudget && normalizedMonthlyBudget > 0) {
    reasons.push('monthly_budget_exceeded')
  }

  const challengerAllowed =
    !blocked &&
    dailyRatio < challengerDisableRatio &&
    monthlyRatio < challengerDisableRatio

  if (!challengerAllowed && !blocked) {
    reasons.push('challenger_budget_guard')
  }

  const deepAnalysisAllowed =
    !blocked &&
    dailyRatio < deepAnalysisDisableRatio &&
    monthlyRatio < deepAnalysisDisableRatio

  if (!deepAnalysisAllowed && !blocked) {
    reasons.push('deep_analysis_budget_guard')
  }

  return {
    dailyUsdSpent: round(dailyUsdSpent),
    monthlyUsdSpent: round(monthlyUsdSpent),
    dailyBudgetUsd: round(normalizedDailyBudget),
    monthlyBudgetUsd: round(normalizedMonthlyBudget),
    challengerAllowed,
    deepAnalysisAllowed,
    blocked,
    reasons,
  }
}
