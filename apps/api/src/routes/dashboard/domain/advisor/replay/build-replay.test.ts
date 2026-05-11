// Macro Prompt 6 — Advisor replay builder tests.

import { describe, expect, it } from 'bun:test'
import { buildAdvisorReplay } from './build-replay'

const FIXED_NOW = new Date('2026-05-10T12:00:00.000Z')

describe('buildAdvisorReplay', () => {
  it('reports recommendations with no decision as unresolved', () => {
    const result = buildAdvisorReplay({
      mode: 'admin',
      now: FIXED_NOW,
      windowDays: 30,
      recommendations: [
        { id: 1, recommendationKey: 'rec-1', createdAt: '2026-05-08T08:00:00.000Z' },
        { id: 2, recommendationKey: 'rec-2', createdAt: '2026-05-09T08:00:00.000Z' },
        { id: 3, recommendationKey: 'rec-3', createdAt: '2026-05-09T08:00:00.000Z' },
      ],
      decisions: [],
      postMortems: [],
      dataQualityKnown: true,
      dataQualityGrade: 'good',
      dataQualityStale: false,
      latestEvalRun: null,
    })
    expect(result.summary.recommendationsReviewed).toBe(3)
    expect(result.summary.unresolved).toBe(3)
    expect(result.patterns.find(p => p.kind === 'unresolved_recommendation')?.count).toBe(3)
    expect(result.items.every(item => item.decision === null)).toBe(true)
    expect(result.items.every(item => item.outcomeKind === null)).toBe(true)
  })

  it('flags repeated_negative_acceptance when 2+ accepted decisions had negative outcomes', () => {
    const result = buildAdvisorReplay({
      mode: 'admin',
      now: FIXED_NOW,
      windowDays: 30,
      recommendations: [
        { id: 1, recommendationKey: 'rec-1', createdAt: '2026-05-01T00:00:00.000Z' },
        { id: 2, recommendationKey: 'rec-2', createdAt: '2026-05-02T00:00:00.000Z' },
      ],
      decisions: [
        {
          id: 100,
          recommendationId: 1,
          decision: 'accepted',
          outcomes: [{ outcomeKind: 'negative', learningTags: ['learning_tag'] }],
        },
        {
          id: 101,
          recommendationId: 2,
          decision: 'accepted',
          outcomes: [{ outcomeKind: 'negative', learningTags: [] }],
        },
      ],
      postMortems: [],
      dataQualityKnown: true,
      dataQualityGrade: 'good',
      dataQualityStale: false,
      latestEvalRun: null,
    })
    const pattern = result.patterns.find(p => p.kind === 'repeated_negative_acceptance')
    expect(pattern).toBeDefined()
    expect(pattern?.count).toBe(2)
  })

  it('flags missing_outcome when decisions exist but no outcomes recorded', () => {
    const result = buildAdvisorReplay({
      mode: 'admin',
      now: FIXED_NOW,
      windowDays: 30,
      recommendations: [
        { id: 1, recommendationKey: 'rec-1', createdAt: '2026-05-01T00:00:00.000Z' },
      ],
      decisions: [{ id: 100, recommendationId: 1, decision: 'accepted', outcomes: [] }],
      postMortems: [],
      dataQualityKnown: true,
      dataQualityGrade: 'good',
      dataQualityStale: false,
      latestEvalRun: null,
    })
    expect(result.patterns.find(p => p.kind === 'missing_outcome')?.count).toBe(1)
    expect(result.items[0]?.outcomeKind).toBeNull()
  })

  it('flags low_eval_confidence when latest eval run pass rate is below 60%', () => {
    const result = buildAdvisorReplay({
      mode: 'admin',
      now: FIXED_NOW,
      windowDays: 30,
      recommendations: [],
      decisions: [],
      postMortems: [],
      dataQualityKnown: true,
      dataQualityGrade: 'good',
      dataQualityStale: false,
      latestEvalRun: { status: 'completed', totalCases: 10, passedCases: 4, failedCases: 6 },
    })
    expect(result.patterns.find(p => p.kind === 'low_eval_confidence')).toBeDefined()
  })

  it('flags stale_data_context when data quality is stale', () => {
    const result = buildAdvisorReplay({
      mode: 'admin',
      now: FIXED_NOW,
      windowDays: 30,
      recommendations: [],
      decisions: [],
      postMortems: [],
      dataQualityKnown: true,
      dataQualityGrade: 'good',
      dataQualityStale: true,
      latestEvalRun: null,
    })
    expect(result.patterns.find(p => p.kind === 'stale_data_context')).toBeDefined()
  })

  it('always sets dataQualityAtReview to current_only and emits no_causality_claim caveat', () => {
    const result = buildAdvisorReplay({
      mode: 'admin',
      now: FIXED_NOW,
      windowDays: 30,
      recommendations: [
        { id: 1, recommendationKey: 'rec-1', createdAt: '2026-05-01T00:00:00.000Z' },
      ],
      decisions: [],
      postMortems: [],
      dataQualityKnown: true,
      dataQualityGrade: 'good',
      dataQualityStale: false,
      latestEvalRun: null,
    })
    expect(result.items[0]?.dataQualityAtReview).toBe('current_only')
    expect(result.caveats).toContain('no_causality_claim')
    expect(result.caveats).toContain('data_quality_at_review_is_current_only')
  })

  it('does not propagate freeNote in any item field', () => {
    // The builder accepts no freeNote — this test asserts the response shape
    // never grew a freeNote leak.
    const result = buildAdvisorReplay({
      mode: 'admin',
      now: FIXED_NOW,
      windowDays: 30,
      recommendations: [
        { id: 1, recommendationKey: 'rec-1', createdAt: '2026-05-01T00:00:00.000Z' },
      ],
      decisions: [
        {
          id: 100,
          recommendationId: 1,
          decision: 'accepted',
          outcomes: [{ outcomeKind: 'positive', learningTags: ['benign'] }],
        },
      ],
      postMortems: [],
      dataQualityKnown: true,
      dataQualityGrade: 'good',
      dataQualityStale: false,
      latestEvalRun: null,
    })
    expect(JSON.stringify(result).toLowerCase()).not.toContain('freenote')
  })
})
