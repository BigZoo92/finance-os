import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import {
  fetchDashboardAdvisor,
  getDemoDashboardAdvisor,
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

export type DemoTransactionsScenario =
  | 'default'
  | 'empty'
  | 'subscriptions'
  | 'parse_error'
  | 'student_budget'
  | 'freelancer_cashflow'
  | 'family_planning'
  | 'retiree_stability'

export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  summary: (range: DashboardRange) => [...dashboardQueryKeys.all, 'summary', range] as const,
  derivedRecomputeStatus: () => [...dashboardQueryKeys.all, 'derived-recompute'] as const,
  news: (params?: {
    topic?: string
    source?: string
    sourceType?: string
    domain?: string
    eventType?: string
    minSeverity?: number
    region?: string
    ticker?: string
    sector?: string
    direction?: 'risk' | 'opportunity' | 'mixed'
    from?: string
    to?: string
    limit?: number
  }) =>
    [
      ...dashboardQueryKeys.all,
      'news',
      params?.topic ?? null,
      params?.source ?? null,
      params?.sourceType ?? null,
      params?.domain ?? null,
      params?.eventType ?? null,
      params?.minSeverity ?? null,
      params?.region ?? null,
      params?.ticker ?? null,
      params?.sector ?? null,
      params?.direction ?? null,
      params?.from ?? null,
      params?.to ?? null,
      params?.limit ?? 20,
    ] as const,
  advisor: (range: DashboardRange) => [...dashboardQueryKeys.all, 'advisor', range] as const,
  transactions: (params: {
    range: DashboardRange
    limit: number
    demoScenario?: DemoTransactionsScenario
    demoProfile?: string
  }) =>
    [
      ...dashboardQueryKeys.all,
      'transactions',
      params.range,
      params.limit,
      params.demoScenario ?? null,
      params.demoProfile ?? null,
    ] as const,
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
  sourceType,
  domain,
  eventType,
  minSeverity,
  region,
  ticker,
  sector,
  direction,
  from,
  to,
  limit = 20,
}: {
  mode?: AuthMode
  topic?: string
  source?: string
  sourceType?: string
  domain?: string
  eventType?: string
  minSeverity?: number
  region?: string
  ticker?: string
  sector?: string
  direction?: 'risk' | 'opportunity' | 'mixed'
  from?: string
  to?: string
  limit?: number
}) => {
  const keyParams = {
    ...(topic ? { topic } : {}),
    ...(source ? { source } : {}),
    ...(sourceType ? { sourceType } : {}),
    ...(domain ? { domain } : {}),
    ...(eventType ? { eventType } : {}),
    ...(minSeverity !== undefined ? { minSeverity } : {}),
    ...(region ? { region } : {}),
    ...(ticker ? { ticker } : {}),
    ...(sector ? { sector } : {}),
    ...(direction ? { direction } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
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


export const dashboardAdvisorQueryOptionsWithMode = ({
  range,
  mode,
}: {
  range: DashboardRange
  mode?: AuthMode
}) =>
  queryOptions({
    queryKey: dashboardQueryKeys.advisor(range),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoDashboardAdvisor(range)
      }

      return fetchDashboardAdvisor(range)
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
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
  demoProfile?: string
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
        ...(params.mode === 'demo' && params.demoProfile ? { demoProfile: params.demoProfile } : {}),
      })
    },
    enabled: params.mode !== undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    staleTime: params.mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })
