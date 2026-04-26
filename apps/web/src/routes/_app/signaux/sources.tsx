import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { dashboardNewsQueryOptionsWithMode } from '@/features/dashboard-query-options'
import { marketsOverviewQueryOptions } from '@/features/markets/query-options'
import { knowledgeStatsQueryOptionsWithMode } from '@/features/knowledge-query-options'
import { powensStatusQueryOptionsWithMode } from '@/features/powens/query-options'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { StatusDot } from '@/components/surfaces/status-dot'

export const Route = createFileRoute('/_app/signaux/sources')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    await Promise.all([
      context.queryClient.ensureQueryData(dashboardNewsQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(marketsOverviewQueryOptions()),
      context.queryClient.ensureQueryData(knowledgeStatsQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(powensStatusQueryOptionsWithMode({ mode })),
    ])
  },
  component: SignauxSourcesPage,
})

type SourceEntry = {
  name: string
  provider: string
  status: 'ok' | 'degraded' | 'error' | 'idle'
  lastFetch: string | null
  note: string
}

function SignauxSourcesPage() {
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isAdmin = authViewState === 'admin'
  const isDemo = authViewState === 'demo'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined
  const modeOpts = authMode ? { mode: authMode } : {}

  const newsQuery = useQuery(dashboardNewsQueryOptionsWithMode(modeOpts))
  const marketsQuery = useQuery(marketsOverviewQueryOptions())
  const knowledgeQuery = useQuery(knowledgeStatsQueryOptionsWithMode(modeOpts))
  const powensQuery = useQuery(powensStatusQueryOptionsWithMode(modeOpts))

  const sources: SourceEntry[] = [
    {
      name: 'News financières',
      provider: 'EODHD / aggregation',
      status: newsQuery.isError ? 'error' : newsQuery.data ? 'ok' : 'idle',
      lastFetch: newsQuery.dataUpdatedAt ? new Date(newsQuery.dataUpdatedAt).toISOString() : null,
      note: `${newsQuery.data?.items.length ?? 0} signaux en cache`,
    },
    {
      name: 'Marchés & macro',
      provider: 'EODHD / FRED / TwelveData',
      status: marketsQuery.isError ? 'error' : marketsQuery.data ? 'ok' : 'idle',
      lastFetch: marketsQuery.dataUpdatedAt ? new Date(marketsQuery.dataUpdatedAt).toISOString() : null,
      note: marketsQuery.data?.summary.headline ?? 'pas de résumé disponible',
    },
    {
      name: 'Knowledge Graph',
      provider: 'Neo4j + Qdrant',
      status: knowledgeQuery.data?.degraded ? 'degraded' : knowledgeQuery.data ? 'ok' : 'idle',
      lastFetch: knowledgeQuery.data?.lastSuccessfulRebuildAt ?? null,
      note: `${knowledgeQuery.data?.entityCount ?? 0} entités, ${knowledgeQuery.data?.relationCount ?? 0} relations`,
    },
    {
      name: 'Connexions bancaires',
      provider: 'Powens',
      status: powensQuery.isError
        ? 'error'
        : (powensQuery.data?.connections ?? []).some(c => c.status === 'error' || c.status === 'reconnect_required')
          ? 'degraded'
          : powensQuery.data
            ? 'ok'
            : 'idle',
      lastFetch: powensQuery.dataUpdatedAt ? new Date(powensQuery.dataUpdatedAt).toISOString() : null,
      note: `${powensQuery.data?.connections.length ?? 0} connexion(s)`,
    },
  ]

  const toneLookup: Record<string, 'ok' | 'warn' | 'err'> = {
    ok: 'ok',
    degraded: 'warn',
    error: 'err',
    idle: 'warn',
  }

  const anyDegraded = sources.some(s => s.status === 'degraded' || s.status === 'error')

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Données & signaux"
        icon="⊡"
        title="Sources & fraîcheur"
        description="Provenance, fraîcheur et qualité des données qui alimentent le cockpit et l'Advisor IA."
        status={
          <div className="flex items-center gap-2">
            <StatusDot tone={anyDegraded ? 'warn' : 'ok'} size={7} pulse={anyDegraded} />
            <span className="text-xs text-muted-foreground">
              {anyDegraded ? 'Certaines sources sont dégradées' : 'Toutes les sources sont opérationnelles'}
            </span>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {sources.map(src => (
          <Panel
            key={src.name}
            title={src.name}
            tone={src.status === 'ok' ? 'brand' : src.status === 'degraded' ? 'warning' : 'plain'}
            icon={<StatusDot tone={toneLookup[src.status] ?? 'warn'} size={7} />}
            actions={
              <Badge variant={src.status === 'ok' ? 'secondary' : src.status === 'error' ? 'destructive' : 'outline'}>
                {src.status}
              </Badge>
            }
          >
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Provider: <span className="text-foreground">{src.provider}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Dernière récupération:{' '}
                <span className="text-foreground">
                  {src.lastFetch ? new Date(src.lastFetch).toLocaleString('fr-FR') : 'jamais'}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">{src.note}</p>
            </div>
          </Panel>
        ))}
      </div>

      <div className="rounded-xl border border-border/40 bg-surface-1/40 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
          architecture de données
        </p>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          Aucun appel direct aux providers externes n'est fait depuis le frontend. Toutes les données
          transitent par apps/api (backend Bun/Elysia) qui gère le cache, les tokens et la
          normalisation. Le frontend consomme uniquement les endpoints REST/JSON de l'API interne.
        </p>
      </div>
    </div>
  )
}
