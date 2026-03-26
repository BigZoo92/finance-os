import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import {
  fetchDashboardDerivedRecomputeStatus,
  fetchDashboardSummary,
  fetchDashboardTransactions,
} from './dashboard-api'
import type { AuthMode } from './auth-types'
import {
  getDemoDashboardDerivedRecomputeStatus,
  getDemoDashboardSummary,
  getDemoDashboardTransactions,
} from './demo-data'
import type { DashboardRange } from './dashboard-types'

export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  summary: (range: DashboardRange) => [...dashboardQueryKeys.all, 'summary', range] as const,
  derivedRecomputeStatus: () => [...dashboardQueryKeys.all, 'derived-recompute'] as const,
  transactions: (params: { range: DashboardRange; limit: number }) =>
    [...dashboardQueryKeys.all, 'transactions', params.range, params.limit] as const,
}

export const dashboardSummaryQueryOptions = (range: DashboardRange) =>
  dashboardSummaryQueryOptionsWithMode({
    range,
    mode: 'admin',
  })

export const dashboardSummaryQueryOptionsWithMode = ({
  range,
  mode,
}: {
  range: DashboardRange
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.summary(range),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardSummary(range)
      }

      return fetchDashboardSummary(range)
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })

export const dashboardDerivedRecomputeStatusQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
} = {}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.derivedRecomputeStatus(),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardDerivedRecomputeStatus()
      }

      return fetchDashboardDerivedRecomputeStatus()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 5_000,
    refetchInterval: query =>
      mode === 'admin' && query.state.data?.state === 'running' ? 3_000 : false,
  })

export const dashboardTransactionsInfiniteQueryOptions = (params: {
  range: DashboardRange
  limit: number
}) =>
  dashboardTransactionsInfiniteQueryOptionsWithMode({
    ...params,
    mode: 'admin',
  })

export const dashboardTransactionsInfiniteQueryOptionsWithMode = (params: {
  range: DashboardRange
  limit: number
  mode?: AuthMode
}) =>
  infiniteQueryOptions({
    queryKey: dashboardQueryKeys.transactions(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const transactionParams = {
        range: params.range,
        limit: params.limit,
        ...(pageParam ? { cursor: pageParam } : {}),
      }

      if (params.mode === 'demo') {
        return getDemoDashboardTransactions(transactionParams)
      }

      return fetchDashboardTransactions(transactionParams)
    },
    enabled: params.mode !== undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    staleTime: params.mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })
