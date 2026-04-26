import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { dashboardNewsQueryOptionsWithMode } from '@/features/dashboard-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { PageHeader } from '@/components/surfaces/page-header'
import { NewsFeed } from '@/components/dashboard/news-feed'

export const Route = createFileRoute('/_app/signaux/')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    await context.queryClient.ensureQueryData(dashboardNewsQueryOptionsWithMode({ mode }))
  },
  component: SignauxActualitesPage,
})

function SignauxActualitesPage() {
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Données & signaux"
        icon="⊟"
        title="Actualités"
        description="Flux macro-financier externe. Ces signaux alimentent l'Advisor IA et enrichissent le graphe de connaissances pour contextualiser vos recommandations."
      />

      <div className="rounded-xl border border-border/40 bg-surface-1/40 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-aurora/60">
          rôle de cette surface
        </p>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          Les actualités sont un flux de contexte, pas le centre de l'app. Elles servent à nourrir
          les recommandations de l'Advisor IA avec des signaux macro-financiers, des événements de
          marché et des données externes fraîches. Consultez l'IA pour des analyses personnalisées.
        </p>
      </div>

      {authMode ? (
        <NewsFeed mode={authMode} />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Chargement...
          </CardContent>
        </Card>
      )}
    </div>
  )
}
