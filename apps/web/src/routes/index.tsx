import { createFileRoute } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { DashboardAppShell } from '@/components/dashboard/app-shell'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import {
  dashboardDerivedRecomputeStatusQueryOptionsWithMode,
  dashboardSummaryQueryOptionsWithMode,
  dashboardTransactionsInfiniteQueryOptionsWithMode,
} from '@/features/dashboard-query-options'
import type { DashboardRange } from '@/features/dashboard-types'
import { financialGoalsQueryOptionsWithMode } from '@/features/goals/query-options'
import {
  powensStatusQueryOptionsWithMode,
  powensSyncRunsQueryOptionsWithMode,
} from '@/features/powens/query-options'

const dashboardSearchSchema = z.object({
  range: z.enum(['7d', '30d', '90d']).optional(),
})

const resolveRange = (value: string | undefined): DashboardRange => {
  return value === '7d' || value === '90d' ? value : '30d'
}

const swallowPowensPrefetchError = async (prefetch: Promise<unknown>) => {
  try {
    await prefetch
  } catch {
    // Fail-soft by design: dashboard still renders with localized widget-level errors.
  }
}

export const prefetchDashboardRouteQueries = async ({
  queryClient,
  mode,
  range,
}: {
  queryClient: QueryClient
  mode: AuthMode
  range: DashboardRange
}) => {
  await Promise.all([
    queryClient.ensureQueryData(
      dashboardSummaryQueryOptionsWithMode({
        range,
        mode,
      })
    ),
    queryClient.ensureInfiniteQueryData(
      dashboardTransactionsInfiniteQueryOptionsWithMode({
        range,
        limit: 30,
        mode,
      })
    ),
    queryClient.ensureQueryData(
      financialGoalsQueryOptionsWithMode({
        mode,
      })
    ),
    swallowPowensPrefetchError(
      queryClient.ensureQueryData(
        powensStatusQueryOptionsWithMode({
          mode,
        })
      )
    ),
    swallowPowensPrefetchError(
      queryClient.ensureQueryData(
        powensSyncRunsQueryOptionsWithMode({
          mode,
        })
      )
    ),
    queryClient.ensureQueryData(
      dashboardDerivedRecomputeStatusQueryOptionsWithMode({
        mode,
      })
    ),
  ])
}

export const Route = createFileRoute('/')({
  validateSearch: search => dashboardSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    range: resolveRange(search.range),
  }),
  loader: async ({ context, deps }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())

    await prefetchDashboardRouteQueries({
      queryClient: context.queryClient,
      mode: auth.mode,
      range: deps.range,
    })
  },
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()

  return <DashboardAppShell range={resolveRange(search.range)} />
}
