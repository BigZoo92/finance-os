// Macro Prompt 6 — Advisor v2 deterministic preview builder.
//
// Builds a preview output from the Advisor v2 committee skeleton without any
// LLM, provider, or graph call. The function is pure: it consumes already-built
// snapshots from existing use-cases (data quality, recent recommendations,
// recent post-mortems, recent decisions) and produces a closed-vocabulary
// preview shape.
//
// Invariants:
//  - No IO. The caller is responsible for fetching inputs via the existing
//    use-cases (`getDataQuality`, `getAdvisorRecommendations`,
//    `listAdvisorPostMortems`, `listAdvisorDecisionJournal`).
//  - No execution vocabulary. The output is run through `findExecutionDirectives`
//    (PR4) and any role note that would emit a directive is replaced with a
//    sentinel string. Tests assert this never fires under normal inputs.
//  - When the data-quality readiness is `not_ready` (or unavailable), the
//    synthesizer returns null and the status becomes `skipped_data_not_ready`.
//  - The challenger role is mandatory: when no contradiction is detectable
//    deterministically, the challenger note records the reason it abstained
//    rather than being omitted.
//  - The final synthesizer headline never mentions buy/sell/order/execute and
//    never claims causality or future performance.

import { findExecutionDirectives } from '@finance-os/ai'
import type {
  AdvisorV2PreviewResponse,
  AdvisorV2PreviewStatus,
  AdvisorV2RoleNote,
} from './committee-types'

// Narrow shape: the preview only needs the readiness level and overall grade.
// Accepting the narrow shape keeps the builder pure and lets the route pass
// either a real `DataQualityResponse` or a minimal projection without casts.
export interface AdvisorV2DataQualityInput {
  readonly advisorReadiness: { readonly level: AdvisorV2PreviewResponse['advisorReadinessLevel'] }
  readonly overall: { readonly grade: string }
}

export interface AdvisorV2PreviewInputs {
  /** Narrow data quality projection (the route fetches this). */
  readonly dataQuality: AdvisorV2DataQualityInput | null
  readonly recommendations: ReadonlyArray<{
    readonly id: number
    readonly recommendationKey: string
    readonly title: string
    readonly confidence: number
    readonly riskLevel: 'low' | 'medium' | 'high'
    readonly challengerStatus: 'confirmed' | 'softened' | 'flagged' | 'skipped'
    readonly createdAt: string
  }>
  readonly postMortems: ReadonlyArray<{
    readonly id: number
    readonly status: 'pending' | 'completed' | 'skipped' | 'failed'
    readonly evaluatedAt: string | null
  }>
  readonly decisions: ReadonlyArray<{
    readonly id: number
    readonly decision: 'accepted' | 'rejected' | 'deferred' | 'ignored'
    readonly recommendationId: number | null
    readonly outcomeKindFirst: string | null
  }>
}

export interface BuildAdvisorV2PreviewOptions {
  readonly mode: 'demo' | 'admin'
  readonly v2Enabled: boolean
  readonly now: Date
  readonly inputs: AdvisorV2PreviewInputs
}

const SAFE_REPLACEMENT = 'redacted_execution_vocabulary'

const sanitize = (value: string): string => {
  if (!value) return value
  if (findExecutionDirectives([value]).length > 0) {
    return SAFE_REPLACEMENT
  }
  return value
}

const sanitizeAll = (values: ReadonlyArray<string>): string[] =>
  values.map(value => sanitize(value))

const readinessLevel = (
  dataQuality: AdvisorV2DataQualityInput | null
): AdvisorV2PreviewResponse['advisorReadinessLevel'] => {
  if (!dataQuality) return 'unknown'
  return dataQuality.advisorReadiness.level
}

const isReadinessUsable = (level: AdvisorV2PreviewResponse['advisorReadinessLevel']): boolean =>
  level === 'ready' || level === 'usable_with_caveats'

const buildContextSummary = (inputs: AdvisorV2PreviewInputs): AdvisorV2RoleNote => {
  const evidence: string[] = []
  if (inputs.dataQuality) {
    evidence.push(`overall_grade:${inputs.dataQuality.overall.grade}`)
    evidence.push(`readiness:${inputs.dataQuality.advisorReadiness.level}`)
  }
  evidence.push(`recommendations_in_window:${inputs.recommendations.length}`)
  evidence.push(`post_mortems_in_window:${inputs.postMortems.length}`)
  evidence.push(`decisions_in_window:${inputs.decisions.length}`)

  const caveats: string[] = []
  if (!inputs.dataQuality) caveats.push('data_quality_snapshot_unavailable')
  if (inputs.recommendations.length === 0) caveats.push('no_recent_recommendations')

  return {
    role: 'context_summarizer',
    summary: 'Recent advisor activity surfaced for review.',
    evidence,
    caveats,
  }
}

const buildOpportunityMap = (inputs: AdvisorV2PreviewInputs): AdvisorV2RoleNote => {
  const highConfidence = inputs.recommendations.filter(item => item.confidence >= 0.7)
  const evidence = highConfidence
    .slice(0, 5)
    .map(item => `recommendation:${item.recommendationKey}`)
  const caveats: string[] = []
  if (highConfidence.length === 0) {
    caveats.push('no_high_confidence_items_in_window')
  }
  return {
    role: 'opportunity_mapper',
    summary:
      highConfidence.length === 0
        ? 'No high-confidence advisor items observed in the review window.'
        : `Surfaced ${highConfidence.length} high-confidence advisor items for committee review.`,
    evidence,
    caveats,
  }
}

const buildRiskReview = (inputs: AdvisorV2PreviewInputs): AdvisorV2RoleNote => {
  const highRisk = inputs.recommendations.filter(item => item.riskLevel === 'high')
  const flagged = inputs.recommendations.filter(item => item.challengerStatus === 'flagged')
  const evidence: string[] = []
  if (highRisk.length > 0) evidence.push(`high_risk_count:${highRisk.length}`)
  if (flagged.length > 0) evidence.push(`flagged_count:${flagged.length}`)
  evidence.push(
    `failed_post_mortems:${inputs.postMortems.filter(p => p.status === 'failed').length}`
  )

  const caveats: string[] = []
  if (highRisk.length + flagged.length === 0) {
    caveats.push('no_explicit_risk_flags_in_window')
  }

  return {
    role: 'risk_reviewer',
    summary: 'Risk surface reviewed against existing challenger and post-mortem signals.',
    evidence,
    caveats,
  }
}

const buildChallenge = (inputs: AdvisorV2PreviewInputs): AdvisorV2RoleNote => {
  const negativeOutcomesAccepted = inputs.decisions.filter(
    item => item.decision === 'accepted' && item.outcomeKindFirst === 'negative'
  )
  const missingOutcomes = inputs.decisions.filter(item => item.outcomeKindFirst === null)

  const evidence: string[] = []
  const caveats: string[] = []

  if (negativeOutcomesAccepted.length === 0 && missingOutcomes.length === 0) {
    caveats.push('challenger_abstained_no_contradiction_detected')
  }
  if (negativeOutcomesAccepted.length > 0) {
    evidence.push(`accepted_with_negative_outcome:${negativeOutcomesAccepted.length}`)
  }
  if (missingOutcomes.length > 0) {
    evidence.push(`decisions_without_outcomes:${missingOutcomes.length}`)
  }

  return {
    role: 'challenger',
    summary:
      negativeOutcomesAccepted.length === 0 && missingOutcomes.length === 0
        ? 'Challenger found no deterministic contradiction in the review window.'
        : 'Challenger identified review-worthy patterns that warrant attention.',
    evidence,
    caveats,
  }
}

const buildSynthesis = (
  notes: ReadonlyArray<AdvisorV2RoleNote>,
  readiness: AdvisorV2PreviewResponse['advisorReadinessLevel']
): AdvisorV2PreviewResponse['synthesis'] => {
  const evidenceRefs: string[] = []
  const caveats: string[] = []
  for (const note of notes) {
    evidenceRefs.push(...note.evidence)
    caveats.push(...note.caveats)
  }
  caveats.push(`advisor_readiness:${readiness}`)
  caveats.push('advisory_only_no_execution_guidance')
  caveats.push('committee_preview_does_not_replace_daily_run')

  return {
    headline: 'Advisor v2 committee preview — review only, no recommendation persisted.',
    rationale:
      'The committee skeleton aggregated existing advisor signals deterministically. ' +
      'No LLM call, provider call, or graph call was performed. The output is advisory ' +
      'only and must not be used for trading or transfers.',
    caveats,
    evidenceRefs,
  }
}

export const buildAdvisorV2Preview = ({
  mode,
  v2Enabled,
  now,
  inputs,
}: BuildAdvisorV2PreviewOptions): AdvisorV2PreviewResponse => {
  const generatedAt = now.toISOString()
  const readiness = readinessLevel(inputs.dataQuality)

  if (!v2Enabled) {
    const status: AdvisorV2PreviewStatus = 'skipped_disabled'
    return {
      generatedAt,
      mode,
      status,
      v2Enabled: false,
      advisorReadinessLevel: readiness,
      inputs: {
        recommendationsReviewed: 0,
        postMortemsReviewed: 0,
        decisionsReviewed: 0,
        dataQualityKnown: inputs.dataQuality !== null,
      },
      roleNotes: [],
      synthesis: null,
      caveats: ['advisor_v2_disabled_by_flag'],
    }
  }

  if (!isReadinessUsable(readiness)) {
    return {
      generatedAt,
      mode,
      status: 'skipped_data_not_ready',
      v2Enabled: true,
      advisorReadinessLevel: readiness,
      inputs: {
        recommendationsReviewed: inputs.recommendations.length,
        postMortemsReviewed: inputs.postMortems.length,
        decisionsReviewed: inputs.decisions.length,
        dataQualityKnown: inputs.dataQuality !== null,
      },
      roleNotes: [],
      synthesis: null,
      caveats: ['advisor_readiness_not_usable', `advisor_readiness:${readiness}`],
    }
  }

  const rawNotes: AdvisorV2RoleNote[] = [
    buildContextSummary(inputs),
    buildOpportunityMap(inputs),
    buildRiskReview(inputs),
    buildChallenge(inputs),
  ]

  const notes: AdvisorV2RoleNote[] = rawNotes.map(note => ({
    role: note.role,
    summary: sanitize(note.summary),
    evidence: sanitizeAll(note.evidence),
    caveats: sanitizeAll(note.caveats),
  }))

  const rawSynthesis = buildSynthesis(notes, readiness)
  const synthesis: AdvisorV2PreviewResponse['synthesis'] = rawSynthesis
    ? {
        headline: sanitize(rawSynthesis.headline),
        rationale: sanitize(rawSynthesis.rationale),
        caveats: sanitizeAll(rawSynthesis.caveats),
        evidenceRefs: sanitizeAll(rawSynthesis.evidenceRefs),
      }
    : null

  return {
    generatedAt,
    mode,
    status: 'preview_ready',
    v2Enabled: true,
    advisorReadinessLevel: readiness,
    inputs: {
      recommendationsReviewed: inputs.recommendations.length,
      postMortemsReviewed: inputs.postMortems.length,
      decisionsReviewed: inputs.decisions.length,
      dataQualityKnown: inputs.dataQuality !== null,
    },
    roleNotes: notes,
    synthesis,
    caveats: [
      'advisor_v2_preview_is_advisory_only',
      'advisor_v2_preview_does_not_persist_recommendations',
      'advisor_v2_preview_uses_deterministic_synthesis_no_llm',
    ],
  }
}
