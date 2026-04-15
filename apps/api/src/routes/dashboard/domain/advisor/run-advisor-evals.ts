import type { AiBudgetState, AiEvalCaseSeed } from '@finance-os/ai'
import type { AdvisorSnapshot, DeterministicRecommendation } from '@finance-os/finance-engine'

export const runAdvisorEvals = ({
  cases,
  snapshot,
  recommendations,
  budgetState,
  degraded,
}: {
  cases: AiEvalCaseSeed[]
  snapshot: AdvisorSnapshot
  recommendations: DeterministicRecommendation[]
  budgetState: AiBudgetState
  degraded: boolean
}) => {
  const failures: string[] = []

  for (const item of cases) {
    if (item.key === 'budget-overrun-disables-deep') {
      if (budgetState.dailyUsdSpent / Math.max(budgetState.dailyBudgetUsd, 1) >= 0.8 && budgetState.deepAnalysisAllowed) {
        failures.push(item.key)
      }
      continue
    }

    if (item.key === 'insufficient-data-degrades') {
      if ((snapshot.metrics.totalValue <= 0 || recommendations.length === 0) && !degraded) {
        failures.push(item.key)
      }
      continue
    }

    if (item.key === 'recommendation-needs-evidence') {
      const tooConfident = recommendations.some(
        recommendation => recommendation.evidence.length < 2 && recommendation.confidence > 0.85
      )
      if (tooConfident) {
        failures.push(item.key)
      }
      continue
    }

    if (item.key === 'challenger-detects-weak-causality') {
      const weakCausalityConfirmed = recommendations.some(
        recommendation =>
          recommendation.category === 'caution' &&
          recommendation.confidence > 0.75 &&
          recommendation.evidence.length < 2
      )
      if (weakCausalityConfirmed) {
        failures.push(item.key)
      }
    }
  }

  return {
    status: failures.length > 0 ? ('degraded' as const) : ('completed' as const),
    totalCases: cases.length,
    passedCases: cases.length - failures.length,
    failedCases: failures.length,
    summary: {
      failedCaseKeys: failures,
      degraded,
      recommendationCount: recommendations.length,
    },
  }
}
