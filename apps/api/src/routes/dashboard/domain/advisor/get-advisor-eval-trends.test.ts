import { describe, expect, it } from 'bun:test'
import type { DashboardAdvisorEvalRunResponse } from '../../advisor-contract'
import {
  buildDeterministicAdvisorEvalTrendsDemo,
  clampWindowDays,
  computeAdvisorEvalTrends,
  createAdvisorEvalTrendsUseCase,
  EVAL_TREND_WINDOW_DEFAULT,
  EVAL_TREND_WINDOW_MAX,
  EVAL_TREND_WINDOW_MIN,
  groupForCategory,
  type EvalTrendsRepositoryAdapter,
} from './get-advisor-eval-trends'

const baseRun = (
  overrides: Partial<DashboardAdvisorEvalRunResponse>
): DashboardAdvisorEvalRunResponse => ({
  id: 1,
  runId: null,
  status: 'completed',
  totalCases: 0,
  passedCases: 0,
  failedCases: 0,
  summary: {},
  createdAt: '2026-05-01T09:00:00.000Z',
  ...overrides,
})

const withCategorySummary = (
  byCategory: Record<
    string,
    { total: number; passed: number; failed: number; skipped?: number; failedCaseKeys?: string[] }
  >
): Record<string, unknown> => ({
  byCategory: Object.fromEntries(
    Object.entries(byCategory).map(([cat, c]) => [
      cat,
      {
        total: c.total,
        passed: c.passed,
        failed: c.failed,
        skipped: c.skipped ?? 0,
        failedCaseKeys: c.failedCaseKeys ?? [],
      },
    ])
  ),
})

describe('clampWindowDays', () => {
  it('returns the default for null/undefined/NaN', () => {
    expect(clampWindowDays(null)).toBe(EVAL_TREND_WINDOW_DEFAULT)
    expect(clampWindowDays(undefined)).toBe(EVAL_TREND_WINDOW_DEFAULT)
    expect(clampWindowDays(Number.NaN)).toBe(EVAL_TREND_WINDOW_DEFAULT)
  })
  it('clamps below the floor and above the ceiling', () => {
    expect(clampWindowDays(0)).toBe(EVAL_TREND_WINDOW_MIN)
    expect(clampWindowDays(1)).toBe(EVAL_TREND_WINDOW_MIN)
    expect(clampWindowDays(1000)).toBe(EVAL_TREND_WINDOW_MAX)
  })
  it('passes valid values through (floored)', () => {
    expect(clampWindowDays(7)).toBe(7)
    expect(clampWindowDays(45.7)).toBe(45)
    expect(clampWindowDays(90)).toBe(90)
  })
})

describe('groupForCategory', () => {
  it('groups quality categories', () => {
    expect(groupForCategory('transaction_classification')).toBe('quality')
    expect(groupForCategory('recommendation_quality')).toBe('quality')
    expect(groupForCategory('causal_reasoning')).toBe('quality')
    expect(groupForCategory('strategy_quality')).toBe('quality')
  })
  it('groups safety categories', () => {
    expect(groupForCategory('challenger')).toBe('safety')
    expect(groupForCategory('data_sufficiency')).toBe('safety')
    expect(groupForCategory('risk_calibration')).toBe('safety')
    expect(groupForCategory('post_mortem_safety')).toBe('safety')
  })
  it('groups economics categories', () => {
    expect(groupForCategory('cost_control')).toBe('economics')
  })
  it('falls back to quality for unknown categories', () => {
    expect(groupForCategory('something_new')).toBe('quality')
  })
})

describe('computeAdvisorEvalTrends', () => {
  const now = new Date('2026-05-01T09:00:00.000Z')

  it('returns insufficient_data when only one historical run exists for a category', () => {
    const runs = [
      baseRun({
        id: 11,
        createdAt: '2026-05-01T08:00:00.000Z',
        summary: withCategorySummary({ causal_reasoning: { total: 4, passed: 4, failed: 0 } }),
      }),
    ]
    const out = computeAdvisorEvalTrends(runs, 30, now)
    const quality = out.groups.find(g => g.group === 'quality')
    const causal = quality?.categories.find(c => c.category === 'causal_reasoning')
    expect(causal?.totalRuns).toBe(1)
    expect(causal?.previous).toBeNull()
    expect(causal?.delta).toBeNull()
    expect(causal?.status).toBe('insufficient_data')
  })

  it('detects an improving trend when latest pass rate is above the previous one (beyond tolerance)', () => {
    const runs = [
      baseRun({
        id: 22,
        createdAt: '2026-05-01T08:00:00.000Z',
        summary: withCategorySummary({ causal_reasoning: { total: 4, passed: 4, failed: 0 } }),
      }),
      baseRun({
        id: 21,
        createdAt: '2026-04-30T08:00:00.000Z',
        summary: withCategorySummary({ causal_reasoning: { total: 4, passed: 2, failed: 2 } }),
      }),
    ]
    const out = computeAdvisorEvalTrends(runs, 30, now)
    const causal = out.groups
      .find(g => g.group === 'quality')
      ?.categories.find(c => c.category === 'causal_reasoning')
    expect(causal?.totalRuns).toBe(2)
    expect(causal?.latest.passRate).toBe(1)
    expect(causal?.previous?.passRate).toBe(0.5)
    expect(causal?.delta).toBeCloseTo(0.5, 5)
    expect(causal?.status).toBe('improving')
  })

  it('detects a regressing trend when latest is meaningfully worse than previous', () => {
    const runs = [
      baseRun({
        id: 32,
        createdAt: '2026-05-01T08:00:00.000Z',
        summary: withCategorySummary({ post_mortem_safety: { total: 1, passed: 0, failed: 1 } }),
      }),
      baseRun({
        id: 31,
        createdAt: '2026-04-29T08:00:00.000Z',
        summary: withCategorySummary({ post_mortem_safety: { total: 1, passed: 1, failed: 0 } }),
      }),
    ]
    const out = computeAdvisorEvalTrends(runs, 30, now)
    const safety = out.groups.find(g => g.group === 'safety')
    const cat = safety?.categories.find(c => c.category === 'post_mortem_safety')
    expect(cat?.status).toBe('regressing')
    expect(cat?.delta).toBeCloseTo(-1, 5)
  })

  it('marks small deltas as stable (within ±0.05)', () => {
    const runs = [
      baseRun({
        id: 42,
        createdAt: '2026-05-01T08:00:00.000Z',
        summary: withCategorySummary({ strategy_quality: { total: 100, passed: 96, failed: 4 } }),
      }),
      baseRun({
        id: 41,
        createdAt: '2026-04-30T08:00:00.000Z',
        summary: withCategorySummary({ strategy_quality: { total: 100, passed: 98, failed: 2 } }),
      }),
    ]
    const out = computeAdvisorEvalTrends(runs, 30, now)
    const cat = out.groups
      .find(g => g.group === 'quality')
      ?.categories.find(c => c.category === 'strategy_quality')
    expect(cat?.status).toBe('stable')
  })

  it('groups categories correctly across quality / safety / economics', () => {
    const runs = [
      baseRun({
        id: 52,
        createdAt: '2026-05-01T08:00:00.000Z',
        summary: withCategorySummary({
          causal_reasoning: { total: 1, passed: 1, failed: 0 },
          challenger: { total: 1, passed: 1, failed: 0 },
          cost_control: { total: 1, passed: 1, failed: 0 },
        }),
      }),
      baseRun({
        id: 51,
        createdAt: '2026-04-30T08:00:00.000Z',
        summary: withCategorySummary({
          causal_reasoning: { total: 1, passed: 1, failed: 0 },
          challenger: { total: 1, passed: 1, failed: 0 },
          cost_control: { total: 1, passed: 1, failed: 0 },
        }),
      }),
    ]
    const out = computeAdvisorEvalTrends(runs, 30, now)
    expect(out.groups.map(g => g.group)).toEqual(['quality', 'safety', 'economics'])
    const [quality, safety, economics] = out.groups
    if (!quality || !safety || !economics) throw new Error('expected three groups')
    expect(quality.categories.map(c => c.category)).toContain('causal_reasoning')
    expect(safety.categories.map(c => c.category)).toContain('challenger')
    expect(economics.categories.map(c => c.category)).toContain('cost_control')
  })

  it('reconstructs a fallback breakdown from failedCaseDetails when byCategory is missing', () => {
    const runs = [
      baseRun({
        id: 62,
        createdAt: '2026-05-01T08:00:00.000Z',
        summary: {
          failedCaseKeys: ['rec-needs-evidence'],
          failedCaseDetails: [
            { caseId: 'rec-needs-evidence', category: 'recommendation_quality', failedExpectations: [] },
          ],
        },
      }),
      baseRun({
        id: 61,
        createdAt: '2026-04-30T08:00:00.000Z',
        summary: {
          failedCaseKeys: [],
          failedCaseDetails: [],
        },
      }),
    ]
    const out = computeAdvisorEvalTrends(runs, 30, now)
    const cat = out.groups
      .find(g => g.group === 'quality')
      ?.categories.find(c => c.category === 'recommendation_quality')
    expect(cat).toBeDefined()
    expect(cat?.latest.failed).toBe(1)
    expect(cat?.latest.failedCaseKeys).toContain('rec-needs-evidence')
    // Fallback caveat surfaces when at least one historical run lacked byCategory.
    expect(out.caveats.some(c => c.includes('reconstruites'))).toBe(true)
  })

  it('returns null group rates and "no run" caveat when there is no eval history at all', () => {
    const out = computeAdvisorEvalTrends([], 30, now)
    expect(out.groups.every(g => g.totalRuns === 0)).toBe(true)
    expect(out.groups.every(g => g.latestPassRate === null)).toBe(true)
    expect(out.groups.every(g => g.delta === null)).toBe(true)
    expect(out.caveats.some(c => c.includes('Aucune exécution'))).toBe(true)
  })

  it('always carries the deterministic-evals caveat (no profitability/predictivity claim)', () => {
    const out = computeAdvisorEvalTrends([], 30, now)
    expect(out.caveats[0]).toContain('déterministes')
    expect(out.caveats[0]).toContain('profitabilité')
  })
})

describe('buildDeterministicAdvisorEvalTrendsDemo', () => {
  it('returns mode=demo with all three groups and stable caveat copy', () => {
    const out = buildDeterministicAdvisorEvalTrendsDemo(new Date('2026-05-01T09:00:00.000Z'), 30)
    expect(out.mode).toBe('demo')
    expect(out.windowDays).toBe(30)
    expect(out.groups.map(g => g.group)).toEqual(['quality', 'safety', 'economics'])
    expect(out.caveats[0]).toContain('démo')
  })

  it('is deterministic — same input produces same output', () => {
    const a = buildDeterministicAdvisorEvalTrendsDemo(new Date('2026-05-01T09:00:00.000Z'), 30)
    const b = buildDeterministicAdvisorEvalTrendsDemo(new Date('2026-05-01T09:00:00.000Z'), 30)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('createAdvisorEvalTrendsUseCase', () => {
  const repoCalls: Array<{ windowDays: number; limit: number }> = []
  const buildRepo = (
    runs: DashboardAdvisorEvalRunResponse[]
  ): EvalTrendsRepositoryAdapter => ({
    listAdvisorEvalTrendRuns: async input => {
      repoCalls.push(input)
      return runs
    },
  })

  it('returns demo fixtures in demo mode WITHOUT touching the repository', async () => {
    repoCalls.length = 0
    const useCase = createAdvisorEvalTrendsUseCase({ repository: buildRepo([]) })
    const out = await useCase.getAdvisorEvalsTrends({
      mode: 'demo',
      requestId: 'r1',
      windowDays: 30,
      now: new Date('2026-05-01T09:00:00.000Z'),
    })
    expect(out.mode).toBe('demo')
    expect(repoCalls).toHaveLength(0)
  })

  it('clamps windowDays before calling the repository in admin mode', async () => {
    repoCalls.length = 0
    const useCase = createAdvisorEvalTrendsUseCase({ repository: buildRepo([]) })
    await useCase.getAdvisorEvalsTrends({
      mode: 'admin',
      requestId: 'r1',
      windowDays: 1000,
    })
    expect(repoCalls).toHaveLength(1)
    expect(repoCalls[0]?.windowDays).toBe(EVAL_TREND_WINDOW_MAX)
  })

  it('uses the default window when none is provided', async () => {
    repoCalls.length = 0
    const useCase = createAdvisorEvalTrendsUseCase({ repository: buildRepo([]) })
    await useCase.getAdvisorEvalsTrends({ mode: 'admin', requestId: 'r1' })
    expect(repoCalls[0]?.windowDays).toBe(EVAL_TREND_WINDOW_DEFAULT)
  })
})
