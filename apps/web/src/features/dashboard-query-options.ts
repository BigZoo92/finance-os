import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { fetchDashboardSummary, fetchDashboardTransactions } from './dashboard-api'
import type { DashboardRange } from './dashboard-types'

export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  summary: (range: DashboardRange) => [...dashboardQueryKeys.all, 'summary', range] as const,
  transactions: (params: { range: DashboardRange; limit: number }) =>
    [...dashboardQueryKeys.all, 'transactions', params.range, params.limit] as const,
}

export const dashboardSummaryQueryOptions = (range: DashboardRange) =>
  queryOptions({
    queryKey: dashboardQueryKeys.summary(range),
    queryFn: () => fetchDashboardSummary(range),
    staleTime: 30_000,
  })

export const dashboardTransactionsInfiniteQueryOptions = (params: {
  range: DashboardRange
  limit: number
}) =>
  infiniteQueryOptions({
    queryKey: dashboardQueryKeys.transactions(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchDashboardTransactions({
        range: params.range,
        limit: params.limit,
        cursor: pageParam,
      }),
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    staleTime: 15_000,
  })
