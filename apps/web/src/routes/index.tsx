import { createFileRoute } from '@tanstack/react-router'
import { DashboardAppShell } from '@/components/dashboard/app-shell'
import {
  dashboardSummaryQueryOptions,
  dashboardTransactionsInfiniteQueryOptions,
} from '@/features/dashboard-query-options'
import type { DashboardRange } from '@/features/dashboard-types'
import { powensStatusQueryOptions } from '@/features/powens/query-options'
import { z } from 'zod'

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
    await Promise.all([
      context.queryClient.ensureQueryData(dashboardSummaryQueryOptions(deps.range)),
      context.queryClient.ensureInfiniteQueryData(
        dashboardTransactionsInfiniteQueryOptions({
          range: deps.range,
          limit: 30,
        })
      ),
      context.queryClient.ensureQueryData(powensStatusQueryOptions()),
    ])
  },
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()

  return <DashboardAppShell range={resolveRange(search.range)} />
}
