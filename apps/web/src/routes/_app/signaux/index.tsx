import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { dashboardNewsQueryOptionsWithMode } from '@/features/dashboard-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { signalHealthQueryOptions, signalItemsQueryOptions, signalSourcesQueryOptions, signalRunsQueryOptions } from '@/features/signals-query-options'
import type { SignalItem } from '@/features/signals-api'
import { createScenarioFromSignal } from '@/features/trading-lab-api'
import { Badge } from '@finance-os/ui/components'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { NewsFeed } from '@/components/dashboard/news-feed'

export const Route = createFileRoute('/_app/signaux/')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    await Promise.all([
      context.queryClient.ensureQueryData(dashboardNewsQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(signalHealthQueryOptions()),
      context.queryClient.ensureQueryData(signalSourcesQueryOptions()),
      context.queryClient.ensureQueryData(signalItemsQueryOptions({ limit: 20 })),
      context.queryClient.ensureQueryData(signalRunsQueryOptions()),
    ])
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

  useQuery(signalHealthQueryOptions())
  const sourcesQuery = useQuery(signalSourcesQueryOptions())

  const itemsQuery = useQuery(signalItemsQueryOptions({ limit: 20 }))
  const runsQuery = useQuery(signalRunsQueryOptions())

  const sourceCounts = sourcesQuery.data?.counts ?? { finance: 0, ai_tech: 0 }
  const totalSources = sourceCounts.finance + sourceCounts.ai_tech
  const signalItems = itemsQuery.data?.items ?? []
  const signalTotal = itemsQuery.data?.total ?? 0
  const attentionItems = signalItems.filter(i => i.requiresAttention)
  const lastRun = runsQuery.data?.runs?.[0]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Donnees & signaux"
        icon="⊟"
        title="Signaux"
        description="Hub de donnees et signaux externes. Contexte pour l'IA Advisor et le graphe de connaissances."
      />

      {/* Quick overview strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <QuickStat label="Signaux persistes" value={signalTotal} />
        <QuickStat label="Attention requise" value={attentionItems.length} highlight={attentionItems.length > 0} />
        <QuickStat label="Sources" value={totalSources} />
        <QuickStat label="Finance" value={sourceCounts.finance} />
        <QuickStat label="IA / Tech" value={sourceCounts.ai_tech} />
      </div>

      {/* Last ingestion run */}
      {lastRun && (
        <Panel>
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Derniere ingestion: {lastRun.provider} ({lastRun.runType})</span>
            <span>
              {lastRun.insertedCount} inseres, {lastRun.dedupedCount} dedup, {lastRun.graphIngestedCount} graph
              {lastRun.status === 'success' ? ' — OK' : lastRun.status === 'failed' ? ' — Echec' : ''}
            </span>
            <span>{lastRun.finishedAt ? new Date(lastRun.finishedAt).toLocaleString('fr-FR') : 'en cours'}</span>
          </div>
        </Panel>
      )}

      {/* Attention-needed signals */}
      {attentionItems.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-primary mb-2">Signaux necessitant votre attention</h3>
          <div className="space-y-2">
            {attentionItems.slice(0, 5).map(item => (
              <SignalItemCard key={item.id} item={item} isAdmin={isAdmin} />
            ))}
          </div>
        </div>
      )}

      {/* Navigation to sub-pages */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/signaux/marches" className="block">
          <Panel className="hover:border-primary/30 transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="text-lg">≈</span>
              <div>
                <p className="text-sm font-medium text-text-primary">Marches & macro</p>
                <p className="text-xs text-text-tertiary">Panorama et signaux deterministes</p>
              </div>
            </div>
          </Panel>
        </Link>
        <Link to="/signaux/social" className="block">
          <Panel className="hover:border-primary/30 transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="text-lg">⊕</span>
              <div>
                <p className="text-sm font-medium text-text-primary">Comptes sociaux</p>
                <p className="text-xs text-text-tertiary">{totalSources} compte(s) surveille(s)</p>
              </div>
            </div>
          </Panel>
        </Link>
        {isAdmin && (
          <Link to="/signaux/sources" className="block">
            <Panel className="hover:border-primary/30 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="text-lg">⊡</span>
                <div>
                  <p className="text-sm font-medium text-text-primary">Sources & fraicheur</p>
                  <p className="text-xs text-text-tertiary">Qualite et provenance des donnees</p>
                </div>
              </div>
            </Panel>
          </Link>
        )}
      </div>

      {/* Context note */}
      <div className="rounded-xl border border-border/40 bg-surface-1/40 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-aurora/60">
          role de cette surface
        </p>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          Ces signaux alimentent l'IA Advisor et enrichissent le graphe de connaissances.
          Ils ne sont pas des conseils financiers. Consultez l'IA pour des analyses personnalisees.
        </p>
      </div>

      {/* Recent persisted signal items */}
      {signalItems.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-primary mb-2">Signaux recents ({signalTotal})</h3>
          <div className="space-y-2">
            {signalItems.slice(0, 10).map(item => (
              <SignalItemCard key={item.id} item={item} isAdmin={isAdmin} />
            ))}
          </div>
        </div>
      )}

      {signalItems.length === 0 && isAdmin && (
        <Panel>
          <p className="text-text-secondary text-sm py-4 text-center">
            Aucun signal persiste. Utilisez l'import manuel depuis{' '}
            <Link to="/signaux/social" className="text-primary underline">Comptes sociaux</Link>
            {' '}ou attendez une ingestion automatique.
          </p>
        </Panel>
      )}

      {/* News feed (existing news backbone) */}
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

function QuickStat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <Panel>
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className={`text-lg font-medium font-financial ${highlight ? 'text-warning' : 'text-text-primary'}`}>{value}</p>
    </Panel>
  )
}

function SignalItemCard({ item, isAdmin }: { item: SignalItem; isAdmin: boolean }) {
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: () => createScenarioFromSignal({ signalItemId: item.id }),
    onSuccess: result => {
      setFeedback(`Scénario #${result.scenario.id} créé.`)
      void queryClient.invalidateQueries({ queryKey: ['tradingLab', 'scenarios'] })
    },
    onError: error => {
      setFeedback(`Erreur : ${(error as Error).message.slice(0, 80)}`)
    },
  })

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {item.requiresAttention && (
              <Badge variant="destructive" className="text-[10px] shrink-0">Attention</Badge>
            )}
            <Badge variant="outline" className="text-[10px] shrink-0">{item.signalDomain}</Badge>
            <Badge variant="secondary" className="text-[10px] shrink-0">{item.sourceProvider}</Badge>
          </div>
          <p className="text-sm text-text-primary mt-1 line-clamp-2">{item.title}</p>
          {item.attentionReason && (
            <p className="text-xs text-warning mt-0.5">{item.attentionReason}</p>
          )}
          <div className="flex gap-3 mt-1 text-[10px] text-text-tertiary">
            <span>Relevance {item.relevanceScore}</span>
            <span>Impact {item.impactScore}</span>
            <span>Graph: {item.graphIngestStatus}</span>
            <span>{new Date(item.publishedAt).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>
        {isAdmin ? (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              type="button"
              disabled={mutation.isPending || mutation.isSuccess}
              onClick={() => mutation.mutate()}
              className="rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[10px] font-medium text-violet-300 hover:bg-violet-500/20 disabled:opacity-50"
            >
              {mutation.isPending
                ? 'Création…'
                : mutation.isSuccess
                  ? 'Scénario créé'
                  : 'Créer un scénario papier'}
            </button>
            <Link
              to="/ia/trading-lab"
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Voir Trading Lab →
            </Link>
            {feedback ? (
              <span className="text-[10px] text-muted-foreground">{feedback}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Panel>
  )
}
