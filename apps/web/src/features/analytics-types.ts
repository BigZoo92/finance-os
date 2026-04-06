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
  availability: {
    summaryCards: boolean
    timeseries: boolean
    categorySplit: boolean
  }
}

export type AnalyticsPageState = 'loading' | 'ready' | 'empty' | 'degraded' | 'error'
