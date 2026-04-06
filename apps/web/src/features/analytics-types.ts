import type { DashboardRange } from './dashboard-types'

export type AnalyticsWidgetState = 'loading' | 'ready' | 'empty' | 'degraded' | 'error'

export type DashboardAnalyticsResponse = {
  schemaVersion: '2026-04-06'
  range: DashboardRange
  source: 'demoAdapter' | 'adminAdapter'
  generatedAt: string
  summaryCards: {
    netWorth: { value: number; state: AnalyticsWidgetState }
    incomes: { value: number; state: AnalyticsWidgetState }
    expenses: { value: number; state: AnalyticsWidgetState }
  }
  timeseries: {
    points: Array<{ date: string; balance: number }>
    state: AnalyticsWidgetState
  }
  categorySplit: {
    items: Array<{ label: string; total: number; ratio: number }>
    state: AnalyticsWidgetState
  }
  portfolioAllocation: {
    items: Array<{ type: 'cash' | 'investment' | 'manual'; total: number; ratio: number }>
    state: AnalyticsWidgetState
  }
  allocationEvolution: {
    points: Array<{
      date: string
      total: number
      cash: number
      investment: number
      manual: number
    }>
    state: AnalyticsWidgetState
  }
  availability: {
    summaryCards: boolean
    timeseries: boolean
    categorySplit: boolean
    portfolioAllocation: boolean
    allocationEvolution: boolean
  }
}

export type AnalyticsPageState = 'loading' | 'ready' | 'empty' | 'degraded' | 'error'
