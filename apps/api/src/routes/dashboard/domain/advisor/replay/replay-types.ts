// Macro Prompt 6 — Advisor replay types.
//
// Read-only review layer over existing advisor data. Closed-vocabulary types
// only; the response intentionally avoids leaking raw freeNote, raw provider
// payloads, or anything that could carry a sentinel.
//
// Rules encoded in the type system:
//  - `decision` is the existing closed enum from advisor-contract OR null.
//  - `outcomeKind` is null when the decision has no recorded outcome — never 0.
//  - `dataQualityAtReview` is `current_only` because the replay does NOT
//    persist historical data quality snapshots in this macro. Future macros
//    may upgrade this to `historical` if persistence is added.
//  - `learningTags` flow through from outcomes verbatim; the use-case tests
//    assert no token-shaped string ever leaves through this field.

export type AdvisorReplayMode = 'demo' | 'admin'

export type AdvisorReplayDecisionKind = 'accepted' | 'rejected' | 'deferred' | 'ignored'

export type AdvisorReplayDataQualityAtReview = 'current_only' | 'historical' | 'unavailable'

export type AdvisorReplayPatternKind =
  | 'missing_outcome'
  | 'repeated_negative_acceptance'
  | 'stale_data_context'
  | 'low_eval_confidence'
  | 'unresolved_recommendation'

export type AdvisorReplayPatternSeverity = 'info' | 'warning' | 'danger'

export interface AdvisorReplaySummary {
  readonly recommendationsReviewed: number
  readonly decisionsLinked: number
  readonly outcomesLinked: number
  readonly postMortemsLinked: number
  readonly unresolved: number
  readonly repeatedFailureModes: number
}

export interface AdvisorReplayItem {
  readonly recommendationId: number
  readonly recommendationKey: string | null
  readonly createdAt: string
  readonly decision: AdvisorReplayDecisionKind | null
  readonly outcomeKind: string | null
  readonly postMortemStatus: string | null
  readonly dataQualityAtReview: AdvisorReplayDataQualityAtReview
  readonly caveats: ReadonlyArray<string>
  readonly learningTags: ReadonlyArray<string>
}

export interface AdvisorReplayPattern {
  readonly kind: AdvisorReplayPatternKind
  readonly severity: AdvisorReplayPatternSeverity
  readonly count: number
  readonly message: string
}

export interface AdvisorReplayResponse {
  readonly generatedAt: string
  readonly mode: AdvisorReplayMode
  readonly windowDays: number
  readonly summary: AdvisorReplaySummary
  readonly items: ReadonlyArray<AdvisorReplayItem>
  readonly patterns: ReadonlyArray<AdvisorReplayPattern>
  readonly caveats: ReadonlyArray<string>
}

export const ADVISOR_REPLAY_DEFAULT_WINDOW_DAYS = 30
export const ADVISOR_REPLAY_MIN_WINDOW_DAYS = 1
export const ADVISOR_REPLAY_MAX_WINDOW_DAYS = 90

/** Clamps the requested window to the supported [1, 90] range. */
export const clampReplayWindowDays = (input: number | null | undefined): number => {
  if (input === null || input === undefined || Number.isNaN(input)) {
    return ADVISOR_REPLAY_DEFAULT_WINDOW_DAYS
  }
  if (input < ADVISOR_REPLAY_MIN_WINDOW_DAYS) return ADVISOR_REPLAY_MIN_WINDOW_DAYS
  if (input > ADVISOR_REPLAY_MAX_WINDOW_DAYS) return ADVISOR_REPLAY_MAX_WINDOW_DAYS
  return Math.trunc(input)
}
