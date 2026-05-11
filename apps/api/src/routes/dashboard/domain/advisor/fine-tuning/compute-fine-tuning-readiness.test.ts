// Macro Prompt 6 — Fine-tuning readiness gate tests.

import { describe, expect, it } from 'bun:test'
import { computeFineTuningReadiness } from './compute-fine-tuning-readiness'

const FIXED_NOW = new Date('2026-05-10T12:00:00.000Z')

describe('computeFineTuningReadiness', () => {
  it('returns not_recommended for a fresh deployment with no signals', () => {
    const result = computeFineTuningReadiness({
      mode: 'admin',
      now: FIXED_NOW,
      latestEvalRun: null,
      decisionsWithOutcomes: 0,
      totalDecisions: 0,
      postMortems: { total: 0, failed: 0, executionVocabularyHits: 0 },
      dataQualityGrade: null,
      privacyPlanAccepted: false,
      improvementTargetDocumented: false,
      rollbackPlanDocumented: false,
    })
    expect(result.ready).toBe(false)
    expect(result.level).toBe('not_recommended')
  })

  it('flags privacy_export_plan_not_accepted as a hard blocker', () => {
    const result = computeFineTuningReadiness({
      mode: 'admin',
      now: FIXED_NOW,
      latestEvalRun: { totalCases: 30, passedCases: 30, failedCases: 0 },
      decisionsWithOutcomes: 50,
      totalDecisions: 60,
      postMortems: { total: 10, failed: 0, executionVocabularyHits: 0 },
      dataQualityGrade: 'good',
      privacyPlanAccepted: false,
      improvementTargetDocumented: true,
      rollbackPlanDocumented: true,
    })
    expect(result.blockers).toContain('privacy_export_plan_not_accepted')
    expect(result.level).toBe('not_recommended')
  })

  it('returns candidate_later only when all blockers resolved AND thresholds met', () => {
    const result = computeFineTuningReadiness({
      mode: 'admin',
      now: FIXED_NOW,
      latestEvalRun: { totalCases: 30, passedCases: 30, failedCases: 0 },
      decisionsWithOutcomes: 50,
      totalDecisions: 60,
      postMortems: { total: 10, failed: 0, executionVocabularyHits: 0 },
      dataQualityGrade: 'good',
      privacyPlanAccepted: true,
      improvementTargetDocumented: true,
      rollbackPlanDocumented: true,
    })
    expect(result.level).toBe('candidate_later')
    expect(result.ready).toBe(true)
  })

  it('promotes to premature when some thresholds unmet but no blockers', () => {
    const result = computeFineTuningReadiness({
      mode: 'admin',
      now: FIXED_NOW,
      latestEvalRun: { totalCases: 10, passedCases: 10, failedCases: 0 },
      decisionsWithOutcomes: 50,
      totalDecisions: 60,
      postMortems: { total: 10, failed: 0, executionVocabularyHits: 0 },
      dataQualityGrade: 'good',
      privacyPlanAccepted: true,
      improvementTargetDocumented: true,
      rollbackPlanDocumented: true,
    })
    // Only one threshold reason should fire (eval count below threshold) → premature
    expect(result.level).toBe('premature')
    expect(result.reasons.some(r => r.startsWith('eval_case_count_below_threshold:'))).toBe(true)
  })

  it('returns the safe_alternatives list verbatim', () => {
    const result = computeFineTuningReadiness({
      mode: 'admin',
      now: FIXED_NOW,
      latestEvalRun: null,
      decisionsWithOutcomes: 0,
      totalDecisions: 0,
      postMortems: { total: 0, failed: 0, executionVocabularyHits: 0 },
      dataQualityGrade: null,
      privacyPlanAccepted: false,
      improvementTargetDocumented: false,
      rollbackPlanDocumented: false,
    })
    expect(result.safeAlternatives).toContain('prompt_template_versioning')
    expect(result.safeAlternatives).toContain('deterministic_eval_expansion')
    expect(result.safeAlternatives).toContain('retrieval_context_improvement')
    expect(result.safeAlternatives).toContain('post_mortem_review')
    expect(result.safeAlternatives).toContain('data_quality_improvement')
  })

  it('caveats explicitly state the gate does not perform fine-tuning or export data', () => {
    const result = computeFineTuningReadiness({
      mode: 'admin',
      now: FIXED_NOW,
      latestEvalRun: null,
      decisionsWithOutcomes: 0,
      totalDecisions: 0,
      postMortems: { total: 0, failed: 0, executionVocabularyHits: 0 },
      dataQualityGrade: null,
      privacyPlanAccepted: false,
      improvementTargetDocumented: false,
      rollbackPlanDocumented: false,
    })
    expect(result.caveats).toContain('gate_does_not_perform_fine_tuning')
    expect(result.caveats).toContain('gate_does_not_export_data')
    expect(result.caveats).toContain('gate_does_not_call_a_model')
  })

  it('flags execution-vocabulary hits in post-mortems as a blocker', () => {
    const result = computeFineTuningReadiness({
      mode: 'admin',
      now: FIXED_NOW,
      latestEvalRun: { totalCases: 30, passedCases: 30, failedCases: 0 },
      decisionsWithOutcomes: 50,
      totalDecisions: 60,
      postMortems: { total: 10, failed: 0, executionVocabularyHits: 2 },
      dataQualityGrade: 'good',
      privacyPlanAccepted: true,
      improvementTargetDocumented: true,
      rollbackPlanDocumented: true,
    })
    expect(result.blockers).toContain('post_mortem_emitted_execution_vocabulary:2')
    expect(result.level).toBe('not_recommended')
  })

  it('response carries no raw financial data fields', () => {
    const result = computeFineTuningReadiness({
      mode: 'admin',
      now: FIXED_NOW,
      latestEvalRun: { totalCases: 30, passedCases: 30, failedCases: 0 },
      decisionsWithOutcomes: 50,
      totalDecisions: 60,
      postMortems: { total: 10, failed: 0, executionVocabularyHits: 0 },
      dataQualityGrade: 'good',
      privacyPlanAccepted: true,
      improvementTargetDocumented: true,
      rollbackPlanDocumented: true,
    })
    const text = JSON.stringify(result).toLowerCase()
    expect(text).not.toContain('account_balance')
    expect(text).not.toContain('transaction_amount')
    expect(text).not.toContain('iban')
    expect(text).not.toContain('freenote')
    expect(text).not.toContain('rawpayload')
  })
})
