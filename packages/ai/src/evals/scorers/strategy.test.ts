import { describe, expect, it } from 'bun:test'
import type { AiEvalCaseSeed } from '../../types'
import { scoreStrategyQuality } from './strategy'

const baseExpectation = {
  minTradeCount: 100,
  maxConfidenceWhenLowSample: 0.6,
  requireFeesOrSlippageMention: true,
  requireDrawdownMention: true,
  requirePaperFraming: true,
  requireInvalidationCriteria: true,
  requireWalkForwardOutOfSample: true,
}

const buildCase = (
  candidateOutput: Record<string, unknown>,
  expectation: Record<string, unknown> = baseExpectation
): AiEvalCaseSeed => ({
  key: `strategy-test-${Math.random().toString(36).slice(2, 8)}`,
  category: 'strategy_quality',
  description: 'unit',
  input: { candidateOutput },
  expectation,
})

describe('scoreStrategyQuality', () => {
  it('fails with too few trades and no caveats', () => {
    const result = scoreStrategyQuality(
      buildCase({
        description: 'EMA crossover backtest with 14 trades. Recommended to deploy at full size.',
        whyNow: 'Backtest result projects continued outperformance.',
        caveats: [],
        invalidationCriteria: [],
        tradeCount: 14,
        confidence: 0.83,
        walkForwardOutOfSampleCount: 0,
      })
    )
    expect(result.passed).toBe(false)
    expect(result.failedExpectations).toContain('trade_count_below_minimum:14<100')
    expect(
      result.failedExpectations.some(r => r.startsWith('confidence_above_cap_for_low_sample'))
    ).toBe(true)
    expect(result.failedExpectations).toContain('missing_fees_or_slippage_mention')
    expect(result.failedExpectations).toContain('missing_drawdown_mention')
    expect(result.failedExpectations).toContain('missing_paper_only_framing')
    expect(result.failedExpectations).toContain('missing_invalidation_criteria')
    expect(result.failedExpectations).toContain('missing_walk_forward_out_of_sample')
  })

  it('passes when sample size, fees, slippage, drawdown, paper framing, invalidation, and walk-forward are present', () => {
    const result = scoreStrategyQuality(
      buildCase({
        description:
          'Paper-only EMA crossover hypothesis. Fees and slippage modeled at 10bps; max drawdown 18%.',
        caveats: [
          'Sample is paper-only and not a prediction',
          'Costs include fees and slippage at realistic levels',
        ],
        invalidationCriteria: ['Fails if 30-day live rolling Sharpe < 0 over walk-forward'],
        tradeCount: 240,
        confidence: 0.5,
        walkForwardOutOfSampleCount: 60,
      })
    )
    expect(result.passed).toBe(true)
    expect(result.failedExpectations).toEqual([])
  })

  it('does not raise the confidence cap when sample size is sufficient', () => {
    const result = scoreStrategyQuality(
      buildCase({
        description: 'Robust paper-only strategy with fees, slippage, drawdown analysis.',
        caveats: ['Paper-only run, not financial advice'],
        invalidationCriteria: ['Stop if walk-forward Sharpe collapses'],
        tradeCount: 500,
        confidence: 0.9, // above maxConfidenceWhenLowSample, but sample is high → no fail
        walkForwardOutOfSampleCount: 120,
      })
    )
    expect(result.passed).toBe(true)
  })
})
