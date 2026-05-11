import { describe, expect, it } from 'bun:test'
import {
  BEHAVIOR_INSUFFICIENT_SAMPLE,
  BEHAVIOR_WINDOW_DEFAULT,
  BEHAVIOR_WINDOW_MAX,
  BEHAVIOR_WINDOW_MIN,
  buildDemoAdvisorBehaviorAnalytics,
  clampWindowDays,
  computeBehaviorAnalytics,
  createAdvisorBehaviorAnalyticsUseCase,
  type BehaviorAnalyticsDecision,
  type BehaviorAnalyticsOutcome,
  type BehaviorAnalyticsRepositoryAdapter,
} from './get-advisor-behavior-analytics'

const NOW = new Date('2026-05-09T09:00:00.000Z')

const buildDecision = (
  overrides: Partial<BehaviorAnalyticsDecision> & { id: number }
): BehaviorAnalyticsDecision => ({
  decision: 'accepted',
  reasonCode: 'accepted',
  decidedAt: '2026-05-01T08:00:00.000Z',
  recommendationId: null,
  runId: null,
  ...overrides,
})

const buildOutcome = (
  decisionId: number,
  outcomeKind: BehaviorAnalyticsOutcome['outcomeKind'],
  observedAt = '2026-05-08T08:00:00.000Z'
): BehaviorAnalyticsOutcome => ({ decisionId, outcomeKind, observedAt })

describe('clampWindowDays', () => {
  it('returns the default for null/undefined/NaN', () => {
    expect(clampWindowDays(null)).toBe(BEHAVIOR_WINDOW_DEFAULT)
    expect(clampWindowDays(undefined)).toBe(BEHAVIOR_WINDOW_DEFAULT)
    expect(clampWindowDays(Number.NaN)).toBe(BEHAVIOR_WINDOW_DEFAULT)
  })
  it('clamps below the floor and above the ceiling', () => {
    expect(clampWindowDays(0)).toBe(BEHAVIOR_WINDOW_MIN)
    expect(clampWindowDays(2)).toBe(BEHAVIOR_WINDOW_MIN)
    expect(clampWindowDays(2000)).toBe(BEHAVIOR_WINDOW_MAX)
  })
  it('passes through valid values (floored)', () => {
    expect(clampWindowDays(7)).toBe(7)
    expect(clampWindowDays(45.7)).toBe(45)
    expect(clampWindowDays(365)).toBe(365)
  })
})

describe('computeBehaviorAnalytics', () => {
  it('returns empty summary + insufficient_sample signal when no decisions', () => {
    const out = computeBehaviorAnalytics({
      decisions: [],
      outcomes: [],
      windowDays: 30,
      generatedAt: NOW,
      mode: 'admin',
    })
    expect(out.summary.totalDecisions).toBe(0)
    expect(out.summary.outcomeCoverageRate).toBeNull()
    expect(out.summary.acceptedRate).toBeNull()
    expect(out.summary.rejectedRate).toBeNull()
    expect(out.summary.deferredRate).toBeNull()
    expect(out.summary.ignoredRate).toBeNull()
    expect(out.decisionBreakdown).toHaveLength(4)
    expect(out.decisionBreakdown.every(d => d.count === 0)).toBe(true)
    expect(out.reasonCodeBreakdown).toHaveLength(0)
    expect(out.learningSignals.some(s => s.kind === 'insufficient_sample')).toBe(true)
  })

  it('computes rates honestly when decisions exist but no outcomes are recorded', () => {
    const decisions = Array.from({ length: 8 }, (_, i) =>
      buildDecision({
        id: i + 1,
        decision: i % 2 === 0 ? 'accepted' : 'rejected',
        reasonCode: i % 2 === 0 ? 'accepted' : 'rejected_low_confidence',
      })
    )
    const out = computeBehaviorAnalytics({
      decisions,
      outcomes: [],
      windowDays: 30,
      generatedAt: NOW,
      mode: 'admin',
    })
    expect(out.summary.totalDecisions).toBe(8)
    expect(out.summary.decisionsWithOutcomes).toBe(0)
    expect(out.summary.outcomeCoverageRate).toBe(0)
    expect(out.summary.acceptedRate).toBe(0.5)
    expect(out.summary.rejectedRate).toBe(0.5)
    expect(out.summary.deferredRate).toBe(0)
    expect(out.summary.ignoredRate).toBe(0)
    expect(out.learningSignals.some(s => s.kind === 'low_outcome_coverage')).toBe(true)
  })

  it('uses the LATEST outcome per decision when multiple outcomes exist', () => {
    const decisions = [buildDecision({ id: 1, decision: 'accepted', reasonCode: 'accepted' })]
    const outcomes = [
      buildOutcome(1, 'negative', '2026-05-02T00:00:00.000Z'),
      buildOutcome(1, 'positive', '2026-05-08T00:00:00.000Z'), // latest
      buildOutcome(1, 'mixed', '2026-05-04T00:00:00.000Z'),
    ]
    const out = computeBehaviorAnalytics({
      decisions,
      outcomes,
      windowDays: 30,
      generatedAt: NOW,
      mode: 'admin',
    })
    const accepted = out.decisionBreakdown.find(d => d.decision === 'accepted')
    expect(accepted?.outcomeMix.positive).toBe(1)
    expect(accepted?.outcomeMix.negative).toBe(0)
    expect(accepted?.outcomeMix.mixed).toBe(0)
  })

  it('aggregates reason-code breakdown sorted by count then alphabetically', () => {
    const decisions = [
      buildDecision({ id: 1, reasonCode: 'rejected_low_confidence', decision: 'rejected' }),
      buildDecision({ id: 2, reasonCode: 'rejected_low_confidence', decision: 'rejected' }),
      buildDecision({ id: 3, reasonCode: 'accepted', decision: 'accepted' }),
      buildDecision({ id: 4, reasonCode: 'accepted', decision: 'accepted' }),
      buildDecision({ id: 5, reasonCode: 'accepted', decision: 'accepted' }),
      buildDecision({ id: 6, reasonCode: 'deferred_need_more_data', decision: 'deferred' }),
    ]
    const out = computeBehaviorAnalytics({
      decisions,
      outcomes: [],
      windowDays: 30,
      generatedAt: NOW,
      mode: 'admin',
    })
    expect(out.reasonCodeBreakdown.map(r => r.reasonCode)).toEqual([
      'accepted', // 3
      'rejected_low_confidence', // 2
      'deferred_need_more_data', // 1
    ])
    const accepted = out.reasonCodeBreakdown[0]
    expect(accepted?.count).toBe(3)
    expect(accepted?.unknownOutcomes).toBe(3)
    expect(accepted?.positiveOutcomes).toBe(0)
    expect(accepted?.negativeOutcomes).toBe(0)
  })

  it('flags reason codes with predominantly negative outcomes (caution copy is descriptive only)', () => {
    const decisions = Array.from({ length: 6 }, (_, i) =>
      buildDecision({ id: i + 1, decision: 'accepted', reasonCode: 'accepted' })
    )
    const outcomes = [
      buildOutcome(1, 'negative'),
      buildOutcome(2, 'negative'),
      buildOutcome(3, 'negative'),
      buildOutcome(4, 'negative'),
      buildOutcome(5, 'positive'),
      buildOutcome(6, 'positive'),
    ]
    const out = computeBehaviorAnalytics({
      decisions,
      outcomes,
      windowDays: 30,
      generatedAt: NOW,
      mode: 'admin',
    })
    const reason = out.reasonCodeBreakdown.find(r => r.reasonCode === 'accepted')
    expect(reason?.caution).toMatch(/négatifs/)
    // Caution copy must be descriptive, never prescriptive — never says "stop accepting".
    expect(reason?.caution).not.toMatch(/arrêt|cesser|interdire|exécut/)
  })

  it('emits high_negative_acceptance when accepted decisions skew negative on evaluated outcomes', () => {
    // 6 accepted, 4 negative + 1 positive + 1 unknown ⇒ 4/5 = 80% negative
    const decisions = Array.from({ length: 6 }, (_, i) =>
      buildDecision({ id: i + 1, decision: 'accepted', reasonCode: 'accepted' })
    )
    const outcomes = [
      buildOutcome(1, 'negative'),
      buildOutcome(2, 'negative'),
      buildOutcome(3, 'negative'),
      buildOutcome(4, 'negative'),
      buildOutcome(5, 'positive'),
      // decision 6 has no outcome
    ]
    const out = computeBehaviorAnalytics({
      decisions,
      outcomes,
      windowDays: 30,
      generatedAt: NOW,
      mode: 'admin',
    })
    expect(out.learningSignals.some(s => s.kind === 'high_negative_acceptance')).toBe(true)
  })

  it('emits over_deferral when deferred share is ≥ 40%', () => {
    const decisions = [
      ...Array.from({ length: 5 }, (_, i) =>
        buildDecision({ id: i + 1, decision: 'deferred', reasonCode: 'deferred_need_more_data' })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        buildDecision({ id: i + 6, decision: 'accepted', reasonCode: 'accepted' })
      ),
    ]
    const out = computeBehaviorAnalytics({
      decisions,
      outcomes: [],
      windowDays: 30,
      generatedAt: NOW,
      mode: 'admin',
    })
    expect(out.summary.deferredRate).toBe(0.5)
    expect(out.learningSignals.some(s => s.kind === 'over_deferral')).toBe(true)
  })

  it('emits ignored_followups when ≥5 ignored decisions had a positive outcome', () => {
    const decisions = Array.from({ length: 6 }, (_, i) =>
      buildDecision({ id: i + 1, decision: 'ignored', reasonCode: 'ignored_no_action' })
    )
    const outcomes = Array.from({ length: 5 }, (_, i) => buildOutcome(i + 1, 'positive'))
    const out = computeBehaviorAnalytics({
      decisions,
      outcomes,
      windowDays: 30,
      generatedAt: NOW,
      mode: 'admin',
    })
    expect(out.learningSignals.some(s => s.kind === 'ignored_followups')).toBe(true)
  })

  it('emits positive_rejections when rejected decisions skew positive on evaluated outcomes', () => {
    const decisions = Array.from({ length: 6 }, (_, i) =>
      buildDecision({ id: i + 1, decision: 'rejected', reasonCode: 'rejected_low_confidence' })
    )
    const outcomes = [
      buildOutcome(1, 'positive'),
      buildOutcome(2, 'positive'),
      buildOutcome(3, 'positive'),
      buildOutcome(4, 'positive'),
      buildOutcome(5, 'positive'),
      buildOutcome(6, 'negative'),
    ]
    const out = computeBehaviorAnalytics({
      decisions,
      outcomes,
      windowDays: 30,
      generatedAt: NOW,
      mode: 'admin',
    })
    expect(out.learningSignals.some(s => s.kind === 'positive_rejections')).toBe(true)
  })

  it('always emits the permanent caveats including the no-freeNote disclaimer', () => {
    const out = computeBehaviorAnalytics({
      decisions: [],
      outcomes: [],
      windowDays: 30,
      generatedAt: NOW,
      mode: 'admin',
    })
    expect(out.caveats.length).toBeGreaterThanOrEqual(3)
    expect(out.caveats.some(c => /notes? libres?/i.test(c))).toBe(true)
    expect(out.caveats.some(c => /recommandation/i.test(c))).toBe(true)
  })

  it('never emits execution vocabulary anywhere in the response', () => {
    const decisions = Array.from({ length: 10 }, (_, i) =>
      buildDecision({ id: i + 1, decision: 'accepted', reasonCode: 'accepted' })
    )
    const outcomes = decisions.map((_, i) => buildOutcome(i + 1, i % 2 === 0 ? 'positive' : 'negative'))
    const out = computeBehaviorAnalytics({
      decisions,
      outcomes,
      windowDays: 30,
      generatedAt: NOW,
      mode: 'admin',
    })
    const banned = ['buy', 'sell', 'execute', 'execution', 'place order', 'leverage', 'futures']
    const wb = (term: string) =>
      term.includes(' ') ? new RegExp(term, 'i') : new RegExp(`\\b${term}\\b`, 'i')
    const text = JSON.stringify(out)
    for (const term of banned) {
      expect(wb(term).test(text)).toBe(false)
    }
  })

  it('does NOT include any freeNote-shaped key in the response', () => {
    const out = computeBehaviorAnalytics({
      decisions: [buildDecision({ id: 1 })],
      outcomes: [buildOutcome(1, 'positive')],
      windowDays: 30,
      generatedAt: NOW,
      mode: 'admin',
    })
    // The repository adapter contract excludes freeNote at the type level, but we double-check
    // the serialised response carries no such key — a runtime canary on the rule.
    const json = JSON.stringify(out)
    expect(json.toLowerCase()).not.toContain('freenote')
    expect(json.toLowerCase()).not.toContain('free_note')
  })
})

describe('buildDemoAdvisorBehaviorAnalytics', () => {
  it('returns mode=demo with deterministic shape', () => {
    const a = buildDemoAdvisorBehaviorAnalytics(NOW, 30)
    const b = buildDemoAdvisorBehaviorAnalytics(NOW, 30)
    expect(a.mode).toBe('demo')
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.windowDays).toBe(30)
  })
})

describe('createAdvisorBehaviorAnalyticsUseCase', () => {
  const repoCalls: Array<{ windowDays: number; limit: number }> = []
  const buildRepo = (
    decisions: BehaviorAnalyticsDecision[],
    outcomes: BehaviorAnalyticsOutcome[]
  ): BehaviorAnalyticsRepositoryAdapter => ({
    listDecisionsForBehaviorAnalytics: async input => {
      repoCalls.push(input)
      return { decisions, outcomes }
    },
  })

  it('returns demo fixtures WITHOUT touching the repository in demo mode', async () => {
    repoCalls.length = 0
    const useCase = createAdvisorBehaviorAnalyticsUseCase({ repository: buildRepo([], []) })
    const out = await useCase.getAdvisorBehaviorAnalytics({
      mode: 'demo',
      requestId: 'r1',
      windowDays: 30,
      now: NOW,
    })
    expect(out.mode).toBe('demo')
    expect(repoCalls).toHaveLength(0)
  })

  it('clamps windowDays before calling the repository in admin mode', async () => {
    repoCalls.length = 0
    const useCase = createAdvisorBehaviorAnalyticsUseCase({ repository: buildRepo([], []) })
    await useCase.getAdvisorBehaviorAnalytics({
      mode: 'admin',
      requestId: 'r1',
      windowDays: 9999,
    })
    expect(repoCalls[0]?.windowDays).toBe(BEHAVIOR_WINDOW_MAX)
  })

  it('uses the default window when none is provided', async () => {
    repoCalls.length = 0
    const useCase = createAdvisorBehaviorAnalyticsUseCase({ repository: buildRepo([], []) })
    await useCase.getAdvisorBehaviorAnalytics({ mode: 'admin', requestId: 'r1' })
    expect(repoCalls[0]?.windowDays).toBe(BEHAVIOR_WINDOW_DEFAULT)
  })

  it('emits insufficient_sample when admin sample is below the floor', async () => {
    const decisions = Array.from({ length: 2 }, (_, i) =>
      buildDecision({ id: i + 1, decision: 'accepted', reasonCode: 'accepted' })
    )
    const useCase = createAdvisorBehaviorAnalyticsUseCase({
      repository: buildRepo(decisions, []),
    })
    const out = await useCase.getAdvisorBehaviorAnalytics({
      mode: 'admin',
      requestId: 'r1',
      now: NOW,
    })
    expect(decisions.length).toBeLessThan(BEHAVIOR_INSUFFICIENT_SAMPLE)
    expect(out.learningSignals.some(s => s.kind === 'insufficient_sample')).toBe(true)
  })
})
