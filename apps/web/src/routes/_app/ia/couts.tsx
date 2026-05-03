import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Badge, Card, CardContent } from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { getAiAdvisorUiFlags } from '@/features/ai-advisor-config'
import {
  dashboardAdvisorSpendQueryOptionsWithMode,
  dashboardAdvisorRunsQueryOptionsWithMode,
} from '@/features/dashboard-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { formatDateTime } from '@/lib/format'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { KpiTile } from '@/components/surfaces/kpi-tile'
import { MiniSparkline } from '@/components/ui/d3-sparkline'

export const Route = createFileRoute('/_app/ia/couts')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    const advisorFlags = getAiAdvisorUiFlags()
    const advisorVisible = advisorFlags.enabled && (!advisorFlags.adminOnly || mode === 'admin')
    if (!advisorVisible) return

    await Promise.all([
      context.queryClient.ensureQueryData(dashboardAdvisorSpendQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(dashboardAdvisorRunsQueryOptionsWithMode({ mode })),
    ])
  },
  component: IaCoutsPage,
})

function IaCoutsPage() {
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const aiAdvisorFlags = getAiAdvisorUiFlags()
  const aiAdvisorVisible = aiAdvisorFlags.enabled && (!aiAdvisorFlags.adminOnly || isAdmin)
  const modeOpts = aiAdvisorVisible && authMode ? { mode: authMode } : {}

  const spendQuery = useQuery(dashboardAdvisorSpendQueryOptionsWithMode(modeOpts))
  const runsQuery = useQuery(dashboardAdvisorRunsQueryOptionsWithMode(modeOpts))

  const spendSeries = spendQuery.data?.daily.map(p => p.usd) ?? []
  const runs = runsQuery.data?.items ?? []

  if (!aiAdvisorVisible) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Admin · Coûts IA"
          icon="⊘"
          title="Coûts IA"
          description="Surface technique pour contrôler tokens, modèles et budget de l'Advisor."
        />
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Surface réservée à la session admin.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin · Coûts IA"
        icon="⊘"
        title="Coûts IA"
        description="Suivi détaillé des tokens, modèles et budget de l'Advisor in-app. Séparé de la pipeline agentique de développement."
        actions={
          isDemo ? <Badge variant="warning">démo</Badge> : null
        }
      />

      {/* ── KPI tiles ── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Dépense du jour"
          value={spendQuery.data?.summary.dailyUsdSpent ?? 0}
          display={`$${(spendQuery.data?.summary.dailyUsdSpent ?? 0).toFixed(4)}`}
          tone="brand"
          loading={spendQuery.isPending}
        />
        <KpiTile
          label="Dépense du mois"
          value={spendQuery.data?.summary.monthlyUsdSpent ?? 0}
          display={`$${(spendQuery.data?.summary.monthlyUsdSpent ?? 0).toFixed(4)}`}
          tone="plain"
          loading={spendQuery.isPending}
        />
        <KpiTile
          label="Jours de données"
          value={spendQuery.data?.daily.length ?? 0}
          display={`${spendQuery.data?.daily.length ?? 0}j`}
          tone="plain"
          loading={spendQuery.isPending}
        />
        <KpiTile
          label="Runs advisor"
          value={runs.length}
          display={`${runs.length}`}
          tone="plain"
          loading={runsQuery.isPending}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Spend sparkline ── */}
        <Panel
          title="Dépenses quotidiennes (USD)"
          tone="brand"
          icon={<span aria-hidden="true">⊘</span>}
        >
          {spendSeries.length > 1 ? (
            <div className="space-y-3">
              <MiniSparkline
                data={spendSeries}
                width={480}
                height={80}
                color="var(--primary)"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{spendQuery.data?.daily[0]?.date ?? '-'}</span>
                <span>{spendQuery.data?.daily.at(-1)?.date ?? '-'}</span>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Pas assez de données pour afficher la courbe.
            </p>
          )}
        </Panel>

        {/* ── Budget state ── */}
        <Panel
          title="Budget"
          tone="plain"
          icon={<span aria-hidden="true">⊙</span>}
        >
          {spendQuery.data ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Budget jour</p>
                  <p className="mt-1 font-financial text-lg font-semibold">${spendQuery.data.summary.dailyBudgetUsd.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Budget mois</p>
                  <p className="mt-1 font-financial text-lg font-semibold">${spendQuery.data.summary.monthlyBudgetUsd.toFixed(2)}</p>
                </div>
              </div>
              {spendQuery.data.summary.blocked && (
                <p className="text-sm text-negative">Budget dépassé — certaines fonctions sont bloquées.</p>
              )}
              {spendQuery.data.anomalies.length > 0 && (
                <div className="space-y-1">
                  {spendQuery.data.anomalies.map(a => (
                    <p key={`${a.severity}:${a.message}`} className={`text-xs ${a.severity === 'critical' ? 'text-negative' : 'text-warning'}`}>{a.message}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Pas de données de budget.
            </p>
          )}
        </Panel>
      </div>

      {/* ── Daily breakdown ── */}
      {spendQuery.data && spendQuery.data.daily.length > 0 && (
        <Panel title="Détail quotidien" tone="plain" icon={<span aria-hidden="true">=</span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-left">
                  <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Date</th>
                  <th className="py-2 pr-4 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">USD</th>
                  <th className="py-2 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">EUR</th>
                </tr>
              </thead>
              <tbody>
                {spendQuery.data.daily.slice().reverse().slice(0, 14).map(day => (
                  <tr key={day.date} className="border-b border-border/20">
                    <td className="py-2 pr-4 text-muted-foreground">{day.date}</td>
                    <td className="py-2 pr-4 text-right font-financial">${day.usd.toFixed(4)}</td>
                    <td className="py-2 text-right font-financial">€{day.eur.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* ── Recent runs ── */}
      {runs.length > 0 && (
        <Panel title="Runs récents" tone="plain" icon={<span aria-hidden="true">▷</span>}>
          <div className="space-y-2">
            {runs.slice(0, 8).map(run => (
              <div
                key={run.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/60 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <span className="text-sm text-foreground">#{run.id}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(run.startedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      run.status === 'failed'
                        ? 'destructive'
                        : run.status === 'degraded' || run.status === 'running'
                          ? 'outline'
                          : 'secondary'
                    }
                  >
                    {run.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{run.runType}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Note de séparation ── */}
      <div className="rounded-xl border border-border/40 bg-surface-1/40 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
          note
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Cette surface affiche les coûts de l'Advisor IA financier (modèles LLM pour recommandations,
          chat et knowledge retrieval). La pipeline agentique de développement (Codex, Claude Code, Qwen)
          est suivie séparément dans les fichiers de télémétrie JSONL.
        </p>
      </div>
    </div>
  )
}
