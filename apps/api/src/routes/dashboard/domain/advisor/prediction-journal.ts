import type { AdvisorInvestmentRecommendationDraft } from './investment-recommendation-contract'

export type AdvisorMarketHypothesisDraft = {
  recommendationId?: number | null
  runId?: number | null
  assetId?: string | null
  symbol: string
  accountScope: AdvisorInvestmentRecommendationDraft['accountScope']
  direction: 'bullish' | 'bearish' | 'neutral' | 'volatile' | 'defensive'
  actionSuggested: AdvisorInvestmentRecommendationDraft['action']
  horizon: AdvisorInvestmentRecommendationDraft['horizon']
  expectedMove?: number | null
  probability?: number | null
  confidence: number
  thesis: string
  supportingSignals: Array<Record<string, unknown>>
  contradictingSignals: Array<Record<string, unknown>>
  invalidationCriteria: Array<Record<string, unknown>>
  priceAtPrediction?: number | null
  priceSnapshotId?: number | null
  priceSource?: string | null
  priceSourceType?: string | null
  priceFreshness: Record<string, unknown> | null
  marketTimestamp?: string | null
  fetchedAt?: string | null
  reviewSchedule: Array<'J1' | 'J7' | 'J30'>
  status: 'open'
  createdByModel?: string | null
  promptVersion?: string | null
  strategyVersion?: string | null
}

export type PredictionOutcomeScore = {
  performance: number | null
  performanceVsBenchmark: number | null
  result: 'success' | 'failure' | 'mixed' | 'inconclusive' | 'skipped'
  errorAttribution: string | null
}

export const createHypothesisDraftFromRecommendation = ({
  recommendation,
  direction,
  createdByModel = null,
  promptVersion = null,
  strategyVersion = null,
}: {
  recommendation: AdvisorInvestmentRecommendationDraft
  direction: AdvisorMarketHypothesisDraft['direction']
  createdByModel?: string | null
  promptVersion?: string | null
  strategyVersion?: string | null
}): AdvisorMarketHypothesisDraft => ({
  runId: recommendation.runId ?? null,
  assetId: recommendation.assetId ?? null,
  symbol: recommendation.symbol,
  accountScope: recommendation.accountScope,
  direction,
  actionSuggested: recommendation.action,
  horizon: recommendation.horizon,
  expectedMove: recommendation.expectedMove ?? null,
  probability: recommendation.probability ?? null,
  confidence: recommendation.confidence,
  thesis: recommendation.thesis,
  supportingSignals: recommendation.supportingSignals,
  contradictingSignals: recommendation.contradictingSignals,
  invalidationCriteria: recommendation.invalidationCriteria,
  priceAtPrediction: recommendation.priceUsed ?? null,
  priceSnapshotId: recommendation.priceSnapshotId ?? null,
  priceSource: recommendation.priceSource ?? null,
  priceSourceType: recommendation.priceSourceType ?? null,
  priceFreshness: {
    isPriceStale: recommendation.isPriceStale,
    staleReason: recommendation.staleReason ?? null,
    delaySeconds: recommendation.delaySeconds ?? null,
    fetchedAt: recommendation.fetchedAt ?? null,
  },
  marketTimestamp: recommendation.marketTimestamp ?? null,
  fetchedAt: recommendation.fetchedAt ?? null,
  reviewSchedule:
    recommendation.reviewDates.length > 0 ? recommendation.reviewDates : ['J1', 'J7', 'J30'],
  status: 'open',
  createdByModel,
  promptVersion,
  strategyVersion,
})

export const scorePredictionOutcome = ({
  initialPrice,
  reviewPrice,
  benchmarkInitialPrice,
  benchmarkReviewPrice,
  expectedMove,
}: {
  initialPrice: number | null
  reviewPrice: number | null
  benchmarkInitialPrice?: number | null
  benchmarkReviewPrice?: number | null
  expectedMove?: number | null
}): PredictionOutcomeScore => {
  if (
    initialPrice === null ||
    reviewPrice === null ||
    !Number.isFinite(initialPrice) ||
    !Number.isFinite(reviewPrice) ||
    initialPrice <= 0
  ) {
    return {
      performance: null,
      performanceVsBenchmark: null,
      result: 'skipped',
      errorAttribution: 'missing_or_invalid_price',
    }
  }

  const performance = (reviewPrice - initialPrice) / initialPrice
  const benchmarkPerformance =
    benchmarkInitialPrice &&
    benchmarkReviewPrice &&
    Number.isFinite(benchmarkInitialPrice) &&
    Number.isFinite(benchmarkReviewPrice) &&
    benchmarkInitialPrice > 0
      ? (benchmarkReviewPrice - benchmarkInitialPrice) / benchmarkInitialPrice
      : null
  const performanceVsBenchmark =
    benchmarkPerformance === null ? null : performance - benchmarkPerformance

  if (expectedMove === null || expectedMove === undefined || expectedMove === 0) {
    return {
      performance,
      performanceVsBenchmark,
      result: 'inconclusive',
      errorAttribution: null,
    }
  }

  const expectedDirection = Math.sign(expectedMove)
  const actualDirection = Math.sign(performance)
  const result =
    actualDirection === 0 ? 'mixed' : actualDirection === expectedDirection ? 'success' : 'failure'

  return {
    performance,
    performanceVsBenchmark,
    result,
    errorAttribution: result === 'failure' ? 'expected_vs_actual_direction_mismatch' : null,
  }
}
