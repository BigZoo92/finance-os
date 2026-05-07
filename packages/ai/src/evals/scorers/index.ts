import type { AiEvalCaseSeed, AiEvalCategory } from '../../types'
import { scoreCausalReasoning } from './causal'
import { scorePostMortemSafety } from './post-mortem'
import { scoreRiskCalibration } from './risk'
import type { ScoringResult } from './shared'
import { scoreStrategyQuality } from './strategy'

export type { ScoringResult } from './shared'
export {
  CAUSAL_OVERCLAIM_TERMS,
  EXECUTION_VOCABULARY,
  MISSING_DATA_FLAGS,
  STALE_DATA_FLAGS,
  STRATEGY_COST_TERMS,
  STRATEGY_DRAWDOWN_TERMS,
  STRATEGY_PAPER_FRAMING_TERMS,
  UNCERTAINTY_MARKERS,
  detectExecutionDirective,
  findExecutionDirectives,
} from './shared'
export { scoreCausalReasoning } from './causal'
export { scoreStrategyQuality } from './strategy'
export { scoreRiskCalibration } from './risk'
export { scorePostMortemSafety } from './post-mortem'

export const SCORED_CATEGORIES: ReadonlySet<AiEvalCategory> = new Set([
  'causal_reasoning',
  'strategy_quality',
  'risk_calibration',
  'post_mortem_safety',
])

export const isScoredCategory = (category: AiEvalCategory): boolean =>
  SCORED_CATEGORIES.has(category)

// Dispatches a case to the right deterministic scorer. Returns null if the case category is
// outside the PR2/PR4 scope (existing categories continue to be handled by the legacy runner).
export const scoreCase = (caseSeed: AiEvalCaseSeed): ScoringResult | null => {
  switch (caseSeed.category) {
    case 'causal_reasoning':
      return scoreCausalReasoning(caseSeed)
    case 'strategy_quality':
      return scoreStrategyQuality(caseSeed)
    case 'risk_calibration':
      return scoreRiskCalibration(caseSeed)
    case 'post_mortem_safety':
      return scorePostMortemSafety(caseSeed)
    default:
      return null
  }
}
