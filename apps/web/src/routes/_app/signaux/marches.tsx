import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, Button } from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { MarketsDashboard } from '@/components/markets/markets-dashboard'
import { TopMoversChroma } from '@/components/markets/top-movers-chroma'
import { postMarketsRefresh } from '@/features/markets/api'
import { marketQueryKeys, marketsOverviewQueryOptions } from '@/features/markets/query-options'
import { toErrorMessage } from '@/lib/format'
import { PageHeader } from '@/components/surfaces/page-header'
import { pushToast } from '@/lib/toast-store'

export const Route = createFileRoute('/_app/signaux/marches')({
  loader: async ({ context }) => {
    await context.queryClient.fetchQuery(authMeQueryOptions())
    await context.queryClient.ensureQueryData(marketsOverviewQueryOptions())
  },
  component: SignauxMarchesPage,
})

function SignauxMarchesPage() {
  const queryClient = useQueryClient()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined =
    authViewState === 'admin' ? 'admin' : authViewState === 'demo' ? 'demo' : undefined

  const overviewQuery = useQuery(marketsOverviewQueryOptions())
  const refreshMutation = useMutation({
    mutationFn: postMarketsRefresh,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: marketQueryKeys.overview() })
      pushToast({ title: 'Marchés rafraîchis', tone: 'info' })
    },
    onError: (err) => {
      pushToast({ title: 'Erreur de rafraîchissement', description: toErrorMessage(err), tone: 'error' })
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
      <div className="space-y-8">
        <PageHeader
          eyebrow="Données & signaux"
          icon="≈"
          title="Marchés & macro"
          description="Contexte macro-économique, signaux de marché et watchlist mondiale."
        />
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-lg font-semibold">Marchés indisponibles</p>
            <p className="text-sm text-muted-foreground">
              {overviewQuery.isError ? toErrorMessage(overviewQuery.error) : 'Données en chargement.'}
            </p>
            <Button type="button" onClick={() => overviewQuery.refetch()}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Données & signaux"
        icon="≈"
        title="Marchés & macro"
        description="Panorama macro-économique et signaux de marché. Ces données alimentent le contexte de l'Advisor IA."
        actions={
          isAdmin ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              {refreshMutation.isPending ? 'Rafraîchissement...' : 'Rafraîchir'}
            </Button>
          ) : null
        }
      />

      <TopMoversChroma items={overviewQuery.data.panorama.items} />
      <MarketsDashboard
        overview={overviewQuery.data}
        isAdmin={isAdmin}
        refreshPending={refreshMutation.isPending}
        onRefresh={() => refreshMutation.mutate()}
      />
    </div>
  )
}
