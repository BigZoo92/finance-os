import { describe, expect, it } from 'bun:test'
import {
  downgradeUnsafeBuyRecommendation,
  validateInvestmentRecommendationContract,
  type AdvisorInvestmentRecommendationDraft,
} from './investment-recommendation-contract'

const baseDraft: AdvisorInvestmentRecommendationDraft = {
  accountScope: 'IBKR',
  symbol: 'AAPL',
  action: 'buy',
  horizon: '30d',
  thesis: 'Quality compounder with improving margin setup.',
  supportingSignals: [],
  contradictingSignals: [],
  riskLevel: 'medium',
  confidence: 0.62,
  priceUsed: 200,
  priceSnapshotId: 1,
  priceSource: 'twelvedata',
  priceSourceType: 'delayed',
  marketTimestamp: '2026-05-04T14:45:00.000Z',
  fetchedAt: '2026-05-04T15:00:00.000Z',
  delaySeconds: 900,
  isPriceStale: false,
  invalidationCriteria: [],
  reviewDates: ['J1', 'J7', 'J30'],
  missingData: [],
  humanValidationRequired: true,
  noAutoTrade: true,
}

describe('investment recommendation contract', () => {
  it('accepts a buy recommendation only when provenance and guardrails are present', () => {
    expect(validateInvestmentRecommendationContract(baseDraft)).toEqual({ ok: true })
  })

  it('rejects buy recommendations without a price snapshot', () => {
    const result = validateInvestmentRecommendationContract({
      ...baseDraft,
      priceSnapshotId: null,
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'BUY_REQUIRES_PRICE_SNAPSHOT',
    })
  })

  it('downgrades stale buy recommendations to insufficient_data', () => {
    const downgraded = downgradeUnsafeBuyRecommendation({
      ...baseDraft,
      isPriceStale: true,
      staleReason: 'provider_stale',
    })

    expect(downgraded.action).toBe('insufficient_data')
    expect(downgraded.missingData).toContain('BUY_REQUIRES_FRESH_PRICE')
    expect(downgraded.noAutoTrade).toBe(true)
    expect(downgraded.humanValidationRequired).toBe(true)
  })
})
