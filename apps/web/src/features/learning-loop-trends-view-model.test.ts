import { describe, expect, it } from 'vitest'
import { buildEvalScorecardTrends } from './learning-loop-view-model'
import type { DashboardAdvisorEvalTrendsResponse } from './dashboard-types'

const sampleResponse: DashboardAdvisorEvalTrendsResponse = {
  generatedAt: '2026-05-01T09:00:00.000Z',
  mode: 'admin',
  windowDays: 30,
  groups: [
    {
      group: 'quality',
      totalRuns: 4,
      latestPassRate: 1,
      previousPassRate: 0.5,
      delta: 0.5,
      categories: [
        {
          category: 'causal_reasoning',
          totalRuns: 4,
          latest: {
            runId: '22',
            createdAt: '2026-05-01T08:00:00.000Z',
            passRate: 1,
            passed: 4,
            failed: 0,
            skipped: 0,
            failedCaseKeys: [],
          },
          previous: { runId: '21', createdAt: '2026-04-30T08:00:00.000Z', passRate: 0.5 },
          delta: 0.5,
          status: 'improving',
        },
      ],
    },
    {
      group: 'safety',
      totalRuns: 3,
      latestPassRate: 1,
      previousPassRate: 1,
      delta: 0,
      categories: [
        {
          category: 'post_mortem_safety',
          totalRuns: 3,
          latest: {
            runId: '32',
            createdAt: '2026-05-01T08:00:00.000Z',
            passRate: 1,
            passed: 1,
            failed: 0,
            skipped: 0,
            failedCaseKeys: [],
          },
          previous: { runId: '31', createdAt: '2026-04-30T08:00:00.000Z', passRate: 1 },
          delta: 0,
          status: 'stable',
        },
      ],
    },
    {
      group: 'economics',
      totalRuns: 1,
      latestPassRate: null,
      previousPassRate: null,
      delta: null,
      categories: [
        {
          category: 'cost_control',
          totalRuns: 1,
          latest: {
            runId: '12',
            createdAt: '2026-05-01T08:00:00.000Z',
            passRate: null,
            passed: 0,
            failed: 0,
            skipped: 0,
            failedCaseKeys: [],
          },
          previous: null,
          delta: null,
          status: 'insufficient_data',
        },
      ],
    },
  ],
  caveats: ['Tendances calculées à partir des evals déterministes uniquement.'],
}

const emptyResponse: DashboardAdvisorEvalTrendsResponse = {
  generatedAt: '2026-05-01T09:00:00.000Z',
  mode: 'admin',
  windowDays: 30,
  groups: [
    { group: 'quality', totalRuns: 0, latestPassRate: null, previousPassRate: null, delta: null, categories: [] },
    { group: 'safety', totalRuns: 0, latestPassRate: null, previousPassRate: null, delta: null, categories: [] },
    {
      group: 'economics',
      totalRuns: 0,
      latestPassRate: null,
      previousPassRate: null,
      delta: null,
      categories: [],
    },
  ],
  caveats: ["Aucune exécution d'eval enregistrée dans la fenêtre demandée."],
}

describe('buildEvalScorecardTrends', () => {
  it('returns flag_disabled when the learning-loop UI flag is off', () => {
    const out = buildEvalScorecardTrends({
      flagEnabled: false,
      data: sampleResponse,
      isError: false,
      isPending: false,
    })
    expect(out.kind).toBe('flag_disabled')
  })

  it('returns loading when the query is pending and no cached data is present', () => {
    const out = buildEvalScorecardTrends({
      flagEnabled: true,
      data: undefined,
      isError: false,
      isPending: true,
    })
    expect(out.kind).toBe('loading')
  })

  it('returns unavailable when the query errored', () => {
    const out = buildEvalScorecardTrends({
      flagEnabled: true,
      data: undefined,
      isError: true,
      isPending: false,
    })
    expect(out.kind).toBe('unavailable')
  })

  it('returns ready with three groups when data is present', () => {
    const out = buildEvalScorecardTrends({
      flagEnabled: true,
      data: sampleResponse,
      isError: false,
      isPending: false,
    })
    expect(out.kind).toBe('ready')
    if (out.kind !== 'ready') return
    expect(out.groups.map(g => g.group)).toEqual(['quality', 'safety', 'economics'])
    expect(out.groups[0]?.status).toBe('improving')
    expect(out.groups[1]?.status).toBe('stable')
    expect(out.groups[2]?.status).toBe('insufficient_data')
    expect(out.caveats[0]).toContain('déterministes')
  })

  it('returns empty when no group has any runs', () => {
    const out = buildEvalScorecardTrends({
      flagEnabled: true,
      data: emptyResponse,
      isError: false,
      isPending: false,
    })
    expect(out.kind).toBe('empty')
  })

  it('never fabricates a delta when data is missing', () => {
    const out = buildEvalScorecardTrends({
      flagEnabled: true,
      data: sampleResponse,
      isError: false,
      isPending: false,
    })
    if (out.kind !== 'ready') throw new Error('expected ready')
    const economics = out.groups.find(g => g.group === 'economics')
    expect(economics?.delta).toBeNull()
    expect(economics?.latestPassRate).toBeNull()
  })

  it('caps surfaced failedCaseKeys at 5 to bound UI rendering', () => {
    const [quality, safety, economics] = sampleResponse.groups
    if (!quality || !safety || !economics) throw new Error('fixture must expose three groups')
    const firstCategory = quality.categories[0]
    if (!firstCategory) throw new Error('fixture must expose at least one category')
    const flooded: DashboardAdvisorEvalTrendsResponse = {
      ...sampleResponse,
      groups: [
        {
          ...quality,
          categories: [
            {
              ...firstCategory,
              latest: {
                ...firstCategory.latest,
                failedCaseKeys: Array.from({ length: 12 }, (_, i) => `case-${i}`),
              },
            },
          ],
        },
        safety,
        economics,
      ],
    }
    const out = buildEvalScorecardTrends({
      flagEnabled: true,
      data: flooded,
      isError: false,
      isPending: false,
    })
    if (out.kind !== 'ready') throw new Error('expected ready')
    expect(out.groups[0]?.categories[0]?.failedCaseKeys.length).toBeLessThanOrEqual(5)
  })
})
