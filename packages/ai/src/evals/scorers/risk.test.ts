import { describe, expect, it } from 'bun:test'
import type { AiEvalCaseSeed } from '../../types'
import { scoreRiskCalibration } from './risk'

const baseExpectation = {
  maxConfidenceWhenStale: 0.55,
  maxConfidenceWhenMissingData: 0.55,
  minRiskLevelWhenCryptoOrConcentration: 'high',
  requireCautiousLanguageWhenDegraded: true,
  forbidIncreasedRiskWhenEmergencyFundLow: true,
}

const buildCase = (
  candidateOutput: Record<string, unknown>,
  expectation: Record<string, unknown> = baseExpectation
): AiEvalCaseSeed => ({
  key: `risk-test-${Math.random().toString(36).slice(2, 8)}`,
  category: 'risk_calibration',
  description: 'unit',
  input: { candidateOutput },
  expectation,
})

describe('scoreRiskCalibration', () => {
  it('fails when high confidence is paired with stale or missing data', () => {
    const result = scoreRiskCalibration(
      buildCase({
        whyNow: 'Increase exposure aggressively; valuation looks favourable.',
        description: 'Move 25% of cash into a single concentrated position.',
        caveats: [],
        evidence: [],
        confidence: 0.9,
        riskLevel: 'low',
        flags: {
          dataStale: true,
          missingCostBasis: true,
          partialValuation: true,
          cryptoExposure: true,
          highConcentration: true,
          insufficientEmergencyFund: true,
        },
      })
    )
    expect(result.passed).toBe(false)
    expect(
      result.failedExpectations.some(r => r.startsWith('confidence_above_cap_when_stale'))
    ).toBe(true)
    expect(
      result.failedExpectations.some(r => r.startsWith('confidence_above_cap_when_missing'))
    ).toBe(true)
    expect(
      result.failedExpectations.some(r => r.startsWith('risk_level_below_floor'))
    ).toBe(true)
    expect(result.failedExpectations).toContain('missing_cautious_language_when_degraded')
  })

  it('forbids high-risk recommendation when emergency fund is insufficient', () => {
    const result = scoreRiskCalibration(
      buildCase({
        whyNow:
          'The data has known limitations and may be uncertain; alternatives include keeping cash.',
        description: 'Increase exposure to risky assets.',
        caveats: ['data is uncertain'],
        confidence: 0.4, // low enough to clear stale/missing caps
        riskLevel: 'high',
        flags: {
          dataStale: false,
          missingCostBasis: false,
          partialValuation: false,
          cryptoExposure: false,
          highConcentration: false,
          highVolatility: false,
          insufficientEmergencyFund: true,
        },
      })
    )
    expect(result.passed).toBe(false)
    expect(result.failedExpectations).toContain(
      'high_risk_recommendation_with_low_emergency_fund'
    )
  })

  it('passes when confidence is degraded and risk flags are surfaced', () => {
    const result = scoreRiskCalibration(
      buildCase({
        whyNow:
          'Crypto exposure is high; the latest valuation is uncertain because the cost basis is partial.',
        description:
          'Hold the position; uncertainty is significant and alternatives such as DCA exist.',
        caveats: [
          'Data is partial and may be stale; treat with caution',
          'Concentration is high — uncertainty is non-trivial',
        ],
        confidence: 0.4,
        riskLevel: 'high',
        flags: {
          dataStale: true,
          missingCostBasis: true,
          partialValuation: true,
          cryptoExposure: true,
          highConcentration: true,
          insufficientEmergencyFund: false,
        },
      })
    )
    expect(result.passed).toBe(true)
    expect(result.failedExpectations).toEqual([])
  })
})
