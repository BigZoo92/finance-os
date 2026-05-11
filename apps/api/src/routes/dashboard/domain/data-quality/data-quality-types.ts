// Macro Prompt 5 — Data quality types.
//
// Closed-vocabulary types for the deterministic data quality scoring helper. The
// compute function accepts a pre-mapped snapshot built from existing local rows
// (Powens connection statuses, external-investments provider health, market /
// news cache state, advisor eval + post-mortem rows, plus the already-computed
// provider diagnostics response). It MUST NOT introduce any new IO surface.
//
// Invariants (per Macro Prompt 5):
//   - Deterministic. No LLM, no provider call, no graph call.
//   - Unknown numeric fields stay `null`, never coerced to 0.
//   - Missing or unconfigured dimensions are explicit and never reported as
//     `down`. `down` is reserved for clearly configured + clearly failing local
//     state.
//   - Scores are conservative; a low score means "data reliability is limited",
//     never an investment-performance signal.
//   - Sensitive sentinels (tokens, secrets, account ids, raw payloads) MUST NOT
//     appear in inputs OR outputs.

/** Closed grade vocabulary. `unknown` is reserved for dimensions with no usable input. */
export type DataQualityGrade =
  | 'excellent'
  | 'good'
  | 'usable'
  | 'degraded'
  | 'insufficient'
  | 'unknown'

/** Closed dimension key vocabulary. */
export type DataQualityDimensionKey =
  | 'banking'
  | 'investments'
  | 'crypto'
  | 'market_data'
  | 'news'
  | 'advisor_memory'
  | 'evals'
  | 'post_mortems'

/**
 * Closed-vocabulary status used by each dimension input. The compute function
 * maps these to a score / grade. `down` is reserved for clearly configured +
 * clearly failing local state — `unconfigured`, `disabled_by_flag`, and
 * `missing` are explicit non-failure modes.
 */
export type DataQualityDimensionInputStatus =
  | 'ok'
  | 'degraded'
  | 'down'
  | 'stale'
  | 'unconfigured'
  | 'disabled_by_flag'
  | 'missing'
  | 'unknown'

export interface DataQualityDimensionInput {
  readonly key: DataQualityDimensionKey
  readonly status: DataQualityDimensionInputStatus
  /** ISO-8601 timestamp of last successful local persistence, or null. */
  readonly lastSuccessAt: string | null
  /** ISO-8601 timestamp of last failure, or null. */
  readonly lastFailureAt: string | null
  /** Provider id strings (e.g. ['powens'], ['ibkr']). */
  readonly providers: ReadonlyArray<string>
  /**
   * Stale threshold in minutes. When `lastSuccessAt` is older than this, the
   * dimension is downgraded to `stale` (or worse). `null` disables staleness.
   */
  readonly staleAfterMinutes: number | null
  /** Optional extra reasons appended to the dimension's `reasons[]`. */
  readonly extraReasons?: ReadonlyArray<string>
}

export interface DataQualityDimension {
  readonly key: DataQualityDimensionKey
  readonly score: number | null
  readonly grade: DataQualityGrade
  readonly freshnessMinutes: number | null
  readonly stale: boolean
  readonly degraded: boolean
  readonly missing: boolean
  readonly reasons: ReadonlyArray<string>
  readonly providers: ReadonlyArray<string>
}

export interface DataQualityOverall {
  readonly score: number
  readonly grade: Exclude<DataQualityGrade, 'unknown'>
  readonly stale: boolean
  readonly degraded: boolean
}

export type AdvisorReadinessLevel = 'ready' | 'usable_with_caveats' | 'limited' | 'not_ready'

export interface AdvisorReadiness {
  readonly ready: boolean
  readonly level: AdvisorReadinessLevel
  readonly reasons: ReadonlyArray<string>
  readonly missingInputs: ReadonlyArray<string>
  readonly staleInputs: ReadonlyArray<string>
  readonly caveats: ReadonlyArray<string>
}

export interface DataQualityResponse {
  readonly generatedAt: string
  readonly mode: 'demo' | 'admin'
  readonly overall: DataQualityOverall
  readonly dimensions: ReadonlyArray<DataQualityDimension>
  readonly advisorReadiness: AdvisorReadiness
  readonly blockingIssues: ReadonlyArray<string>
  readonly caveats: ReadonlyArray<string>
}
