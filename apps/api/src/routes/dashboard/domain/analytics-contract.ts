import type { DashboardRange, DashboardSummaryResponse } from '../types'

export type DashboardAnalyticsWidgetState = 'loading' | 'ready' | 'empty' | 'degraded' | 'error'

export interface DashboardAnalyticsResponse {
  schemaVersion: '2026-04-06'
  range: DashboardRange
  source: 'demoAdapter' | 'adminAdapter'
  generatedAt: string
  summaryCards: {
    netWorth: { value: number; state: DashboardAnalyticsWidgetState }
    incomes: { value: number; state: DashboardAnalyticsWidgetState }
    expenses: { value: number; state: DashboardAnalyticsWidgetState }
  }
  timeseries: {
    points: Array<{ date: string; balance: number }>
    state: DashboardAnalyticsWidgetState
  }
  categorySplit: {
    items: Array<{ label: string; total: number; ratio: number }>
    state: DashboardAnalyticsWidgetState
  }
  availability: {
    summaryCards: boolean
    timeseries: boolean
    categorySplit: boolean
  }
}

const toState = (enabled: boolean, hasData: boolean): DashboardAnalyticsWidgetState => {
  if (!enabled) {
    return 'degraded'
  }

  return hasData ? 'ready' : 'empty'
}

const getDisabledWidgets = () => {
  const raw = process.env.DASHBOARD_ANALYTICS_DISABLED_WIDGETS
  if (!raw) {
    return new Set<string>()
  }

  return new Set(
    raw
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  )
}

export const mapSummaryToAnalyticsContract = ({
  summary,
  source,
}: {
  summary: DashboardSummaryResponse
  source: 'demoAdapter' | 'adminAdapter'
}): DashboardAnalyticsResponse => {
  const disabledWidgets = getDisabledWidgets()
  const availability = {
    summaryCards: !disabledWidgets.has('summaryCards'),
    timeseries: !disabledWidgets.has('timeseries'),
    categorySplit: !disabledWidgets.has('categorySplit'),
  }

  const categoryTotal = summary.topExpenseGroups.reduce((acc, item) => acc + item.total, 0)
  const categoryItems = summary.topExpenseGroups.map(item => ({
    label: item.label,
    total: item.total,
    ratio: categoryTotal > 0 ? Number((item.total / categoryTotal).toFixed(4)) : 0,
  }))

  return {
    schemaVersion: '2026-04-06',
    range: summary.range,
    source,
    generatedAt: new Date().toISOString(),
    summaryCards: {
      netWorth: {
        value: summary.totals.balance,
        state: toState(availability.summaryCards, Number.isFinite(summary.totals.balance)),
      },
      incomes: {
        value: summary.totals.incomes,
        state: toState(availability.summaryCards, Number.isFinite(summary.totals.incomes)),
      },
      expenses: {
        value: summary.totals.expenses,
        state: toState(availability.summaryCards, Number.isFinite(summary.totals.expenses)),
      },
    },
    timeseries: {
      points: summary.dailyWealthSnapshots,
      state: toState(availability.timeseries, summary.dailyWealthSnapshots.length > 0),
    },
    categorySplit: {
      items: categoryItems,
      state: toState(availability.categorySplit, categoryItems.length > 0),
    },
    availability,
  }
}

export const validateAnalyticsContract = (payload: DashboardAnalyticsResponse) => {
  const hasRange = payload.range === '7d' || payload.range === '30d' || payload.range === '90d'
  const hasSchema = payload.schemaVersion === '2026-04-06'
  const hasSource = payload.source === 'demoAdapter' || payload.source === 'adminAdapter'

  return hasRange && hasSchema && hasSource
}

export const shouldForceAnalyticsDemoAdapter = () => {
  return process.env.DASHBOARD_ANALYTICS_FORCE_DEMO_ADAPTER === '1'
}
