import { describe, expect, it } from 'bun:test'
import {
  createHypothesisDraftFromRecommendation,
  scorePredictionOutcome,
} from './prediction-journal'
import type { AdvisorInvestmentRecommendationDraft } from './investment-recommendation-contract'

const recommendation: AdvisorInvestmentRecommendationDraft = {
  runId: 7,
  accountScope: 'Binance',
  symbol: 'BTC',
  action: 'watch',
  horizon: '7d',
  thesis: 'Momentum is improving but macro signals are mixed.',
  supportingSignals: [{ signal: 'momentum' }],
  contradictingSignals: [{ signal: 'macro_uncertainty' }],
  riskLevel: 'high',
  confidence: 0.55,
  priceUsed: 65000,
  priceSnapshotId: 42,
  priceSource: 'binance',
  priceSourceType: 'exchange',
  marketTimestamp: '2026-05-04T10:00:00.000Z',
  fetchedAt: '2026-05-04T10:00:02.000Z',
  delaySeconds: 2,
  isPriceStale: false,
  invalidationCriteria: [{ below: 61000 }],
  expectedMove: 0.04,
  probability: 0.57,
  reviewDates: ['J1', 'J7', 'J30'],
  missingData: [],
  humanValidationRequired: true,
  noAutoTrade: true,
}

describe('prediction journal foundation', () => {
  it('creates a testable hypothesis draft from an investment recommendation', () => {
    const hypothesis = createHypothesisDraftFromRecommendation({
      recommendation,
      direction: 'bullish',
      createdByModel: 'local-test-model',
      promptVersion: 'prompt-v1',
      strategyVersion: 'strategy-v1',
    })

    expect(hypothesis.symbol).toBe('BTC')
    expect(hypothesis.accountScope).toBe('Binance')
    expect(hypothesis.reviewSchedule).toEqual(['J1', 'J7', 'J30'])
    expect(hypothesis.priceFreshness).toMatchObject({ isPriceStale: false, delaySeconds: 2 })
    expect(hypothesis.status).toBe('open')
  })

  it('scores expected-vs-actual direction without mutating strategy', () => {
    const success = scorePredictionOutcome({
      initialPrice: 100,
      reviewPrice: 106,
      benchmarkInitialPrice: 100,
      benchmarkReviewPrice: 102,
      expectedMove: 0.03,
    })

    expect(success.result).toBe('success')
    expect(success.performance).toBeCloseTo(0.06)
    expect(success.performanceVsBenchmark).toBeCloseTo(0.04)

    const failure = scorePredictionOutcome({
      initialPrice: 100,
      reviewPrice: 95,
      expectedMove: 0.03,
    })
    expect(failure.result).toBe('failure')
    expect(failure.errorAttribution).toBe('expected_vs_actual_direction_mismatch')
  })
})
