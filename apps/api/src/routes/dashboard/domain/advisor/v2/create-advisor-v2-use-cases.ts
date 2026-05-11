// Macro Prompt 6 — Advisor v2 use-case factory.
//
// Wires the deterministic preview builder to the existing advisor / data
// quality / decision journal / post-mortem read use-cases. The factory does NOT
// perform any IO of its own — it only orchestrates calls into use-cases that
// the route runtime is already responsible for fetching.
//
// Invariants:
//  - No LLM call in this file. The preview is deterministic synthesis only.
//  - No provider call. No graph call. No DB write.
//  - When `v2Enabled` is false, the preview short-circuits with
//    `skipped_disabled` BEFORE any input fetch happens, to keep the disabled
//    path cheap.
//  - The factory always returns the closed-vocabulary preview shape; route
//    auth / 403 mapping is the route's job.

import { buildAdvisorV2Preview } from './build-committee-preview'
import {
  ADVISOR_V2_COMMITTEE_ROLES,
  ADVISOR_V2_FORBIDDEN_ROLES,
  ADVISOR_V2_INVARIANTS,
  type AdvisorV2CapabilitiesResponse,
  type AdvisorV2PreviewResponse,
} from './committee-types'

export interface AdvisorV2UseCaseDeps {
  readonly v2Enabled: boolean
  readonly now: () => Date
  readonly getDataQuality?: (input: { mode: 'demo' | 'admin'; requestId: string }) => Promise<{
    advisorReadiness: { level: 'ready' | 'usable_with_caveats' | 'limited' | 'not_ready' }
    overall: { grade: string }
  } | null>
  readonly getRecommendations?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    limit: number
  }) => Promise<{
    items: Array<{
      id: number
      recommendationKey: string
      title: string
      confidence: number
      riskLevel: 'low' | 'medium' | 'high'
      challengerStatus: 'confirmed' | 'softened' | 'flagged' | 'skipped'
      createdAt: string
    }>
  } | null>
  readonly listPostMortems?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    limit: number
  }) => Promise<{
    items: Array<{
      id: number
      status: 'pending' | 'completed' | 'skipped' | 'failed'
      evaluatedAt: string | null
    }>
  } | null>
  readonly listDecisionJournal?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    limit: number
  }) => Promise<{
    items: Array<{
      id: number
      decision: 'accepted' | 'rejected' | 'deferred' | 'ignored'
      recommendationId: number | null
      outcomes: Array<{ outcomeKind: string }>
    }>
  } | null>
}

export interface AdvisorV2UseCases {
  readonly getCapabilities: (input: {
    mode: 'demo' | 'admin'
    requestId: string
  }) => Promise<AdvisorV2CapabilitiesResponse>
  readonly buildPreview: (input: {
    mode: 'demo' | 'admin'
    requestId: string
  }) => Promise<AdvisorV2PreviewResponse>
}

const DEMO_PREVIEW_LIMIT = 5

export const createAdvisorV2UseCases = (deps: AdvisorV2UseCaseDeps): AdvisorV2UseCases => {
  const getCapabilities: AdvisorV2UseCases['getCapabilities'] = async ({ mode }) => ({
    generatedAt: deps.now().toISOString(),
    mode,
    v2Enabled: deps.v2Enabled,
    previewAvailable: deps.v2Enabled && mode === 'admin',
    committeeRoles: ADVISOR_V2_COMMITTEE_ROLES,
    forbiddenRoles: ADVISOR_V2_FORBIDDEN_ROLES,
    invariants: ADVISOR_V2_INVARIANTS,
    notes: [
      'advisor_v2_preview_is_advisory_only',
      'advisor_v2_preview_does_not_replace_runAdvisorDaily',
      'advisor_v2_preview_does_not_persist_recommendations',
    ],
  })

  const buildPreview: AdvisorV2UseCases['buildPreview'] = async ({ mode, requestId }) => {
    if (!deps.v2Enabled) {
      return buildAdvisorV2Preview({
        mode,
        v2Enabled: false,
        now: deps.now(),
        inputs: {
          dataQuality: null,
          recommendations: [],
          postMortems: [],
          decisions: [],
        },
      })
    }

    const dataQualityRaw = deps.getDataQuality
      ? await deps.getDataQuality({ mode, requestId })
      : null
    const recommendationsRaw = deps.getRecommendations
      ? await deps.getRecommendations({ mode, requestId, limit: DEMO_PREVIEW_LIMIT })
      : null
    const postMortemsRaw = deps.listPostMortems
      ? await deps.listPostMortems({ mode, requestId, limit: DEMO_PREVIEW_LIMIT })
      : null
    const decisionsRaw = deps.listDecisionJournal
      ? await deps.listDecisionJournal({ mode, requestId, limit: DEMO_PREVIEW_LIMIT })
      : null

    return buildAdvisorV2Preview({
      mode,
      v2Enabled: true,
      now: deps.now(),
      inputs: {
        dataQuality: dataQualityRaw
          ? {
              advisorReadiness: { level: dataQualityRaw.advisorReadiness.level },
              overall: { grade: dataQualityRaw.overall.grade },
            }
          : null,
        recommendations: recommendationsRaw?.items ?? [],
        postMortems: (postMortemsRaw?.items ?? []).map(item => ({
          id: item.id,
          status: item.status,
          evaluatedAt: item.evaluatedAt,
        })),
        decisions: (decisionsRaw?.items ?? []).map(item => ({
          id: item.id,
          decision: item.decision,
          recommendationId: item.recommendationId,
          outcomeKindFirst: item.outcomes[0]?.outcomeKind ?? null,
        })),
      },
    })
  }

  return { getCapabilities, buildPreview }
}
