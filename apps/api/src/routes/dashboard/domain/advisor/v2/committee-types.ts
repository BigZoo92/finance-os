// Macro Prompt 6 — Advisor v2 committee types.
//
// Closed-vocabulary types for the Advisor v2 committee skeleton.
// This file is types + helpers only. There is no runtime LLM call here.
//
// Invariants:
//  - Advisory only. The committee NEVER emits trading or execution directives.
//  - Forbidden roles (executor, trader, order_manager, portfolio_manager_with_execution,
//    broker_operator) are NOT part of the role union and MUST NOT be added.
//  - The preview MUST take `dataQuality.advisorReadiness` as an input. When the
//    readiness is not `ready` or `usable_with_caveats`, the synthesizer degrades
//    output rather than fabricating recommendations.
//  - The `challenger` role is mandatory: every preview output must contain at
//    least one challenger note OR a recorded reason explaining why the
//    challenger declined to push back (e.g. data not ready).
//  - The `final_synthesizer` output must include caveats and evidence references.
//  - Execution vocabulary is forbidden in any role's output. The preview helper
//    re-uses the existing `findExecutionDirectives` scanner from
//    `packages/ai/src/evals/scorers/shared.ts` (PR4) instead of defining a
//    parallel banlist.

/**
 * Closed-vocabulary committee role identifiers.
 *
 * Advisor v2 is advisory only. Forbidden roles (executor, trader, order_manager,
 * portfolio_manager_with_execution, broker_operator) are intentionally absent
 * from this union. Adding them would require a new ADR and a new safety review.
 */
export type AdvisorV2CommitteeRole =
  | 'context_summarizer'
  | 'opportunity_mapper'
  | 'risk_reviewer'
  | 'challenger'
  | 'final_synthesizer'

/**
 * Roles explicitly forbidden in the Advisor v2 committee. Documented as data so
 * the capabilities endpoint can surface them and tests can assert they never
 * appear in any output.
 */
export const ADVISOR_V2_FORBIDDEN_ROLES = [
  'executor',
  'trader',
  'order_manager',
  'portfolio_manager_with_execution',
  'broker_operator',
] as const

export type AdvisorV2ForbiddenRole = (typeof ADVISOR_V2_FORBIDDEN_ROLES)[number]

/**
 * Closed status vocabulary for the preview endpoint. `skipped_disabled` is the
 * default when the feature flag is off; the route still returns 200 with this
 * status so the client UI can render a clear "not enabled" state.
 */
export type AdvisorV2PreviewStatus = 'skipped_disabled' | 'skipped_data_not_ready' | 'preview_ready'

export interface AdvisorV2RoleNote {
  readonly role: AdvisorV2CommitteeRole
  readonly summary: string
  readonly evidence: ReadonlyArray<string>
  readonly caveats: ReadonlyArray<string>
}

export interface AdvisorV2PreviewSynthesis {
  /** One-line headline produced by the final_synthesizer. */
  readonly headline: string
  /** Plain-language rationale, free of execution wording. */
  readonly rationale: string
  /** Aggregated caveats from all roles plus the synthesizer's own caveats. */
  readonly caveats: ReadonlyArray<string>
  /** Evidence references collected from contributing roles. */
  readonly evidenceRefs: ReadonlyArray<string>
}

export interface AdvisorV2PreviewResponse {
  readonly generatedAt: string
  readonly mode: 'demo' | 'admin'
  readonly status: AdvisorV2PreviewStatus
  /**
   * The flag state at the moment the preview was built. Mirrored into the
   * response so the caller does not have to consult capabilities separately.
   */
  readonly v2Enabled: boolean
  /**
   * Snapshot of the data quality gate that the synthesizer respected. The
   * response intentionally re-uses the closed-vocabulary readiness level from
   * `data-quality-types.ts` rather than inventing a parallel grade.
   */
  readonly advisorReadinessLevel:
    | 'ready'
    | 'usable_with_caveats'
    | 'limited'
    | 'not_ready'
    | 'unknown'
  readonly inputs: {
    readonly recommendationsReviewed: number
    readonly postMortemsReviewed: number
    readonly decisionsReviewed: number
    readonly dataQualityKnown: boolean
  }
  readonly roleNotes: ReadonlyArray<AdvisorV2RoleNote>
  readonly synthesis: AdvisorV2PreviewSynthesis | null
  readonly caveats: ReadonlyArray<string>
}

export interface AdvisorV2CapabilitiesResponse {
  readonly generatedAt: string
  readonly mode: 'demo' | 'admin'
  readonly v2Enabled: boolean
  /** True only when v2Enabled AND mode === 'admin'. Demo never executes the preview. */
  readonly previewAvailable: boolean
  readonly committeeRoles: ReadonlyArray<AdvisorV2CommitteeRole>
  readonly forbiddenRoles: ReadonlyArray<AdvisorV2ForbiddenRole>
  /**
   * Hard-coded constraints that future writers MUST respect when extending the
   * committee. Surfaced in the response to keep them visible to operators.
   */
  readonly invariants: ReadonlyArray<string>
  readonly notes: ReadonlyArray<string>
}

export const ADVISOR_V2_COMMITTEE_ROLES: ReadonlyArray<AdvisorV2CommitteeRole> = [
  'context_summarizer',
  'opportunity_mapper',
  'risk_reviewer',
  'challenger',
  'final_synthesizer',
]

export const ADVISOR_V2_INVARIANTS: ReadonlyArray<string> = [
  'advisory_only',
  'no_execution_vocabulary',
  'no_provider_calls',
  'no_graph_calls',
  'no_llm_in_macro_prompt_6',
  'challenger_role_mandatory',
  'final_output_must_include_caveats',
  'data_quality_must_gate_output',
]
