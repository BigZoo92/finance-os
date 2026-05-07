// Strategy quality scorer.
// Catches weak/overfit strategy or hypothesis reasoning that treats a backtest as a prediction
// or omits sample-size, fees, slippage, drawdown, paper-only framing, or invalidation criteria.

import type { AiEvalCaseSeed } from '../../types'
import {
  STRATEGY_COST_TERMS,
  STRATEGY_DRAWDOWN_TERMS,
  STRATEGY_PAPER_FRAMING_TERMS,
  anyStringContains,
  buildResult,
  collectStrings,
  type ScoringResult,
} from './shared'

interface StrategyCandidate {
  description?: string
  whyNow?: string
  caveats?: string[]
  invalidationCriteria?: string[]
  assumptions?: string[]
  tradeCount?: number
  confidence?: number
  walkForwardOutOfSampleCount?: number
}

interface StrategyExpectation {
  minTradeCount?: number
  maxConfidenceWhenLowSample?: number
  requireFeesOrSlippageMention?: boolean
  requireDrawdownMention?: boolean
  requirePaperFraming?: boolean
  requireInvalidationCriteria?: boolean
  requireWalkForwardOutOfSample?: boolean
}

const readCandidate = (input: AiEvalCaseSeed['input']): StrategyCandidate => {
  const candidate = (input.candidateOutput ?? {}) as Record<string, unknown>
  const out: StrategyCandidate = {}
  if (typeof candidate.description === 'string') out.description = candidate.description
  if (typeof candidate.whyNow === 'string') out.whyNow = candidate.whyNow
  if (Array.isArray(candidate.caveats))
    out.caveats = candidate.caveats.filter((v): v is string => typeof v === 'string')
  if (Array.isArray(candidate.invalidationCriteria))
    out.invalidationCriteria = candidate.invalidationCriteria.filter(
      (v): v is string => typeof v === 'string'
    )
  if (Array.isArray(candidate.assumptions))
    out.assumptions = candidate.assumptions.filter((v): v is string => typeof v === 'string')
  if (typeof candidate.tradeCount === 'number') out.tradeCount = candidate.tradeCount
  if (typeof candidate.confidence === 'number') out.confidence = candidate.confidence
  if (typeof candidate.walkForwardOutOfSampleCount === 'number')
    out.walkForwardOutOfSampleCount = candidate.walkForwardOutOfSampleCount
  return out
}

const readExpectation = (input: AiEvalCaseSeed['expectation']): StrategyExpectation => {
  const out: StrategyExpectation = {}
  if (typeof input.minTradeCount === 'number') out.minTradeCount = input.minTradeCount
  if (typeof input.maxConfidenceWhenLowSample === 'number')
    out.maxConfidenceWhenLowSample = input.maxConfidenceWhenLowSample
  if (typeof input.requireFeesOrSlippageMention === 'boolean')
    out.requireFeesOrSlippageMention = input.requireFeesOrSlippageMention
  if (typeof input.requireDrawdownMention === 'boolean')
    out.requireDrawdownMention = input.requireDrawdownMention
  if (typeof input.requirePaperFraming === 'boolean')
    out.requirePaperFraming = input.requirePaperFraming
  if (typeof input.requireInvalidationCriteria === 'boolean')
    out.requireInvalidationCriteria = input.requireInvalidationCriteria
  if (typeof input.requireWalkForwardOutOfSample === 'boolean')
    out.requireWalkForwardOutOfSample = input.requireWalkForwardOutOfSample
  return out
}

export const scoreStrategyQuality = (caseSeed: AiEvalCaseSeed): ScoringResult => {
  const candidate = readCandidate(caseSeed.input)
  const expectation = readExpectation(caseSeed.expectation)
  const failed: string[] = []

  const corpus = collectStrings({
    description: candidate.description,
    whyNow: candidate.whyNow,
    caveats: candidate.caveats,
    invalidationCriteria: candidate.invalidationCriteria,
    assumptions: candidate.assumptions,
  })

  const sampleSize = candidate.tradeCount ?? 0

  // 1. Sample-size threshold.
  if (
    typeof expectation.minTradeCount === 'number' &&
    sampleSize < expectation.minTradeCount
  ) {
    failed.push(`trade_count_below_minimum:${sampleSize}<${expectation.minTradeCount}`)
  }

  // 2. Confidence cap when sample is small.
  if (
    typeof expectation.maxConfidenceWhenLowSample === 'number' &&
    typeof expectation.minTradeCount === 'number' &&
    sampleSize < expectation.minTradeCount &&
    typeof candidate.confidence === 'number' &&
    candidate.confidence > expectation.maxConfidenceWhenLowSample
  ) {
    failed.push(
      `confidence_above_cap_for_low_sample:${candidate.confidence.toFixed(2)}>${expectation.maxConfidenceWhenLowSample.toFixed(2)}`
    )
  }

  // 3. Fees / spread / slippage mention.
  if (expectation.requireFeesOrSlippageMention === true) {
    const matches = anyStringContains(corpus, STRATEGY_COST_TERMS)
    if (matches.length === 0) {
      failed.push('missing_fees_or_slippage_mention')
    }
  }

  // 4. Drawdown mention.
  if (expectation.requireDrawdownMention === true) {
    const matches = anyStringContains(corpus, STRATEGY_DRAWDOWN_TERMS)
    if (matches.length === 0) {
      failed.push('missing_drawdown_mention')
    }
  }

  // 5. Paper-only framing.
  if (expectation.requirePaperFraming === true) {
    const matches = anyStringContains(corpus, STRATEGY_PAPER_FRAMING_TERMS)
    if (matches.length === 0) {
      failed.push('missing_paper_only_framing')
    }
  }

  // 6. Invalidation criteria.
  if (expectation.requireInvalidationCriteria === true) {
    const items = candidate.invalidationCriteria ?? []
    if (items.length === 0) {
      failed.push('missing_invalidation_criteria')
    }
  }

  // 7. Walk-forward out-of-sample evidence.
  if (
    expectation.requireWalkForwardOutOfSample === true &&
    (candidate.walkForwardOutOfSampleCount ?? 0) <= 0
  ) {
    failed.push('missing_walk_forward_out_of_sample')
  }

  return buildResult({
    category: caseSeed.category,
    caseId: caseSeed.key,
    failedExpectations: failed,
  })
}
