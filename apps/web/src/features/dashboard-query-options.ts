import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import {
  fetchDashboardDerivedRecomputeStatus,
  fetchDashboardNews,
  fetchDashboardSummary,
  fetchDashboardTransactions,
} from './dashboard-api'
import type { AuthMode } from './auth-types'
import {
  getDemoDashboardDerivedRecomputeStatus,
  getDemoDashboardNews,
  getDemoDashboardSummary,
} from './demo-data'
import type { DashboardRange } from './dashboard-types'

export type DemoTransactionsScenario = 'default' | 'empty' | 'subscriptions' | 'parse_error'

export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  summary: (range: DashboardRange) => [...dashboardQueryKeys.all, 'summary', range] as const,
  derivedRecomputeStatus: () => [...dashboardQueryKeys.all, 'derived-recompute'] as const,
  news: (params?: { topic?: string; source?: string; limit?: number }) =>
    [...dashboardQueryKeys.all, 'news', params?.topic ?? null, params?.source ?? null, params?.limit ?? 20] as const,
  transactions: (params: {
    range: DashboardRange
    limit: number
    demoScenario?: DemoTransactionsScenario
  }) =>
    [...dashboardQueryKeys.all, 'transactions', params.range, params.limit, params.demoScenario ?? null] as const,
}

export const dashboardSummaryQueryOptions = (range: DashboardRange) =>
  dashboardSummaryQueryOptionsWithMode({
    range,
    mode: 'admin',
  })

export const dashboardNewsQueryOptionsWithMode = ({
  mode,
  topic,
  source,
  limit = 20,
}: {
  mode?: AuthMode
  topic?: string
  source?: string
  limit?: number
}) => {
  const keyParams = {
    ...(topic ? { topic } : {}),
    ...(source ? { source } : {}),
    limit,
  }

  return queryOptions({
    queryKey: dashboardQueryKeys.news(keyParams),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardNews()
      }

      return fetchDashboardNews(keyParams)
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })
}

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
  demoScenario?: DemoTransactionsScenario
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

      return fetchDashboardTransactions({
        ...transactionParams,
        ...(params.mode === 'demo' && params.demoScenario
          ? { demoScenario: params.demoScenario }
          : {}),
      })
    },
    enabled: params.mode !== undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    staleTime: params.mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })
