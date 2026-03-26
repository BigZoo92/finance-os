import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { DashboardAppShell } from '@/components/dashboard/app-shell'
import { authMeQueryOptions } from '@/features/auth-query-options'
import {
  dashboardSummaryQueryOptionsWithMode,
  dashboardTransactionsInfiniteQueryOptionsWithMode,
} from '@/features/dashboard-query-options'
import { financialGoalsQueryOptionsWithMode } from '@/features/goals/query-options'
import type { DashboardRange } from '@/features/dashboard-types'
import { powensStatusQueryOptionsWithMode } from '@/features/powens/query-options'

const dashboardSearchSchema = z.object({
  range: z.enum(['7d', '30d', '90d']).optional(),
})

const resolveRange = (value: string | undefined): DashboardRange => {
  return value === '7d' || value === '90d' ? value : '30d'
}

export const Route = createFileRoute('/')({
  validateSearch: search => dashboardSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    range: resolveRange(search.range),
  }),
  loader: async ({ context, deps }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())

    await Promise.all([
      context.queryClient.ensureQueryData(
        dashboardSummaryQueryOptionsWithMode({
          range: deps.range,
          mode: auth.mode,
        })
      ),
      context.queryClient.ensureInfiniteQueryData(
        dashboardTransactionsInfiniteQueryOptionsWithMode({
          range: deps.range,
          limit: 30,
          mode: auth.mode,
        })
      ),
      context.queryClient.ensureQueryData(
        financialGoalsQueryOptionsWithMode({
          mode: auth.mode,
        })
      ),
      context.queryClient.ensureQueryData(
        powensStatusQueryOptionsWithMode({
          mode: auth.mode,
        })
      ),
    ])
  },
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()

  return <DashboardAppShell range={resolveRange(search.range)} />
}
