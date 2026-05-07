import { describe, expect, it } from 'bun:test'
import type { AiEvalCaseSeed } from '../../types'
import { scoreCausalReasoning } from './causal'

const baseExpectation = {
  maxConfidence: 0.7,
  minEvidenceCount: 2,
  requireUncertaintyMarkers: true,
  requireAlternatives: true,
  bannedCausalClaims: ['caused', 'because', 'guaranteed', 'directly led to'],
}

const buildCase = (
  candidateOutput: Record<string, unknown>,
  expectation: Record<string, unknown> = baseExpectation
): AiEvalCaseSeed => ({
  key: `causal-test-${Math.random().toString(36).slice(2, 8)}`,
  category: 'causal_reasoning',
  description: 'unit',
  input: { candidateOutput },
  expectation,
})

describe('scoreCausalReasoning', () => {
  it('fails on overconfident causal wording with weak evidence', () => {
    const result = scoreCausalReasoning(
      buildCase({
        whyNow:
          'The Fed announcement directly led to the index drop because rate expectations changed.',
        evidence: ['Single news headline'],
        confidence: 0.92,
        alternatives: [],
      })
    )
    expect(result.passed).toBe(false)
    expect(result.failedExpectations.some(r => r.startsWith('overclaim_terms_present'))).toBe(true)
    expect(result.failedExpectations.some(r => r.startsWith('confidence_above_cap'))).toBe(true)
    expect(result.failedExpectations).toContain('missing_uncertainty_markers')
    expect(result.failedExpectations).toContain('missing_alternative_explanations')
    expect(result.failedExpectations).toContain('evidence_below_minimum:1<2')
  })

  it('passes when uncertainty and alternative explanations are present', () => {
    const result = scoreCausalReasoning(
      buildCase({
        whyNow:
          'The price drop is correlated with the Fed announcement, but this is correlation and may have alternative explanations such as month-end positioning.',
        evidence: ['Headline', 'Volume spike on the same day'],
        confidence: 0.55,
        alternatives: ['Month-end positioning', 'Pre-existing technical breakdown'],
      })
    )
    expect(result.passed).toBe(true)
    expect(result.failedExpectations).toEqual([])
  })

  it('flags overclaim vocabulary even when written in French', () => {
    // Omit bannedCausalClaims so the scorer falls back to its bilingual default
    // (CAUSAL_OVERCLAIM_TERMS includes French terms like "a entrainé" and "parce que").
    const result = scoreCausalReasoning(
      buildCase(
        {
          whyNow: "L'annonce a entrainé la chute parce que les taux ont surpris.",
          evidence: ['depeche 1', 'depeche 2'],
          confidence: 0.5,
          alternatives: ['rotation sectorielle'],
        },
        {
          maxConfidence: 0.7,
          minEvidenceCount: 2,
          requireUncertaintyMarkers: false,
          requireAlternatives: false,
        }
      )
    )
    expect(result.passed).toBe(false)
    expect(result.failedExpectations.some(r => r.startsWith('overclaim_terms_present'))).toBe(true)
  })

  it('treats confidence at the cap as passing', () => {
    const result = scoreCausalReasoning(
      buildCase({
        whyNow:
          'The relationship is correlational and may have alternative drivers worth investigating.',
        evidence: ['Headline', 'Cross-asset move'],
        confidence: 0.7,
        alternatives: ['Liquidity-driven move'],
      })
    )
    expect(result.passed).toBe(true)
  })
})
