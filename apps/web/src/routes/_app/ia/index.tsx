import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { getAiAdvisorUiFlags } from '@/features/ai-advisor-config'
import {
  postDashboardAdvisorManualRefreshAndRun,
} from '@/features/dashboard-api'
import {
  dashboardAdvisorAssumptionsQueryOptionsWithMode,
  dashboardAdvisorEvalsQueryOptionsWithMode,
  dashboardAdvisorKnowledgeTopicsQueryOptionsWithMode,
  dashboardAdvisorManualOperationLatestQueryOptionsWithMode,
  dashboardAdvisorQueryOptionsWithMode,
  dashboardAdvisorRecommendationsQueryOptionsWithMode,
  dashboardAdvisorSignalsQueryOptionsWithMode,
  dashboardAdvisorSpendQueryOptionsWithMode,
  dashboardAdvisorRunsQueryOptionsWithMode,
  dashboardQueryKeys,
} from '@/features/dashboard-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { formatDateTime, toErrorMessage } from '@/lib/format'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { StatusDot } from '@/components/surfaces/status-dot'
import { KpiTile } from '@/components/surfaces/kpi-tile'
import { MiniSparkline } from '@/components/ui/d3-sparkline'
import { Badge, Button, Card, CardContent } from '@finance-os/ui/components'

export const Route = createFileRoute('/_app/ia/')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    const advisorFlags = getAiAdvisorUiFlags()
    const advisorVisible = advisorFlags.enabled && (!advisorFlags.adminOnly || mode === 'admin')

    const prefetches: Array<Promise<unknown>> = []

    if (advisorVisible) {
      prefetches.push(
        context.queryClient.ensureQueryData(
          dashboardAdvisorQueryOptionsWithMode({ range: '30d', mode })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorRecommendationsQueryOptionsWithMode({ mode })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorSignalsQueryOptionsWithMode({ mode })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorSpendQueryOptionsWithMode({ mode })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorRunsQueryOptionsWithMode({ mode })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorManualOperationLatestQueryOptionsWithMode({ mode })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorAssumptionsQueryOptionsWithMode({ mode })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorEvalsQueryOptionsWithMode({ mode })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorKnowledgeTopicsQueryOptionsWithMode({ mode })
        ),
      )
    }

    await Promise.all(prefetches)
  },
  component: IaOverviewPage,
})

const readMetricNumber = (
  metrics: Record<string, unknown> | undefined,
  key: string
): number | null => {
  const value = metrics?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const formatPercent = (value: number | null, digits = 1) =>
  value === null ? '-' : `${value.toFixed(digits)}%`

function IaOverviewPage() {
  const queryClient = useQueryClient()
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

  const manualOperationQuery = useQuery({
    ...dashboardAdvisorManualOperationLatestQueryOptionsWithMode(modeOpts),
    refetchInterval: query => {
      const status = query.state.data?.status
      return status === 'queued' || status === 'running' ? 3_000 : false
    },
  })
  const manualOperationActive =
    manualOperationQuery.data?.status === 'queued' || manualOperationQuery.data?.status === 'running'
  const advisorRefetchInterval = manualOperationActive ? 4_000 : false

  const overviewQuery = useQuery({
    ...dashboardAdvisorQueryOptionsWithMode({ range: '30d', ...modeOpts }),
    refetchInterval: advisorRefetchInterval,
  })
  const recommendationsQuery = useQuery({
    ...dashboardAdvisorRecommendationsQueryOptionsWithMode(modeOpts),
    refetchInterval: advisorRefetchInterval,
  })
  const signalsQuery = useQuery({
    ...dashboardAdvisorSignalsQueryOptionsWithMode(modeOpts),
    refetchInterval: advisorRefetchInterval,
  })
  const spendQuery = useQuery({
    ...dashboardAdvisorSpendQueryOptionsWithMode(modeOpts),
    refetchInterval: advisorRefetchInterval,
  })
  const runsQuery = useQuery({
    ...dashboardAdvisorRunsQueryOptionsWithMode(modeOpts),
    refetchInterval: advisorRefetchInterval,
  })
  const assumptionsQuery = useQuery({
    ...dashboardAdvisorAssumptionsQueryOptionsWithMode(modeOpts),
    refetchInterval: advisorRefetchInterval,
  })
  const evalsQuery = useQuery({
    ...dashboardAdvisorEvalsQueryOptionsWithMode(modeOpts),
    refetchInterval: advisorRefetchInterval,
  })

  const manualRefreshAndRunMutation = useMutation({
    mutationFn: postDashboardAdvisorManualRefreshAndRun,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisor('30d') }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorRecommendations(12) }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorSignals(24) }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorSpend() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorRuns(12) }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorManualOperationLatest() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorAssumptions(24) }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorEvals() }),
      ])
    },
  })

  const overview = overviewQuery.data
  const snapshotMetrics = overview?.snapshot?.metrics
  const spendSeries = spendQuery.data?.daily.map(point => point.usd) ?? []
  const recs = recommendationsQuery.data?.items ?? []

  const advisorError = [
    overviewQuery.error,
    recommendationsQuery.error,
    signalsQuery.error,
    spendQuery.error,
    runsQuery.error,
    assumptionsQuery.error,
    evalsQuery.error,
  ].find(Boolean)

  if (!aiAdvisorVisible) {
    const reason = !aiAdvisorFlags.enabled
      ? 'La surface advisor est désactivée par configuration runtime.'
      : 'La surface advisor est réservée à la session admin. Connecte-toi en admin.'
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Advisor IA"
          icon="▣"
          title="Advisor IA"
          description="Conseils digestes sur tes finances personnelles. Les surfaces techniques restent séparées."
        />
        <Card>
          <CardContent className="space-y-2 py-8 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Advisor IA indisponible sur cette session</p>
            <p>{reason}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Advisor IA"
        icon="▣"
        title="Advisor IA"
        description="Brief quotidien et recommandations compréhensibles, nourris par les données sans exposer tout le bruit."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {overview && (
              <Badge variant="outline" className="text-xs">
                Généré le {formatDateTime(overview.generatedAt)}
              </Badge>
            )}
            {isAdmin && (
              <Button
                type="button"
                size="sm"
                onClick={() => manualRefreshAndRunMutation.mutate()}
                disabled={manualRefreshAndRunMutation.isPending || manualOperationActive}
              >
                {manualRefreshAndRunMutation.isPending || manualOperationActive
                  ? 'Mission en cours...'
                  : 'Tout rafraîchir'}
              </Button>
            )}
          </div>
        }
      />

      {advisorError && (
        <Panel
          tone="warning"
          title="Surface dégradée"
          icon={<StatusDot tone="warn" size={8} pulse />}
        >
          <p className="text-sm text-muted-foreground">{toErrorMessage(advisorError)}</p>
        </Panel>
      )}

      {/* ── Quick metrics ── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Cash drag"
          value={readMetricNumber(snapshotMetrics, 'cashDragPct') ?? 0}
          display={formatPercent(readMetricNumber(snapshotMetrics, 'cashDragPct'), 2)}
          tone="brand"
          loading={overviewQuery.isPending}
        />
        <KpiTile
          label="Allocation cash"
          value={readMetricNumber(snapshotMetrics, 'cashAllocationPct') ?? 0}
          display={formatPercent(readMetricNumber(snapshotMetrics, 'cashAllocationPct'))}
          tone="plain"
          loading={overviewQuery.isPending}
        />
        <KpiTile
          label="Retour attendu"
          value={readMetricNumber(snapshotMetrics, 'expectedAnnualReturnPct') ?? 0}
          display={formatPercent(readMetricNumber(snapshotMetrics, 'expectedAnnualReturnPct'))}
          tone="positive"
          loading={overviewQuery.isPending}
        />
        <KpiTile
          label="Diversification"
          value={readMetricNumber(snapshotMetrics, 'diversificationScore') ?? 0}
          display={readMetricNumber(snapshotMetrics, 'diversificationScore')?.toFixed(0) ?? '-'}
          tone="plain"
          loading={overviewQuery.isPending}
        />
      </section>

      {/* ── Daily brief ── */}
      {overview?.brief && (
        <Panel
          title={overview.brief.title}
          tone="brand"
          icon={<span aria-hidden="true">▣</span>}
          actions={
            overview.brief.model ? <Badge variant="outline">{overview.brief.model}</Badge> : null
          }
        >
          <p className="text-sm leading-relaxed text-muted-foreground">{overview.brief.summary}</p>
          {overview.brief.keyFacts && overview.brief.keyFacts.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {overview.brief.keyFacts.slice(0, 5).map((fact: string) => (
                <li key={fact} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">-</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* ── Recommendations ── */}
        <Panel
          title="Recommandations"
          tone="brand"
          icon={<span aria-hidden="true">◎</span>}
          description="Conseils actifs, challengés par le moteur déterministe et la mémoire IA."
        >
          {recs.length > 0 ? (
            <div className="space-y-3">
              {recs.slice(0, 6).map(rec => (
                <div
                  key={rec.id}
                  className="rounded-xl border border-border/60 bg-surface-1/60 p-4 transition-colors hover:bg-surface-1"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{rec.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                        {rec.description}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={
                          rec.riskLevel === 'high'
                            ? 'destructive'
                            : rec.riskLevel === 'medium'
                              ? 'outline'
                              : 'secondary'
                        }
                      >
                        {rec.riskLevel}
                      </Badge>
                      <span className="font-financial text-xs text-primary">
                        {Math.round(rec.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  {rec.evidence.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {rec.evidence.slice(0, 3).map((ev) => (
                        <span
                          key={ev}
                          className="rounded bg-background px-2 py-0.5 text-[11px] text-muted-foreground/70"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune recommandation disponible. Lancez un refresh pour générer le premier brief.
            </p>
          )}
        </Panel>

        {/* ── Quick links + AI spend + status ── */}
        <div className="space-y-4">
          {/* Navigation cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Link
              to="/ia/chat"
              className="group rounded-xl border border-border/60 bg-surface-1/60 p-4 transition-all hover:border-primary/30 hover:bg-surface-1"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-aurora/70">◬ Chat</p>
              <p className="mt-2 text-sm font-medium text-foreground group-hover:text-primary">
                Chat finance
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pose une question sur tes dépenses, ton patrimoine ou tes investissements.
              </p>
            </Link>
            <Link
              to="/ia/memoire"
              className="group rounded-xl border border-border/60 bg-surface-1/60 p-4 transition-all hover:border-primary/30 hover:bg-surface-1"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-aurora/70">[#] Mémoire</p>
              <p className="mt-2 text-sm font-medium text-foreground group-hover:text-primary">
                Mémoire & connaissances
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ce que l'Advisor retient, avec provenance et confiance.
              </p>
            </Link>
          </div>

          {/* AI Spend mini */}
          <Panel
            title="Suivi technique IA"
            tone="plain"
            icon={<span aria-hidden="true">⊘</span>}
            actions={
              isAdmin ? (
                <Link
                  to="/ia/couts"
                  className="text-xs text-primary hover:underline"
                >
                  Détails
                </Link>
              ) : null
            }
          >
            {spendQuery.data ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Dépenses du jour</span>
                  <span className="font-financial text-lg font-semibold">
                    ${spendQuery.data.summary.dailyUsdSpent.toFixed(4)}
                  </span>
                </div>
                {spendSeries.length > 1 && (
                  <MiniSparkline
                    data={spendSeries}
                    width={260}
                    height={36}
                    color="var(--accent-2)"
                  />
                )}
                <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                  <span>Mois: ${spendQuery.data.summary.monthlyUsdSpent.toFixed(4)}</span>
                  <span>{spendQuery.data.daily.length}j de données</span>
                </div>
              </div>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">Aucune donnée de coût.</p>
            )}
          </Panel>

          {/* Evals mini */}
          {evalsQuery.data && evalsQuery.data.cases.length > 0 && (
            <Panel title="Confiance & évals" tone="plain" icon={<span aria-hidden="true">⊙</span>}>
              <div className="space-y-2">
                {evalsQuery.data.cases.slice(0, 3).map(evalCase => (
                  <div
                    key={evalCase.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-background/60 px-3 py-2"
                  >
                    <span className="text-xs text-muted-foreground">{evalCase.description}</span>
                    <Badge
                      variant={evalCase.active ? 'secondary' : 'outline'}
                      className="text-[10px]"
                    >
                      {evalCase.category}
                    </Badge>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Assumptions */}
          {assumptionsQuery.data && assumptionsQuery.data.items.length > 0 && (
            <Panel title="Hypothèses" tone="plain" icon={<span aria-hidden="true">⊿</span>}>
              <ul className="space-y-1.5">
                {assumptionsQuery.data.items.slice(0, 4).map(a => (
                  <li key={a.id} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="text-primary/60">-</span>
                    <span>{a.assumptionKey}: {a.justification}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      {/* Status bar */}
      <footer className="rounded-2xl border border-border/50 bg-card/60 px-5 py-3 backdrop-blur-md">
        <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px]">
          <span className="text-muted-foreground/55">
            status<span className="mx-1 text-muted-foreground/25">:</span>
            <span className="text-foreground/85">{overview?.status ?? 'loading'}</span>
          </span>
          <span className="text-muted-foreground/55">
            source<span className="mx-1 text-muted-foreground/25">:</span>
            <span className="text-foreground/85">{overview?.source ?? '-'}</span>
          </span>
          <span className="text-muted-foreground/55">
            recs<span className="mx-1 text-muted-foreground/25">:</span>
            <span className="text-foreground/85">{recs.length}</span>
          </span>
          <span className="text-muted-foreground/55">
            runs<span className="mx-1 text-muted-foreground/25">:</span>
            <span className="text-foreground/85">{runsQuery.data?.items.length ?? 0}</span>
          </span>
          {isDemo && (
            <span className="text-warning">demo deterministic</span>
          )}
        </div>
      </footer>
    </div>
  )
}
