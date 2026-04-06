import type { DashboardAnalyticsResponse, AnalyticsPageState } from './analytics-types'

export const deriveAnalyticsPageState = ({
  isLoading,
  isError,
  data,
}: {
  isLoading: boolean
  isError: boolean
  data: DashboardAnalyticsResponse | undefined
}): AnalyticsPageState => {
  if (isLoading) {
    return 'loading'
  }

  if (isError || !data) {
    return 'error'
  }

  const widgetStates = [
    data.summaryCards.netWorth.state,
    data.summaryCards.incomes.state,
    data.summaryCards.expenses.state,
    data.timeseries.state,
    data.categorySplit.state,
    data.portfolioAllocation.state,
    data.allocationEvolution.state,
  ]

  if (widgetStates.every(state => state === 'empty')) {
    return 'empty'
  }

  if (widgetStates.some(state => state === 'degraded')) {
    return 'degraded'
  }

  return 'ready'
}
