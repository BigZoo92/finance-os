// Macro Prompt 6 — Advisor replay use-case factory.
//
// Composes the existing read-only advisor / data-quality use-cases into the
// closed-vocabulary replay response. The factory:
//  - performs no IO of its own,
//  - drops `freeNote` before passing data to `buildAdvisorReplay`,
//  - clamps `windowDays` to [1, 90].
//
// Demo mode reuses the same builder with deterministic fixture inputs so that
// the response shape is identical across modes.

import { buildAdvisorReplay } from './build-replay'
import {
  ADVISOR_REPLAY_DEFAULT_WINDOW_DAYS,
  type AdvisorReplayResponse,
  clampReplayWindowDays,
} from './replay-types'

export interface AdvisorReplayDeps {
  readonly now: () => Date
  readonly getDataQuality?: (input: { mode: 'demo' | 'admin'; requestId: string }) => Promise<{
    overall: { grade: string; stale: boolean }
    advisorReadiness: { level: string }
  } | null>
  readonly getRecommendations?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    limit: number
  }) => Promise<{
    items: Array<{
      id: number
      recommendationKey: string
      createdAt: string
    }>
  } | null>
  readonly listDecisionJournal?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    limit: number
  }) => Promise<{
    items: Array<{
      id: number
      recommendationId: number | null
      decision: 'accepted' | 'rejected' | 'deferred' | 'ignored'
      outcomes: Array<{ outcomeKind: string; learningTags: string[] }>
    }>
  } | null>
  readonly listPostMortems?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    limit: number
  }) => Promise<{
    items: Array<{
      id: number
      recommendationId: number | null
      status: 'pending' | 'completed' | 'skipped' | 'failed'
    }>
  } | null>
  readonly getLatestEvalRun?: () => Promise<{
    status: string
    totalCases: number
    passedCases: number
    failedCases: number
  } | null>
  readonly demoFixture?: AdvisorReplayResponse
}

const DEFAULT_FETCH_LIMIT = 50

export interface AdvisorReplayUseCase {
  readonly getAdvisorReplay: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    windowDays?: number | null
  }) => Promise<AdvisorReplayResponse>
}

export const createAdvisorReplayUseCase = (deps: AdvisorReplayDeps): AdvisorReplayUseCase => {
  return {
    getAdvisorReplay: async ({ mode, requestId, windowDays }) => {
      const clampedWindow = clampReplayWindowDays(windowDays ?? ADVISOR_REPLAY_DEFAULT_WINDOW_DAYS)

      if (mode === 'demo' && deps.demoFixture) {
        return { ...deps.demoFixture, windowDays: clampedWindow, mode: 'demo' as const }
      }

      const [dq, recs, decisions, postMortems, evalRun] = await Promise.all([
        deps.getDataQuality?.({ mode, requestId }) ?? Promise.resolve(null),
        deps.getRecommendations?.({ mode, requestId, limit: DEFAULT_FETCH_LIMIT }) ??
          Promise.resolve(null),
        deps.listDecisionJournal?.({ mode, requestId, limit: DEFAULT_FETCH_LIMIT }) ??
          Promise.resolve(null),
        deps.listPostMortems?.({ mode, requestId, limit: DEFAULT_FETCH_LIMIT }) ??
          Promise.resolve(null),
        deps.getLatestEvalRun?.() ?? Promise.resolve(null),
      ])

      return buildAdvisorReplay({
        mode,
        now: deps.now(),
        windowDays: clampedWindow,
        recommendations: (recs?.items ?? []).map(item => ({
          id: item.id,
          recommendationKey: item.recommendationKey,
          createdAt: item.createdAt,
        })),
        decisions: (decisions?.items ?? []).map(item => ({
          id: item.id,
          recommendationId: item.recommendationId,
          decision: item.decision,
          outcomes: item.outcomes.map(outcome => ({
            outcomeKind: outcome.outcomeKind,
            learningTags: outcome.learningTags ?? [],
          })),
        })),
        postMortems: (postMortems?.items ?? []).map(item => ({
          id: item.id,
          recommendationId: item.recommendationId,
          status: item.status,
        })),
        dataQualityKnown: dq !== null,
        dataQualityGrade: dq?.overall.grade ?? null,
        dataQualityStale: dq?.overall.stale ?? false,
        latestEvalRun: evalRun ?? null,
      })
    },
  }
}
