import type { AiBudgetState, AiEvalCaseSeed } from '@finance-os/ai'
import { isScoredCategory, scoreCase } from '@finance-os/ai'
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
  // Per-case structured failure detail for the new deterministic scorer categories.
  // The shape of `summary.failedCaseKeys` is unchanged; this is an additive sibling field.
  const failedCaseDetails: Array<{
    caseId: string
    category: AiEvalCaseSeed['category']
    failedExpectations: string[]
  }> = []

  for (const item of cases) {
    // PR2 deterministic scorers (causal_reasoning, strategy_quality, risk_calibration).
    // Each scorer is pure: no network, no LLM, no provider, no graph.
    if (isScoredCategory(item.category)) {
      const result = scoreCase(item)
      if (result && !result.passed) {
        failures.push(item.key)
        failedCaseDetails.push({
          caseId: result.caseId,
          category: item.category,
          failedExpectations: result.failedExpectations,
        })
      }
      continue
    }

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
      // Additive: detailed reasons for the new scorer categories. Existing consumers that read
      // `failedCaseKeys` continue to work unchanged.
      failedCaseDetails,
      degraded,
      recommendationCount: recommendations.length,
    },
  }
}
