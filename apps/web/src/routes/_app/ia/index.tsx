import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, CardContent } from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { getAiAdvisorUiFlags } from '@/features/ai-advisor-config'
import { postDashboardAdvisorManualRefreshAndRun } from '@/features/dashboard-api'
import {
  dashboardAdvisorAssumptionsQueryOptionsWithMode,
  dashboardAdvisorEvalsQueryOptionsWithMode,
  dashboardAdvisorKnowledgeTopicsQueryOptionsWithMode,
  dashboardAdvisorManualOperationLatestQueryOptionsWithMode,
  dashboardAdvisorQueryOptionsWithMode,
  dashboardAdvisorRecommendationsQueryOptionsWithMode,
  dashboardAdvisorRunsQueryOptionsWithMode,
  dashboardAdvisorSignalsQueryOptionsWithMode,
  dashboardAdvisorSpendQueryOptionsWithMode,
  dashboardQueryKeys,
} from '@/features/dashboard-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { formatDateTime, toErrorMessage } from '@/lib/format'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { StatusDot } from '@/components/surfaces/status-dot'
import { KpiTile } from '@/components/surfaces/kpi-tile'
import {
  AdvisorAssumptionsPanel,
  AdvisorDecisionJournal,
  AdvisorQuestionStarters,
  AdvisorRecommendationCard,
  type AdvisorQuestionStarter,
} from '@/components/advisor/advisor-decision-ui'

export const Route = createFileRoute('/_app/ia/')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    const advisorFlags = getAiAdvisorUiFlags()
    const advisorVisible = advisorFlags.enabled && (!advisorFlags.adminOnly || mode === 'admin')
    if (!advisorVisible) return

    await Promise.all([
      context.queryClient.ensureQueryData(
        dashboardAdvisorQueryOptionsWithMode({ range: '30d', mode })
      ),
      context.queryClient.ensureQueryData(
        dashboardAdvisorRecommendationsQueryOptionsWithMode({ mode })
      ),
      context.queryClient.ensureQueryData(dashboardAdvisorSignalsQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(dashboardAdvisorSpendQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(dashboardAdvisorRunsQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(
        dashboardAdvisorManualOperationLatestQueryOptionsWithMode({ mode })
      ),
      context.queryClient.ensureQueryData(
        dashboardAdvisorAssumptionsQueryOptionsWithMode({ mode })
      ),
      context.queryClient.ensureQueryData(dashboardAdvisorEvalsQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(
        dashboardAdvisorKnowledgeTopicsQueryOptionsWithMode({ mode })
      ),
    ])
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

const BASE_ADVISOR_QUESTIONS: AdvisorQuestionStarter[] = [
  {
    label: 'Est-ce que je peux investir ce mois-ci ?',
    detail: 'À vérifier avec cashflow, épargne de précaution et horizon.',
    prompt:
      'Est-ce que je peux investir ce mois-ci avec les données Finance-OS disponibles ? Dis-moi aussi ce qui manque.',
    tone: 'brand',
  },
  {
    label: 'Quelles données manquent ?',
    detail: 'Liste les limites avant de suivre une recommandation.',
    prompt: 'Quelles données manquent ou sont trop anciennes pour me conseiller correctement ?',
    tone: 'warning',
  },
  {
    label: 'Mon allocation est-elle trop risquée ?',
    detail: 'Demande une lecture prudente, pas un ordre d’achat.',
    prompt:
      'Analyse mon allocation actuelle, ses risques et les questions à clarifier avant toute décision.',
    tone: 'plain',
  },
  {
    label: 'Explique-moi mon patrimoine simplement',
    detail: 'Transforme les chiffres en lecture actionnable.',
    prompt:
      'Explique-moi mon patrimoine simplement: ce qui est liquide, investi, incertain, et ce que je devrais vérifier.',
    tone: 'plain',
  },
]

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
    manualOperationQuery.data?.status === 'queued' ||
    manualOperationQuery.data?.status === 'running'
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
  const knowledgeTopicsQuery = useQuery({
    ...dashboardAdvisorKnowledgeTopicsQueryOptionsWithMode(modeOpts),
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
  const recs = recommendationsQuery.data?.items ?? []
  const assumptions = assumptionsQuery.data?.items ?? []
  const signals = signalsQuery.data
  const latestRun = overview?.latestRun ?? runsQuery.data?.items[0] ?? null
  const highRiskRecs = recs.filter(rec => rec.riskLevel === 'high')
  const contextualQuestions: AdvisorQuestionStarter[] = recs[0]
    ? [
        {
          label: 'Clarifie la première recommandation',
          detail: recs[0].title,
          prompt: `Explique la recommandation "${recs[0].title}" avec ses hypothèses, ses limites et les données utilisées.`,
          tone: recs[0].riskLevel === 'high' ? 'warning' : 'brand',
        },
      ]
    : []
  const questionStarters = [...BASE_ADVISOR_QUESTIONS, ...contextualQuestions].slice(0, 5)
  const missingItems = [
    ...(overview?.snapshot ? [] : ['Snapshot financier Advisor absent ou pas encore généré.']),
    ...(overview?.status === 'degraded' && overview.degradedMessage ? [overview.degradedMessage] : []),
    ...(recs.length === 0 ? ['Aucune recommandation persistée pour le moment.'] : []),
    ...(assumptions.length === 0 ? ['Aucune hypothèse explicite enregistrée pour l’instant.'] : []),
    ...(signals?.socialSignals.freshnessState === 'stale' ||
    signals?.socialSignals.freshnessState === 'empty'
      ? ['Signaux sociaux absents ou anciens; ils ne doivent pas piloter une décision.']
      : []),
    ...(spendQuery.data?.summary.blocked
      ? ['Budget IA bloqué: l’Advisor doit rester sur les artefacts existants.']
      : []),
    ...(spendQuery.data?.anomalies.map(anomaly => anomaly.message) ?? []),
    ...recs.flatMap(rec => [
      ...rec.blockingFactors,
      ...(rec.challenge?.missingSignals ?? []),
    ]),
  ]

  const advisorError = [
    overviewQuery.error,
    recommendationsQuery.error,
    signalsQuery.error,
    spendQuery.error,
    runsQuery.error,
    assumptionsQuery.error,
    evalsQuery.error,
    knowledgeTopicsQuery.error,
  ].find(Boolean)

  if (!aiAdvisorVisible) {
    const reason = !aiAdvisorFlags.enabled
      ? 'La surface Advisor est désactivée par configuration runtime.'
      : 'La surface Advisor est réservée à la session admin. Connecte-toi en admin.'
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Advisor IA"
          icon="□"
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
        icon="□"
        title="Advisor IA"
        description="Synthèse, recommandations, hypothèses et questions utiles. Pas un terminal de signaux bruts."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {overview ? (
              <Badge variant="outline" className="text-xs">
                Généré le {formatDateTime(overview.generatedAt)}
              </Badge>
            ) : null}
            {isDemo ? <Badge variant="warning">démo déterministe</Badge> : null}
            {isAdmin ? (
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
            ) : null}
          </div>
        }
      />

      {advisorError ? (
        <Panel tone="warning" title="Surface dégradée" icon={<StatusDot tone="warn" size={8} pulse />}>
          <p className="text-sm text-muted-foreground">{toErrorMessage(advisorError)}</p>
        </Panel>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Cash à examiner"
          value={readMetricNumber(snapshotMetrics, 'cashAllocationPct') ?? 0}
          display={formatPercent(readMetricNumber(snapshotMetrics, 'cashAllocationPct'))}
          tone="brand"
          loading={overviewQuery.isPending}
          hint="Part de liquidités dans le snapshot"
        />
        <KpiTile
          label="Friction cash"
          value={readMetricNumber(snapshotMetrics, 'cashDragPct') ?? 0}
          display={formatPercent(readMetricNumber(snapshotMetrics, 'cashDragPct'), 2)}
          tone="warning"
          loading={overviewQuery.isPending}
          hint="Hypothèse, pas certitude"
        />
        <KpiTile
          label="Rendement attendu"
          value={readMetricNumber(snapshotMetrics, 'expectedAnnualReturnPct') ?? 0}
          display={formatPercent(readMetricNumber(snapshotMetrics, 'expectedAnnualReturnPct'))}
          tone="positive"
          loading={overviewQuery.isPending}
          hint="Projection indicative"
        />
        <KpiTile
          label="Diversification"
          value={readMetricNumber(snapshotMetrics, 'diversificationScore') ?? 0}
          display={readMetricNumber(snapshotMetrics, 'diversificationScore')?.toFixed(0) ?? '-'}
          tone="plain"
          loading={overviewQuery.isPending}
          hint="Score du moteur déterministe"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Panel
          title="Synthèse"
          description="Ce que l'Advisor comprend maintenant, sans te demander de lire les signaux bruts."
          tone="brand"
          icon={<span aria-hidden="true">□</span>}
          actions={overview?.brief?.model ? <Badge variant="outline">{overview.brief.model}</Badge> : null}
        >
          {overview?.brief ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{overview.brief.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {overview.brief.summary}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <BriefList title="Ce qui est sain" items={overview.brief.opportunities} tone="positive" />
                <BriefList title="À surveiller" items={overview.brief.risks} tone="warning" />
                <BriefList title="Ce qui a changé" items={overview.brief.keyFacts} tone="plain" />
              </div>
            </div>
          ) : (
            <p className="py-8 text-sm text-muted-foreground">
              Synthèse indisponible pour l'instant. Le cockpit reste utilisable avec les données existantes.
            </p>
          )}
        </Panel>

        <Panel
          title="Attention"
          description="Points à clarifier avant de transformer un conseil en décision."
          icon={<StatusDot tone={missingItems.length > 0 ? 'warn' : 'ok'} size={8} pulse={missingItems.length > 0} />}
          tone={missingItems.length > 0 ? 'warning' : 'positive'}
        >
          <div className="space-y-2">
            {highRiskRecs.length > 0 ? (
              <p className="rounded-xl border border-warning/30 bg-warning/8 px-3 py-2 text-sm text-warning">
                {highRiskRecs.length} recommandation{highRiskRecs.length > 1 ? 's' : ''} à risque élevé.
              </p>
            ) : null}
            {latestRun?.degraded ? (
              <p className="rounded-xl border border-warning/30 bg-warning/8 px-3 py-2 text-sm text-warning">
                Dernier run dégradé: {latestRun.fallbackReason ?? 'raison non précisée'}.
              </p>
            ) : null}
            {missingItems.length > 0 ? (
              missingItems.slice(0, 4).map(item => (
                <p key={item} className="rounded-xl border border-border/45 bg-surface-1/45 px-3 py-2 text-sm text-muted-foreground">
                  {item}
                </p>
              ))
            ) : (
              <p className="rounded-xl border border-border/45 bg-surface-1/45 px-3 py-3 text-sm text-muted-foreground">
                Aucun blocage majeur dans les artefacts actuels. Vérifie tout de même ton horizon et ta tolérance au risque.
              </p>
            )}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <Panel
          title="Conseils & recommandations"
          tone="brand"
          icon={<span aria-hidden="true">◎</span>}
          description="Aide à la décision uniquement: aucune instruction d'achat, aucune exécution."
        >
          {recs.length > 0 ? (
            <div className="space-y-4">
              {recs.slice(0, 5).map(rec => (
                <AdvisorRecommendationCard key={rec.id} recommendation={rec} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/45 bg-surface-1/35 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-foreground">Aucune recommandation disponible</p>
              <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                L'Advisor a besoin d'un run récent ou de données plus complètes. En admin, tu peux relancer la mission.
              </p>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Questions à poser"
            description="Des questions utiles pour clarifier, pas pour déclencher une opération."
            icon={<span aria-hidden="true">?</span>}
            tone="violet"
          >
            <AdvisorQuestionStarters questions={questionStarters} />
          </Panel>

          <Panel
            title="Accès utiles"
            description="Les surfaces techniques restent séparées du conseil quotidien."
            icon={<span aria-hidden="true">→</span>}
            tone="plain"
          >
            <div className="grid gap-2">
              <Link to="/ia/chat" className="rounded-xl border border-border/45 bg-surface-1/45 px-3 py-3 text-sm hover:border-primary/30 hover:bg-surface-1">
                Chat finance
                <span className="mt-1 block text-xs text-muted-foreground">Poser une question sur tes données Finance-OS.</span>
              </Link>
              <Link to="/ia/memoire" className="rounded-xl border border-border/45 bg-surface-1/45 px-3 py-3 text-sm hover:border-primary/30 hover:bg-surface-1">
                Mémoire & connaissances
                <span className="mt-1 block text-xs text-muted-foreground">Voir provenance, confiance et contexte utilisé.</span>
              </Link>
              {isAdmin ? (
                <Link to="/ia/couts" className="rounded-xl border border-border/45 bg-surface-1/45 px-3 py-3 text-sm hover:border-primary/30 hover:bg-surface-1">
                  Coûts IA
                  <span className="mt-1 block text-xs text-muted-foreground">Audit technique, pas une surface de décision.</span>
                </Link>
              ) : null}
            </div>
          </Panel>
        </div>
      </section>

      <AdvisorAssumptionsPanel assumptions={assumptions} missingItems={missingItems} />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <AdvisorDecisionJournal recommendations={recs} />
        <Panel
          title="Garde-fou investissement"
          description="L'Advisor aide à réfléchir. La décision reste manuelle et personnelle."
          icon={<span aria-hidden="true">!</span>}
          tone="warning"
        >
          <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>Pas d'ordre d'achat, de vente, de transfert, de staking ou de rééquilibrage automatique.</p>
            <p>Avant une décision: objectif, horizon, épargne de précaution, expérience, tolérance au risque et besoin de liquidité doivent être clairs.</p>
            <p>Si une donnée manque, baisse la confiance et demande une clarification dans le chat.</p>
          </div>
        </Panel>
      </section>

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
          <span className="text-muted-foreground/55">
            topics<span className="mx-1 text-muted-foreground/25">:</span>
            <span className="text-foreground/85">{knowledgeTopicsQuery.data?.topics.length ?? 0}</span>
          </span>
        </div>
      </footer>
    </div>
  )
}

function BriefList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'positive' | 'warning' | 'plain'
}) {
  const toneClass =
    tone === 'positive'
      ? 'border-positive/30 bg-positive/8'
      : tone === 'warning'
        ? 'border-warning/30 bg-warning/8'
        : 'border-border/45 bg-surface-1/45'

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-foreground">{title}</p>
      <div className="mt-2 space-y-1.5">
        {items.length > 0 ? (
          items.slice(0, 4).map(item => (
            <p key={item} className="text-xs leading-relaxed text-muted-foreground">
              {item}
            </p>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">Aucun élément explicite.</p>
        )}
      </div>
    </div>
  )
}
