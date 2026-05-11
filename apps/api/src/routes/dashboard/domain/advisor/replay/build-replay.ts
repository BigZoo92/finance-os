// Macro Prompt 6 — Advisor replay builder.
//
// Pure deterministic composition over already-fetched advisor inputs. The
// caller (use-case factory) is responsible for invoking the existing
// `getAdvisorRecommendations`, `listAdvisorDecisionJournal`,
// `listAdvisorPostMortems`, and `getDataQuality` use-cases. This builder does
// no IO and never reads raw freeNote.
//
// Invariants:
//  - `freeNote` from any decision/outcome row is NOT propagated to the
//    response. Only the closed-vocabulary `decision`, `outcomeKind`,
//    `learningTags`, and `recommendationKey` flow through.
//  - `dataQualityAtReview` is always `current_only` for now. Historical data
//    quality snapshots are not persisted in Macro Prompt 6; future work may
//    upgrade this without changing the response shape.
//  - No causality language. Patterns describe observed counts, not predictions.

import type { AdvisorReplayItem, AdvisorReplayPattern, AdvisorReplayResponse } from './replay-types'

interface ReplayRecommendationInput {
  readonly id: number
  readonly recommendationKey: string | null
  readonly createdAt: string
}

interface ReplayDecisionOutcomeInput {
  readonly outcomeKind: string
  readonly learningTags: ReadonlyArray<string>
}

interface ReplayDecisionInput {
  readonly id: number
  readonly recommendationId: number | null
  readonly decision: 'accepted' | 'rejected' | 'deferred' | 'ignored'
  readonly outcomes: ReadonlyArray<ReplayDecisionOutcomeInput>
}

interface ReplayPostMortemInput {
  readonly id: number
  readonly recommendationId: number | null
  readonly status: 'pending' | 'completed' | 'skipped' | 'failed'
}

export interface BuildAdvisorReplayInputs {
  readonly mode: 'demo' | 'admin'
  readonly now: Date
  readonly windowDays: number
  readonly recommendations: ReadonlyArray<ReplayRecommendationInput>
  readonly decisions: ReadonlyArray<ReplayDecisionInput>
  readonly postMortems: ReadonlyArray<ReplayPostMortemInput>
  readonly dataQualityKnown: boolean
  readonly dataQualityGrade: string | null
  readonly dataQualityStale: boolean
  readonly latestEvalRun: {
    readonly status: string
    readonly totalCases: number
    readonly passedCases: number
    readonly failedCases: number
  } | null
}

const sanitizeLearningTags = (tags: ReadonlyArray<string>): ReadonlyArray<string> =>
  tags.filter(tag => typeof tag === 'string' && tag.length > 0).map(tag => tag.trim())

export const buildAdvisorReplay = (input: BuildAdvisorReplayInputs): AdvisorReplayResponse => {
  // Index decisions by recommendationId for O(1) lookup. A recommendation may
  // have multiple decisions; replay surfaces the most recent (highest id).
  const decisionsByRec = new Map<number, ReplayDecisionInput>()
  for (const decision of input.decisions) {
    if (decision.recommendationId === null) continue
    const existing = decisionsByRec.get(decision.recommendationId)
    if (!existing || decision.id > existing.id) {
      decisionsByRec.set(decision.recommendationId, decision)
    }
  }

  const postMortemsByRec = new Map<number, ReplayPostMortemInput>()
  for (const pm of input.postMortems) {
    if (pm.recommendationId === null) continue
    const existing = postMortemsByRec.get(pm.recommendationId)
    if (!existing || pm.id > existing.id) {
      postMortemsByRec.set(pm.recommendationId, pm)
    }
  }

  const items: AdvisorReplayItem[] = input.recommendations.map(rec => {
    const decision = decisionsByRec.get(rec.id) ?? null
    const firstOutcome = decision?.outcomes[0] ?? null
    const postMortem = postMortemsByRec.get(rec.id) ?? null

    const itemCaveats: string[] = []
    if (!decision) itemCaveats.push('no_decision_recorded')
    if (decision && !firstOutcome) itemCaveats.push('decision_without_outcome')
    if (!postMortem) itemCaveats.push('no_post_mortem_linked')
    itemCaveats.push('data_quality_at_review_is_current_only')

    return {
      recommendationId: rec.id,
      recommendationKey: rec.recommendationKey,
      createdAt: rec.createdAt,
      decision: decision?.decision ?? null,
      outcomeKind: firstOutcome?.outcomeKind ?? null,
      postMortemStatus: postMortem?.status ?? null,
      dataQualityAtReview: input.dataQualityKnown ? 'current_only' : 'unavailable',
      caveats: itemCaveats,
      learningTags: sanitizeLearningTags(firstOutcome?.learningTags ?? []),
    }
  })

  const decisionsLinked = items.filter(item => item.decision !== null).length
  const outcomesLinked = items.filter(item => item.outcomeKind !== null).length
  const postMortemsLinked = items.filter(item => item.postMortemStatus !== null).length
  const unresolved = items.filter(
    item => item.decision === null || item.outcomeKind === null
  ).length

  const patterns: AdvisorReplayPattern[] = []

  const missingOutcomeCount = items.filter(
    item => item.decision !== null && item.outcomeKind === null
  ).length
  if (missingOutcomeCount > 0) {
    patterns.push({
      kind: 'missing_outcome',
      severity: missingOutcomeCount >= 3 ? 'warning' : 'info',
      count: missingOutcomeCount,
      message: `${missingOutcomeCount} decision(s) have no recorded outcome.`,
    })
  }

  const repeatedNegativeAcceptance = items.filter(
    item => item.decision === 'accepted' && item.outcomeKind === 'negative'
  ).length
  if (repeatedNegativeAcceptance >= 2) {
    patterns.push({
      kind: 'repeated_negative_acceptance',
      severity: repeatedNegativeAcceptance >= 4 ? 'danger' : 'warning',
      count: repeatedNegativeAcceptance,
      message: `${repeatedNegativeAcceptance} accepted recommendation(s) had negative outcomes recorded.`,
    })
  }

  if (input.dataQualityKnown && input.dataQualityStale) {
    patterns.push({
      kind: 'stale_data_context',
      severity: 'warning',
      count: 1,
      message: 'Data quality snapshot is stale at review time.',
    })
  }

  if (input.latestEvalRun) {
    const { totalCases, passedCases } = input.latestEvalRun
    if (totalCases > 0 && passedCases / totalCases < 0.6) {
      patterns.push({
        kind: 'low_eval_confidence',
        severity: 'warning',
        count: totalCases - passedCases,
        message: 'Latest eval run shows below-threshold pass rate.',
      })
    }
  }

  const unresolvedRecCount = items.filter(item => item.decision === null).length
  if (unresolvedRecCount > 0) {
    patterns.push({
      kind: 'unresolved_recommendation',
      severity: unresolvedRecCount >= 3 ? 'warning' : 'info',
      count: unresolvedRecCount,
      message: `${unresolvedRecCount} recommendation(s) have no decision recorded.`,
    })
  }

  const repeatedFailureModes = patterns.filter(
    p => p.kind === 'repeated_negative_acceptance' || p.kind === 'low_eval_confidence'
  ).length

  const responseCaveats: string[] = [
    'replay_is_advisory_only',
    'no_causality_claim',
    'no_prediction_or_performance_claim',
    'data_quality_at_review_is_current_only',
  ]
  if (!input.dataQualityKnown) {
    responseCaveats.push('data_quality_unavailable')
  }

  return {
    generatedAt: input.now.toISOString(),
    mode: input.mode,
    windowDays: input.windowDays,
    summary: {
      recommendationsReviewed: items.length,
      decisionsLinked,
      outcomesLinked,
      postMortemsLinked,
      unresolved,
      repeatedFailureModes,
    },
    items,
    patterns,
    caveats: responseCaveats,
  }
}
