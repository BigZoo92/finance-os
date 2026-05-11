// Macro Prompt 6 — Advisor v2 preview builder tests.
//
// These tests cover the deterministic preview synthesis. They do NOT exercise
// any IO. The route-level test file in `routes/advisor-v2.test.ts` covers
// auth, flag-off behavior, and the sentinel sweep over the response shape.

import { describe, expect, it } from 'bun:test'
import { buildAdvisorV2Preview } from './build-committee-preview'
import {
  ADVISOR_V2_COMMITTEE_ROLES,
  ADVISOR_V2_FORBIDDEN_ROLES,
  ADVISOR_V2_INVARIANTS,
  type AdvisorV2PreviewInputs,
} from './committee-types'

const FIXED_NOW = new Date('2026-05-10T12:00:00.000Z')

const baseInputs = (
  overrides: Partial<{
    dataQualityLevel: 'ready' | 'usable_with_caveats' | 'limited' | 'not_ready'
    overallGrade: string
    recommendations: AdvisorV2PreviewInputs['recommendations']
    postMortems: AdvisorV2PreviewInputs['postMortems']
    decisions: AdvisorV2PreviewInputs['decisions']
  }> = {}
): AdvisorV2PreviewInputs => ({
  dataQuality: {
    advisorReadiness: { level: overrides.dataQualityLevel ?? 'ready' },
    overall: { grade: overrides.overallGrade ?? 'good' },
  },
  recommendations: overrides.recommendations ?? [
    {
      id: 1,
      recommendationKey: 'rec-1',
      title: 'Review allocation balance',
      confidence: 0.82,
      riskLevel: 'medium',
      challengerStatus: 'confirmed',
      createdAt: '2026-05-08T08:00:00.000Z',
    },
  ],
  postMortems: overrides.postMortems ?? [
    { id: 10, status: 'completed', evaluatedAt: '2026-05-09T08:00:00.000Z' },
  ],
  decisions: overrides.decisions ?? [
    { id: 100, decision: 'accepted', recommendationId: 1, outcomeKindFirst: 'positive' },
  ],
})

const SENSITIVE_SENTINELS = [
  'token',
  'secret',
  'apikey',
  'api_key',
  'signature',
  'access_token',
  'refresh_token',
  'client_secret',
  'cookie',
  'authorization',
  'bearer',
  'freenote',
  '<flexqueryresponse',
  '<?xml',
  '"rawpayload"',
  '5678-9012-3456',
]

const EXECUTION_TERMS_DIRECTIVES = [
  'you should buy',
  'you should sell',
  'place an order',
  'we recommend you transfer',
  'execute',
  'leverage',
  'futures',
  'passer un ordre',
  'acheter',
  'vendre',
]

const expectNoSensitiveLeakage = (text: string) => {
  const lower = text.toLowerCase()
  for (const sentinel of SENSITIVE_SENTINELS) {
    expect(lower).not.toContain(sentinel)
  }
}

const expectNoExecutionDirectives = (text: string) => {
  const lower = text.toLowerCase()
  for (const phrase of EXECUTION_TERMS_DIRECTIVES) {
    expect(lower).not.toContain(phrase)
  }
}

describe('buildAdvisorV2Preview', () => {
  it('returns skipped_disabled when v2Enabled=false (no synthesis emitted)', () => {
    const result = buildAdvisorV2Preview({
      mode: 'admin',
      v2Enabled: false,
      now: FIXED_NOW,
      inputs: baseInputs(),
    })
    expect(result.status).toBe('skipped_disabled')
    expect(result.v2Enabled).toBe(false)
    expect(result.synthesis).toBeNull()
    expect(result.roleNotes).toEqual([])
    expect(result.caveats).toContain('advisor_v2_disabled_by_flag')
  })

  it('degrades to skipped_data_not_ready when readiness is not_ready', () => {
    const result = buildAdvisorV2Preview({
      mode: 'admin',
      v2Enabled: true,
      now: FIXED_NOW,
      inputs: baseInputs({ dataQualityLevel: 'not_ready' }),
    })
    expect(result.status).toBe('skipped_data_not_ready')
    expect(result.synthesis).toBeNull()
    expect(result.advisorReadinessLevel).toBe('not_ready')
    expect(result.caveats).toContain('advisor_readiness_not_usable')
  })

  it('emits a preview when readiness is ready, with all 4 role notes (challenger mandatory)', () => {
    const result = buildAdvisorV2Preview({
      mode: 'admin',
      v2Enabled: true,
      now: FIXED_NOW,
      inputs: baseInputs({ dataQualityLevel: 'ready' }),
    })
    expect(result.status).toBe('preview_ready')
    expect(result.synthesis).not.toBeNull()

    const roles = result.roleNotes.map(note => note.role)
    expect(roles).toContain('context_summarizer')
    expect(roles).toContain('opportunity_mapper')
    expect(roles).toContain('risk_reviewer')
    // Challenger is mandatory — even when no contradiction is found, the
    // challenger role must produce a note (with a caveat explaining abstention).
    expect(roles).toContain('challenger')
  })

  it('challenger abstains with caveat when no contradiction is detectable', () => {
    const result = buildAdvisorV2Preview({
      mode: 'admin',
      v2Enabled: true,
      now: FIXED_NOW,
      inputs: baseInputs({
        decisions: [
          { id: 100, decision: 'accepted', recommendationId: 1, outcomeKindFirst: 'positive' },
        ],
      }),
    })
    const challenger = result.roleNotes.find(note => note.role === 'challenger')
    expect(challenger).toBeDefined()
    expect(challenger?.caveats).toContain('challenger_abstained_no_contradiction_detected')
  })

  it('challenger surfaces accepted-with-negative-outcome patterns', () => {
    const result = buildAdvisorV2Preview({
      mode: 'admin',
      v2Enabled: true,
      now: FIXED_NOW,
      inputs: baseInputs({
        decisions: [
          { id: 100, decision: 'accepted', recommendationId: 1, outcomeKindFirst: 'negative' },
          { id: 101, decision: 'accepted', recommendationId: 2, outcomeKindFirst: 'negative' },
          { id: 102, decision: 'rejected', recommendationId: 3, outcomeKindFirst: null },
        ],
      }),
    })
    const challenger = result.roleNotes.find(note => note.role === 'challenger')
    expect(challenger).toBeDefined()
    expect(challenger?.evidence.some(e => e.startsWith('accepted_with_negative_outcome:'))).toBe(
      true
    )
  })

  it('synthesis emits caveats and never references execution vocabulary', () => {
    const result = buildAdvisorV2Preview({
      mode: 'admin',
      v2Enabled: true,
      now: FIXED_NOW,
      inputs: baseInputs(),
    })
    expect(result.synthesis?.caveats.length).toBeGreaterThan(0)
    expect(result.synthesis?.caveats).toContain('advisory_only_no_execution_guidance')

    const text = JSON.stringify(result)
    expectNoExecutionDirectives(text)
    expectNoSensitiveLeakage(text)
  })

  it('forbidden roles never appear in role notes', () => {
    const result = buildAdvisorV2Preview({
      mode: 'admin',
      v2Enabled: true,
      now: FIXED_NOW,
      inputs: baseInputs(),
    })
    const roles = new Set(result.roleNotes.map(note => note.role))
    for (const forbidden of ADVISOR_V2_FORBIDDEN_ROLES) {
      expect(roles.has(forbidden as never)).toBe(false)
    }
    // Sanity: every emitted role is in the closed-vocabulary list.
    for (const role of roles) {
      expect(ADVISOR_V2_COMMITTEE_ROLES).toContain(role)
    }
  })

  it('invariants list is exposed as data (not just code)', () => {
    expect(ADVISOR_V2_INVARIANTS).toContain('advisory_only')
    expect(ADVISOR_V2_INVARIANTS).toContain('no_execution_vocabulary')
    expect(ADVISOR_V2_INVARIANTS).toContain('no_llm_in_macro_prompt_6')
    expect(ADVISOR_V2_INVARIANTS).toContain('challenger_role_mandatory')
  })

  it('reports advisorReadinessLevel="unknown" when dataQuality is null', () => {
    const result = buildAdvisorV2Preview({
      mode: 'admin',
      v2Enabled: true,
      now: FIXED_NOW,
      inputs: { ...baseInputs(), dataQuality: null },
    })
    // unknown is not in the usable set → preview is skipped
    expect(result.status).toBe('skipped_data_not_ready')
    expect(result.advisorReadinessLevel).toBe('unknown')
  })
})
