import { describe, expect, it } from 'vitest'
import { deriveAnalyticsPageState } from './analytics-view-state'
import type { DashboardAnalyticsResponse } from './analytics-types'

const buildPayload = (overrides?: Partial<DashboardAnalyticsResponse>): DashboardAnalyticsResponse => ({
  schemaVersion: '2026-04-06',
  range: '30d',
  source: 'demoAdapter',
  generatedAt: '2026-04-06T00:00:00.000Z',
  summaryCards: {
    netWorth: { value: 100, state: 'ready' },
    incomes: { value: 80, state: 'ready' },
    expenses: { value: 20, state: 'ready' },
  },
  timeseries: {
    points: [{ date: '2026-04-01', balance: 100 }],
    state: 'ready',
  },
  categorySplit: {
    items: [{ label: 'Housing', total: 20, ratio: 1 }],
    state: 'ready',
  },
  portfolioAllocation: {
    items: [{ type: 'investment', total: 100, ratio: 1 }],
    state: 'ready',
  },
  allocationEvolution: {
    points: [{ date: '2026-04-01', total: 100, cash: 0, investment: 100, manual: 0 }],
    state: 'ready',
  },
  availability: {
    summaryCards: true,
    timeseries: true,
    categorySplit: true,
    portfolioAllocation: true,
    allocationEvolution: true,
  },
  ...overrides,
})

describe('deriveAnalyticsPageState', () => {
  it('returns loading while query is pending', () => {
    expect(deriveAnalyticsPageState({ isLoading: true, isError: false, data: undefined })).toBe('loading')
  })

  it('returns ready while query is pending with existing analytics data', () => {
    expect(deriveAnalyticsPageState({ isLoading: true, isError: false, data: buildPayload() })).toBe('ready')
  })

  it('returns error when query fails', () => {
    expect(deriveAnalyticsPageState({ isLoading: false, isError: true, data: undefined })).toBe('error')
  })

  it('returns degraded when query fails with existing analytics data', () => {
    expect(deriveAnalyticsPageState({ isLoading: false, isError: true, data: buildPayload() })).toBe('degraded')
  })

  it('returns empty when every widget is empty', () => {
    const empty = buildPayload({
      summaryCards: {
        netWorth: { value: 0, state: 'empty' },
        incomes: { value: 0, state: 'empty' },
        expenses: { value: 0, state: 'empty' },
      },
      timeseries: { points: [], state: 'empty' },
      categorySplit: { items: [], state: 'empty' },
      portfolioAllocation: { items: [], state: 'empty' },
      allocationEvolution: { points: [], state: 'empty' },
    })

    expect(deriveAnalyticsPageState({ isLoading: false, isError: false, data: empty })).toBe('empty')
  })

  it('returns degraded when any widget is degraded', () => {
    const degraded = buildPayload({
      timeseries: { points: [], state: 'degraded' },
      availability: {
        summaryCards: true,
        timeseries: false,
        categorySplit: true,
        portfolioAllocation: true,
        allocationEvolution: true,
      },
    })

    expect(deriveAnalyticsPageState({ isLoading: false, isError: false, data: degraded })).toBe('degraded')
  })

  it('returns degraded when widget states are mixed instead of fully ready', () => {
    const partial = buildPayload({
      categorySplit: { items: [], state: 'empty' },
      availability: {
        summaryCards: true,
        timeseries: true,
        categorySplit: false,
        portfolioAllocation: true,
        allocationEvolution: true,
      },
    })

    expect(deriveAnalyticsPageState({ isLoading: false, isError: false, data: partial })).toBe('degraded')
  })

  it('returns ready when data has no degraded widgets', () => {
    expect(deriveAnalyticsPageState({ isLoading: false, isError: false, data: buildPayload() })).toBe('ready')
  })
})
