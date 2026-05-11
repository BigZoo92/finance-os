// Macro Prompt 6 — Fine-tuning readiness gate use-case factory.
//
// Wires the deterministic gate to existing read-only inputs. The factory does
// no IO of its own beyond invoking the use-cases that the route runtime is
// already responsible for fetching.
//
// Defaults:
//  - `privacyPlanAccepted` defaults to `false` (so the gate fails closed).
//  - `improvementTargetDocumented` defaults to `false`.
//  - `rollbackPlanDocumented` defaults to `false`.
// These three blockers will only flip to true once an operator/ADR confirms
// each plan; this macro prompt does not define that workflow.

import { computeFineTuningReadiness } from './compute-fine-tuning-readiness'
import type { AdvisorFineTuningReadinessResponse } from './fine-tuning-types'

export interface FineTuningReadinessDeps {
  readonly now: () => Date
  readonly getDataQuality?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
  }) => Promise<{ overall: { grade: string } } | null>
  readonly getLatestEvalRun?: () => Promise<{
    totalCases: number
    passedCases: number
    failedCases: number
  } | null>
  readonly listDecisionJournal?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    limit: number
  }) => Promise<{
    items: Array<{ outcomes: Array<{ outcomeKind: string }> }>
  } | null>
  readonly listPostMortems?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    limit: number
  }) => Promise<{
    items: Array<{ status: 'pending' | 'completed' | 'skipped' | 'failed' }>
  } | null>
  /** Operator-confirmed flags. Default false. */
  readonly privacyPlanAccepted?: boolean
  readonly improvementTargetDocumented?: boolean
  readonly rollbackPlanDocumented?: boolean
}

const FETCH_LIMIT = 100

export interface FineTuningReadinessUseCase {
  readonly getAdvisorFineTuningReadiness: (input: {
    mode: 'demo' | 'admin'
    requestId: string
  }) => Promise<AdvisorFineTuningReadinessResponse>
}

export const createFineTuningReadinessUseCase = (
  deps: FineTuningReadinessDeps
): FineTuningReadinessUseCase => ({
  getAdvisorFineTuningReadiness: async ({ mode, requestId }) => {
    const [dq, evalRun, decisions, postMortems] = await Promise.all([
      deps.getDataQuality?.({ mode, requestId }) ?? Promise.resolve(null),
      deps.getLatestEvalRun?.() ?? Promise.resolve(null),
      deps.listDecisionJournal?.({ mode, requestId, limit: FETCH_LIMIT }) ?? Promise.resolve(null),
      deps.listPostMortems?.({ mode, requestId, limit: FETCH_LIMIT }) ?? Promise.resolve(null),
    ])

    const decisionItems = decisions?.items ?? []
    const decisionsWithOutcomes = decisionItems.filter(item => item.outcomes.length > 0).length

    const pmItems = postMortems?.items ?? []
    const failedPostMortems = pmItems.filter(item => item.status === 'failed').length

    return computeFineTuningReadiness({
      mode,
      now: deps.now(),
      latestEvalRun: evalRun,
      decisionsWithOutcomes,
      totalDecisions: decisionItems.length,
      postMortems: {
        total: pmItems.length,
        failed: failedPostMortems,
        // Macro Prompt 6 defaults this to 0; future macros may extend the
        // post-mortem use-case to surface execution-vocabulary hits explicitly.
        executionVocabularyHits: 0,
      },
      dataQualityGrade: dq?.overall.grade ?? null,
      privacyPlanAccepted: deps.privacyPlanAccepted ?? false,
      improvementTargetDocumented: deps.improvementTargetDocumented ?? false,
      rollbackPlanDocumented: deps.rollbackPlanDocumented ?? false,
    })
  },
})
