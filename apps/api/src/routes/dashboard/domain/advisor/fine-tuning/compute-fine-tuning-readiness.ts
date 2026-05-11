// Macro Prompt 6 — Fine-tuning readiness gate (deterministic).
//
// Pure function. The caller is responsible for fetching:
//   - the latest eval run summary,
//   - the recent decision-journal counts,
//   - the recent post-mortem counts,
//   - the data quality response.
//
// Output is conservative by design. The default outcome for a fresh deployment
// is `not_recommended` — the gate will only return `candidate_later` once the
// thresholds in `fine-tuning-types.ts` are met AND a privacy/export plan is
// confirmed by the caller (see `privacyPlanAccepted` flag).

import {
  type AdvisorFineTuningReadinessResponse,
  FINE_TUNING_DEFAULT_SAFE_ALTERNATIVES,
  FINE_TUNING_THRESHOLDS,
  type FineTuningReadinessLevel,
} from './fine-tuning-types'

export interface FineTuningReadinessInputs {
  readonly mode: 'demo' | 'admin'
  readonly now: Date
  /** Latest eval run summary. May be null if no run has happened yet. */
  readonly latestEvalRun: {
    readonly totalCases: number
    readonly passedCases: number
    readonly failedCases: number
  } | null
  /** Distinct decision count with at least one outcome row. */
  readonly decisionsWithOutcomes: number
  /** Total decisions in window (used for ratios). */
  readonly totalDecisions: number
  /** Post-mortem stats over the window. */
  readonly postMortems: {
    readonly total: number
    readonly failed: number
    readonly executionVocabularyHits: number
  }
  /** Data quality grade reported by the data-quality use-case. May be null. */
  readonly dataQualityGrade: string | null
  /** Whether a privacy/export plan has been signed off (defaults to false). */
  readonly privacyPlanAccepted: boolean
  /** Whether a measurable improvement target has been documented. */
  readonly improvementTargetDocumented: boolean
  /** Whether a rollback plan has been documented. */
  readonly rollbackPlanDocumented: boolean
}

const isAcceptableDataQualityGrade = (grade: string | null): boolean => {
  if (!grade) return false
  return (FINE_TUNING_THRESHOLDS.acceptableDataQualityGrades as ReadonlyArray<string>).includes(
    grade
  )
}

export const computeFineTuningReadiness = (
  input: FineTuningReadinessInputs
): AdvisorFineTuningReadinessResponse => {
  const reasons: string[] = []
  const blockers: string[] = []
  const required: string[] = []

  const totalEvalCases = input.latestEvalRun?.totalCases ?? 0
  if (totalEvalCases < FINE_TUNING_THRESHOLDS.minScoredEvalCasesPerCategory) {
    reasons.push(
      `eval_case_count_below_threshold:${totalEvalCases}/${FINE_TUNING_THRESHOLDS.minScoredEvalCasesPerCategory}`
    )
    required.push('expand_deterministic_eval_coverage')
  }

  if (input.decisionsWithOutcomes < FINE_TUNING_THRESHOLDS.minDecisionsWithOutcomes) {
    reasons.push(
      `decisions_with_outcomes_below_threshold:${input.decisionsWithOutcomes}/${FINE_TUNING_THRESHOLDS.minDecisionsWithOutcomes}`
    )
    required.push('record_more_decision_outcomes')
  }

  if (input.postMortems.total > 0) {
    const failureRate = input.postMortems.failed / input.postMortems.total
    if (failureRate > FINE_TUNING_THRESHOLDS.maxPostMortemFailureRate) {
      reasons.push(`post_mortem_failure_rate_too_high:${failureRate.toFixed(2)}`)
      required.push('reduce_post_mortem_failure_rate')
    }
  }

  if (input.postMortems.executionVocabularyHits > 0) {
    blockers.push(
      `post_mortem_emitted_execution_vocabulary:${input.postMortems.executionVocabularyHits}`
    )
  }

  if (!isAcceptableDataQualityGrade(input.dataQualityGrade)) {
    reasons.push(`data_quality_grade_unacceptable:${input.dataQualityGrade ?? 'unknown'}`)
    required.push('improve_data_quality_to_at_least_usable')
  }

  if (!input.privacyPlanAccepted) {
    blockers.push('privacy_export_plan_not_accepted')
    required.push('accept_privacy_export_plan')
  }

  if (!input.improvementTargetDocumented) {
    blockers.push('measurable_improvement_target_missing')
    required.push('document_measurable_improvement_target')
  }

  if (!input.rollbackPlanDocumented) {
    blockers.push('rollback_plan_missing')
    required.push('document_rollback_plan')
  }

  let level: FineTuningReadinessLevel = 'not_recommended'
  if (blockers.length === 0 && reasons.length === 0) {
    level = 'candidate_later'
  } else if (blockers.length === 0 && reasons.length <= 2) {
    level = 'premature'
  } else if (blockers.length === 0) {
    level = 'research_only'
  } else {
    level = 'not_recommended'
  }

  // Conservative override: even when all numeric thresholds are met, we keep
  // `candidate_later` as the maximum level. The gate intentionally does not
  // express "ready" — fine-tuning is never recommended by this gate alone.
  const ready = level === 'candidate_later'

  return {
    generatedAt: input.now.toISOString(),
    mode: input.mode,
    ready,
    level,
    reasons,
    blockers,
    requiredBeforeConsidering: required,
    safeAlternatives: FINE_TUNING_DEFAULT_SAFE_ALTERNATIVES,
    caveats: [
      'gate_does_not_perform_fine_tuning',
      'gate_does_not_export_data',
      'gate_does_not_call_a_model',
      'safe_alternatives_should_be_exhausted_first',
    ],
  }
}
