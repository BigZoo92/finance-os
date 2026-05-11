// Macro Prompt 6 — Fine-tuning readiness gate types.
//
// IMPORTANT: This is NOT fine-tuning. This is a deterministic gate that decides
// whether fine-tuning should even be considered later. The gate:
//  - never calls a fine-tuning API,
//  - never exports private financial data,
//  - never returns raw freeNote, raw provider payloads, or secrets,
//  - returns a closed-vocabulary `level` and a list of blockers /
//    `safeAlternatives` so operators can act on the gate output.

export type FineTuningReadinessLevel =
  | 'not_recommended'
  | 'premature'
  | 'research_only'
  | 'candidate_later'

export type FineTuningSafeAlternative =
  | 'prompt_template_versioning'
  | 'deterministic_eval_expansion'
  | 'retrieval_context_improvement'
  | 'post_mortem_review'
  | 'data_quality_improvement'

export interface AdvisorFineTuningReadinessResponse {
  readonly generatedAt: string
  readonly mode: 'demo' | 'admin'
  readonly ready: boolean
  readonly level: FineTuningReadinessLevel
  readonly reasons: ReadonlyArray<string>
  readonly blockers: ReadonlyArray<string>
  readonly requiredBeforeConsidering: ReadonlyArray<string>
  readonly safeAlternatives: ReadonlyArray<FineTuningSafeAlternative>
  readonly caveats: ReadonlyArray<string>
}

export const FINE_TUNING_DEFAULT_SAFE_ALTERNATIVES: ReadonlyArray<FineTuningSafeAlternative> = [
  'prompt_template_versioning',
  'deterministic_eval_expansion',
  'retrieval_context_improvement',
  'post_mortem_review',
  'data_quality_improvement',
]

/**
 * Conservative thresholds. Tuning these requires an ADR — they encode the
 * "do not fine-tune yet" posture documented in the operating guide.
 */
export const FINE_TUNING_THRESHOLDS = {
  /** Minimum scored eval cases per scored category before fine-tuning becomes a candidate. */
  minScoredEvalCasesPerCategory: 25,
  /** Minimum decisions with at least one outcome recorded. */
  minDecisionsWithOutcomes: 30,
  /** Maximum acceptable post-mortem failure rate (failed / total). */
  maxPostMortemFailureRate: 0.1,
  /** Minimum acceptable data-quality grade. */
  acceptableDataQualityGrades: ['excellent', 'good', 'usable'] as const,
}
