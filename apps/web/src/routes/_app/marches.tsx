import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { MarketsDashboard } from '@/components/markets/markets-dashboard'
import { postMarketsRefresh } from '@/features/markets/api'
import { marketQueryKeys, marketsOverviewQueryOptions } from '@/features/markets/query-options'
import { toErrorMessage } from '@/lib/format'

export const Route = createFileRoute('/_app/marches')({
  loader: async ({ context }) => {
    await context.queryClient.fetchQuery(authMeQueryOptions())
    await context.queryClient.ensureQueryData(marketsOverviewQueryOptions())
  },
  component: MarchesPage,
})

function MarchesPage() {
  const queryClient = useQueryClient()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const authMode: AuthMode | undefined =
    authViewState === 'admin' ? 'admin' : authViewState === 'demo' ? 'demo' : undefined

  const overviewQuery = useQuery(marketsOverviewQueryOptions())
  const refreshMutation = useMutation({
    mutationFn: postMarketsRefresh,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: marketQueryKeys.overview(),
      })
    },
  })

  if (overviewQuery.isPending || authMode === undefined) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-[320px] animate-pulse rounded-[32px] bg-muted" />
          <div className="h-[320px] animate-pulse rounded-[32px] bg-muted" />
        </div>
        <div className="h-[420px] animate-pulse rounded-[32px] bg-muted" />
      </div>
    )
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <Card>
        <CardContent className="space-y-3 py-10 text-center">
          <p className="text-lg font-semibold">Marchés indisponibles</p>
          <p className="text-sm text-muted-foreground">
            {overviewQuery.isError
              ? toErrorMessage(overviewQuery.error)
              : 'Aucune donnée marché exploitable pour le moment.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <MarketsDashboard
      overview={overviewQuery.data}
      isAdmin={authMode === 'admin'}
      refreshPending={refreshMutation.isPending}
      onRefresh={() => {
        if (authMode !== 'admin' || refreshMutation.isPending) {
          return
        }
        refreshMutation.mutate()
      }}
    />
  )
}
