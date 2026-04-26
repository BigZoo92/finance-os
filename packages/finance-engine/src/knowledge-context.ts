import type { AdvisorSnapshot, DeterministicRecommendation } from './types'

export interface FinanceKnowledgeContextQuery {
  query: string
  tags: string[]
  maxResults: number
  maxPathDepth: number
}

export const buildAdvisorKnowledgeContextQuery = ({
  snapshot,
  recommendations,
}: {
  snapshot: AdvisorSnapshot
  recommendations: DeterministicRecommendation[]
}): FinanceKnowledgeContextQuery => {
  const categories = recommendations.map(item => item.category)
  const stressedMetrics = [
    snapshot.metrics.cashDragPct >= 0.6 ? 'cash drag opportunity cost' : null,
    snapshot.metrics.emergencyFundMonths !== null &&
    snapshot.metrics.emergencyFundMonths < snapshot.targets.emergencyFundMonths
      ? 'emergency fund ratio liquidity risk'
      : null,
    snapshot.metrics.topPositionSharePct >= 35 ? 'concentration risk diversification' : null,
    snapshot.driftSignals.some(signal => signal.status !== 'within_band')
      ? 'allocation drift rebalancing bands'
      : null,
  ].filter((item): item is string => item !== null)

  return {
    query: [
      'advisor recommendation context',
      snapshot.riskProfile,
      ...categories,
      ...stressedMetrics,
    ].join(' '),
    tags: Array.from(new Set(['advisor', 'financial-math', 'risk', ...categories])),
    maxResults: 12,
    maxPathDepth: 3,
  }
}
