import { Badge, Button } from '@finance-os/ui/components'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useDeferredValue, useMemo, useState } from 'react'
import { KpiTile } from '@/components/surfaces/kpi-tile'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { StatusDot } from '@/components/surfaces/status-dot'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import {
  deleteDashboardAdvisorAssetWatchlist,
  patchDashboardAdvisorAssetWatchlist,
  postDashboardAdvisorAssetWatchlist,
  postDashboardInvestmentPlanGenerate,
} from '@/features/dashboard-api'
import {
  dashboardAdvisorAssetsSearchQueryOptionsWithMode,
  dashboardAdvisorAssetWatchlistQueryOptionsWithMode,
  dashboardInvestmentHypothesesQueryOptionsWithMode,
  dashboardInvestmentLessonsQueryOptionsWithMode,
  dashboardInvestmentPlanLatestQueryOptionsWithMode,
  dashboardInvestmentScorecardQueryOptionsWithMode,
  dashboardInvestmentStatusQueryOptionsWithMode,
  dashboardInvestmentStrategyQueryOptionsWithMode,
  dashboardQueryKeys,
} from '@/features/dashboard-query-options'
import type {
  DashboardInvestmentAccountPolicy,
  DashboardInvestmentActionableStep,
  DashboardInvestmentActionPlan,
  DashboardAdvisorAssetSearchResult,
  DashboardAdvisorAssetWatchlistItem,
  DashboardInvestmentPlanItem,
  DashboardInvestmentPriceFreshness,
  InvestmentBucketKey,
  InvestmentUserIntent,
} from '@/features/dashboard-types'
import {
  actionableStepsForPlan,
  activeGraphStatusForPlan,
  avoidItemsForPlan,
  buildInvestmentAccountSections,
  creativeIdeasForPlan,
  dataGapItemsForPlan,
  formatInvestmentConfidence,
  formatInvestmentPct,
  INVESTMENT_ACTION_LABEL,
  INVESTMENT_BUCKET_LABEL,
  INVESTMENT_RISK_LABEL,
  investmentActionVariant,
  investmentFreshnessBadgeLabel,
  investmentFreshnessBadgeTone,
  investmentFreshnessOf,
  investmentListFor,
  normalizeInvestmentWarning,
  priceabilityLabel,
  recommendabilityLabel,
  toInvestmentNumber,
  userWatchlistItemsForPlan,
} from '@/features/investment-strategy-view-model'
import { formatDateTime, formatMoney, toErrorMessage } from '@/lib/format'

export const Route = createFileRoute('/_app/ia/strategie-investissement')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    await Promise.all([
      context.queryClient.ensureQueryData(
        dashboardInvestmentStrategyQueryOptionsWithMode({ mode })
      ),
      context.queryClient.ensureQueryData(
        dashboardAdvisorAssetWatchlistQueryOptionsWithMode({ mode })
      ),
      context.queryClient.ensureQueryData(
        dashboardInvestmentPlanLatestQueryOptionsWithMode({ mode })
      ),
      context.queryClient.ensureQueryData(dashboardInvestmentStatusQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(
        dashboardInvestmentHypothesesQueryOptionsWithMode({ mode })
      ),
      context.queryClient.ensureQueryData(
        dashboardInvestmentScorecardQueryOptionsWithMode({ mode })
      ),
      context.queryClient.ensureQueryData(dashboardInvestmentLessonsQueryOptionsWithMode({ mode })),
    ])
  },
  component: InvestmentStrategyPage,
})

function InvestmentStrategyPage() {
  const queryClient = useQueryClient()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const mode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined
  const modeOpts = mode ? { mode } : {}
  const [assetSearch, setAssetSearch] = useState('nvidia')
  const deferredAssetSearch = useDeferredValue(assetSearch.trim())

  const strategyQuery = useQuery(dashboardInvestmentStrategyQueryOptionsWithMode(modeOpts))
  const watchlistQuery = useQuery(dashboardAdvisorAssetWatchlistQueryOptionsWithMode(modeOpts))
  const assetSearchQuery = useQuery(
    dashboardAdvisorAssetsSearchQueryOptionsWithMode({
      ...modeOpts,
      query: deferredAssetSearch,
    })
  )
  const planQuery = useQuery(dashboardInvestmentPlanLatestQueryOptionsWithMode(modeOpts))
  const statusQuery = useQuery(dashboardInvestmentStatusQueryOptionsWithMode(modeOpts))
  const hypothesesQuery = useQuery(dashboardInvestmentHypothesesQueryOptionsWithMode(modeOpts))
  const scorecardQuery = useQuery(dashboardInvestmentScorecardQueryOptionsWithMode(modeOpts))
  const lessonsQuery = useQuery(dashboardInvestmentLessonsQueryOptionsWithMode(modeOpts))

  const generateMutation = useMutation({
    mutationFn: () => postDashboardInvestmentPlanGenerate(false),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentPlanLatest() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentStatus() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentHypotheses() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentScorecard() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentLessons() }),
      ])
    },
  })

  const addWatchlistMutation = useMutation({
    mutationFn: (input: {
      asset: DashboardAdvisorAssetSearchResult
      intent: InvestmentUserIntent
      level: 'watching' | 'interested' | 'high_interest'
    }) =>
      postDashboardAdvisorAssetWatchlist({
        symbol: input.asset.symbol,
        name: input.asset.name,
        assetClass: input.asset.assetClass,
        providerSymbols: input.asset.providerSymbols,
        iconUrl: input.asset.iconUrl,
        logoUrl: input.asset.logoUrl,
        isin: input.asset.isin,
        exchange: input.asset.exchange,
        currency: input.asset.currency,
        userIntent: input.intent,
        userInterestLevel: input.level,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorAssetWatchlist() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentStrategy() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentPlanLatest() }),
      ])
    },
  })

  const updateWatchlistMutation = useMutation({
    mutationFn: (input: {
      item: DashboardAdvisorAssetWatchlistItem
      intent: InvestmentUserIntent
      level: 'watching' | 'interested' | 'high_interest'
    }) =>
      patchDashboardAdvisorAssetWatchlist({
        id: input.item.id,
        input: {
          userIntent: input.intent,
          userInterestLevel: input.level,
        },
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorAssetWatchlist() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentStrategy() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentPlanLatest() }),
      ])
    },
  })

  const removeWatchlistMutation = useMutation({
    mutationFn: (id: number) => deleteDashboardAdvisorAssetWatchlist(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorAssetWatchlist() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentStrategy() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentPlanLatest() }),
      ])
    },
  })

  const strategy = strategyQuery.data
  const planResponse = planQuery.data
  const plan = planResponse?.plan ?? null
  const topAction = plan?.topAction ?? plan?.items[0] ?? null
  const allocation = plan?.allocation
  const actionableSteps = actionableStepsForPlan(plan)
  const graphStatus = activeGraphStatusForPlan({
    plan,
    ...(statusQuery.data ? { status: statusQuery.data } : {}),
  })
  const noBuyToday = Boolean(plan?.items.every(item => item.action !== 'buy'))
  const scorecard = scorecardQuery.data?.scorecard ?? planResponse?.calibration ?? null
  const lessons = lessonsQuery.data?.items ?? []
  const hypotheses = hypothesesQuery.data?.items ?? []
  const loading = strategyQuery.isPending || planQuery.isPending
  const error = [
    strategyQuery.error,
    planQuery.error,
    statusQuery.error,
    hypothesesQuery.error,
    scorecardQuery.error,
    lessonsQuery.error,
    watchlistQuery.error,
  ].find(Boolean)

  const accountItems = buildInvestmentAccountSections({
    plan,
    policies: strategy?.accountPolicies ?? [],
  })
  const creativeIdeas = creativeIdeasForPlan(plan)
  const userWatchlistItems = userWatchlistItemsForPlan(plan)
  const avoidItems = avoidItemsForPlan(plan)
  const dataGapItems = dataGapItemsForPlan(plan)
  const watchedBySymbol = useMemo(() => {
    const map = new Map<string, DashboardAdvisorAssetWatchlistItem>()
    for (const item of watchlistQuery.data?.items ?? []) {
      map.set(item.normalizedSymbol, item)
    }
    return map
  }, [watchlistQuery.data?.items])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Advisor IA"
        icon="AI"
        title="Plan d'action investissement"
        description="Une lecture account-aware de ce qui est faisable maintenant, avec prix, fraicheur, contraintes et validation humaine obligatoire."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isDemo ? <Badge variant="warning">demo deterministe</Badge> : null}
            <Badge variant="outline">aucun auto-trading</Badge>
            {isAdmin ? (
              <Button
                type="button"
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? 'Generation...' : 'Generer maintenant'}
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <Panel
          tone="warning"
          title="Surface degradee"
          icon={<StatusDot tone="warn" size={8} pulse />}
        >
          <p className="text-sm text-muted-foreground">{toErrorMessage(error)}</p>
        </Panel>
      ) : null}

      <Panel
        title="Ce que tu dois faire maintenant"
        description="Plan concret, meme quand aucun achat n'est autorise."
        tone={noBuyToday ? 'warning' : 'positive'}
        icon={<StatusDot tone={noBuyToday ? 'warn' : 'ok'} size={9} />}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="rounded-lg border border-border/50 bg-surface-1 px-4 py-4">
            <p className="text-sm font-semibold">
              {noBuyToday
                ? "Ne passe aucun ordre aujourd'hui."
                : 'Ordre possible sous validation humaine.'}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Les achats restent bloques si prix, eligibility, compatibilite compte ou cap de poche
              ne sont pas satisfaits. Les apports restent planifiables sans ordre.
            </p>
          </div>
          <ActionableStepList steps={actionableSteps} loading={loading} />
        </div>
      </Panel>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Core"
          value={allocation?.corePct ?? 0}
          display={`${formatInvestmentPct(allocation?.corePct)} / 60%`}
          tone="brand"
          loading={loading}
          hint="Base patrimoniale long terme"
        />
        <KpiTile
          label="Growth"
          value={allocation?.growthPct ?? 0}
          display={`${formatInvestmentPct(allocation?.growthPct)} / 30%`}
          tone="violet"
          loading={loading}
          hint="Croissance maitrisee"
        />
        <KpiTile
          label="Asymmetric"
          value={allocation?.asymmetricPct ?? 0}
          display={`${formatInvestmentPct(allocation?.asymmetricPct)} / 10%`}
          tone={allocation && allocation.asymmetricPct > 10 ? 'warning' : 'positive'}
          loading={loading}
          hint="Crypto et risques asymetriques"
        />
        <KpiTile
          label="Fiabilite IA"
          value={scorecard?.hitRate ?? 0}
          display={scorecard ? formatInvestmentConfidence(scorecard.hitRate) : '-'}
          tone="plain"
          loading={scorecardQuery.isPending}
          hint={
            scorecard ? `${scorecard.sampleSize} predictions revues` : 'Pas encore assez de donnees'
          }
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Panel
          title="Action recommandee maintenant"
          description="Le meilleur prochain geste utile. S'il n'est pas sur, le systeme doit attendre."
          tone={topAction?.action === 'buy' ? 'positive' : 'warning'}
          icon={<StatusDot tone={topAction?.action === 'buy' ? 'ok' : 'warn'} size={9} />}
          actions={
            topAction ? (
              <Badge variant={investmentActionVariant(topAction.action)}>
                {INVESTMENT_ACTION_LABEL[topAction.action] ?? topAction.action}
              </Badge>
            ) : null
          }
        >
          {topAction ? <TopAction action={topAction} /> : <EmptyPlan loading={loading} />}
        </Panel>

        <Panel
          title="Qualite des donnees"
          description="Prix, providers, graph et stale data baissent la confiance."
          tone={plan?.dataQualityStatus === 'ready' ? 'positive' : 'warning'}
          icon={<StatusDot tone={plan?.dataQualityStatus === 'ready' ? 'ok' : 'warn'} size={8} />}
        >
          <div className="space-y-3">
            <QualityRow label="Plan" value={plan?.dataQualityStatus ?? 'absent'} />
            <QualityRow
              label="Prix manquants"
              value={allocation?.dataQuality.missingPriceSymbols.join(', ') || 'aucun'}
            />
            <QualityRow
              label="Prix stale"
              value={allocation?.dataQuality.stalePriceSymbols.join(', ') || 'aucun'}
            />
            <QualityRow
              label="Memoire graph"
              value={
                graphStatus.lastRun.failed === 0
                  ? `OK - ${graphStatus.lastRun.succeeded} evenements dernier run`
                  : `Dernier run : ${graphStatus.lastRun.succeeded} ok / ${graphStatus.lastRun.failed} fail`
              }
            />
            {graphStatus.resolvedHistoricalFailures > 0 ? (
              <QualityRow
                label="Historique"
                value={`${graphStatus.resolvedHistoricalFailures} anciens echecs resolus`}
              />
            ) : null}
            {graphStatus.lastRun.failed > 0 && graphStatus.lastRun.lastError ? (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                {normalizeInvestmentWarning(graphStatus.lastRun.lastError)}
              </p>
            ) : null}
          </div>
        </Panel>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary/70">
              Comptes
            </p>
            <h2 className="mt-1 text-xl font-semibold">Recommandation par compte</h2>
          </div>
          <Badge variant="outline">a valider manuellement</Badge>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {accountItems.map(({ label, item, policy }) => (
            <AccountRecommendation key={label} label={label} item={item} policy={policy} />
          ))}
        </div>
      </section>

      <AssetUniversePanel
        query={assetSearch}
        onQueryChange={setAssetSearch}
        results={assetSearchQuery.data?.items ?? []}
        watchedBySymbol={watchedBySymbol}
        watchlist={watchlistQuery.data?.items ?? []}
        isAdmin={isAdmin}
        isPending={
          addWatchlistMutation.isPending ||
          updateWatchlistMutation.isPending ||
          removeWatchlistMutation.isPending
        }
        onAdd={(asset, intent, level) => addWatchlistMutation.mutate({ asset, intent, level })}
        onUpdate={(item, intent, level) =>
          updateWatchlistMutation.mutate({ item, intent, level })
        }
        onRemove={id => removeWatchlistMutation.mutate(id)}
      />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <PlanItemCollection
          title="Idees audacieuses"
          description="Speculatif et separe du plan principal. Petite taille seulement si les caps restent OK."
          empty="Aucune idee speculative exploitable dans le plan courant."
          items={creativeIdeas}
          tone="violet"
        />
        <PlanItemCollection
          title="Watchlist utilisateur"
          description="Ces actifs sont surveilles, pas forces en haut du ranking."
          empty="Aucun actif utilisateur dans le plan courant."
          items={userWatchlistItems}
          tone="brand"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <PlanItemCollection
          title="A eviter"
          description="Actifs exclus ou incompatibles avec le compte, le prix ou la politique de risque."
          empty="Aucun actif explicitement classe a eviter."
          items={avoidItems}
          tone="warning"
        />
        <PlanItemCollection
          title="Donnees a resoudre"
          description="Prix, eligibility PEA ou source provider qui bloquent encore une action maintenant."
          empty="Aucune donnee bloquante supplementaire."
          items={dataGapItems}
          tone="plain"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Panel
          title="Strategie 60 / 30 / 10"
          description="Allocation cible et derive. Les apports corrigent d'abord les desequilibres."
          tone="brand"
          icon={<span aria-hidden="true">60</span>}
        >
          <StrategySplit buckets={strategy?.buckets ?? []} plan={plan} />
        </Panel>

        <Panel
          title="Hypotheses & apprentissage"
          description="Les recommandations importantes deviennent testables puis sont revues a J+1, J+7 et J+30."
          tone="violet"
          icon={<span aria-hidden="true">#</span>}
        >
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <QualityRow label="Hypotheses ouvertes/due" value={String(hypotheses.length)} />
            <QualityRow
              label="Hit rate"
              value={
                scorecard ? formatInvestmentConfidence(scorecard.hitRate) : 'insufficient_data'
              }
            />
            <QualityRow
              label="Brier score"
              value={
                scorecard?.brierScore === null || scorecard?.brierScore === undefined
                  ? 'insufficient_data'
                  : scorecard.brierScore.toFixed(3)
              }
            />
          </div>
          <div className="mt-4 space-y-2">
            {lessons.slice(0, 3).map(lesson => (
              <div
                key={lesson.id}
                className="rounded-lg border border-border/50 bg-surface-1 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{lesson.title}</p>
                  <Badge variant={lesson.status === 'approved' ? 'positive' : 'outline'}>
                    {lesson.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {lesson.description}
                </p>
              </div>
            ))}
            {lessons.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/50 bg-surface-1/40 px-3 py-4 text-sm text-muted-foreground">
                Aucun apprentissage valide encore. Le systeme attend des outcomes revus avant de
                conclure.
              </p>
            ) : null}
          </div>
        </Panel>
      </section>

      <footer className="rounded-2xl border border-border/50 bg-card/60 px-5 py-3 backdrop-blur-md">
        <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px]">
          <span className="text-muted-foreground/55">
            strategy<span className="mx-1 text-muted-foreground/25">:</span>
            <span className="text-foreground/85">{strategy?.strategy.name ?? 'unavailable'}</span>
          </span>
          <span className="text-muted-foreground/55">
            generated<span className="mx-1 text-muted-foreground/25">:</span>
            <span className="text-foreground/85">{formatDateTime(plan?.generatedAt ?? null)}</span>
          </span>
          <span className="text-muted-foreground/55">
            source<span className="mx-1 text-muted-foreground/25">:</span>
            <span className="text-foreground/85">{planResponse?.source ?? '-'}</span>
          </span>
          <span className="text-muted-foreground/55">
            no_auto_trade<span className="mx-1 text-muted-foreground/25">:</span>
            <span className="text-foreground/85">{String(plan?.noAutoTrade ?? true)}</span>
          </span>
        </div>
      </footer>
    </div>
  )
}

function EmptyPlan({ loading }: { loading: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border/50 bg-surface-1/40 px-4 py-8 text-center">
      <p className="text-sm font-semibold">
        {loading ? 'Chargement du plan...' : 'Aucun plan actif'}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
        Sans prix frais, compte compatible et contraintes satisfaites, Finance-OS affiche watch ou
        insufficient_data plutot qu'un faux achat.
      </p>
    </div>
  )
}

function AssetUniversePanel({
  query,
  onQueryChange,
  results,
  watchedBySymbol,
  watchlist,
  isAdmin,
  isPending,
  onAdd,
  onUpdate,
  onRemove,
}: {
  query: string
  onQueryChange: (value: string) => void
  results: DashboardAdvisorAssetSearchResult[]
  watchedBySymbol: Map<string, DashboardAdvisorAssetWatchlistItem>
  watchlist: DashboardAdvisorAssetWatchlistItem[]
  isAdmin: boolean
  isPending: boolean
  onAdd: (
    asset: DashboardAdvisorAssetSearchResult,
    intent: InvestmentUserIntent,
    level: 'watching' | 'interested' | 'high_interest'
  ) => void
  onUpdate: (
    item: DashboardAdvisorAssetWatchlistItem,
    intent: InvestmentUserIntent,
    level: 'watching' | 'interested' | 'high_interest'
  ) => void
  onRemove: (id: number) => void
}) {
  const groups = useMemo(() => {
    const entries = new Map<string, DashboardAdvisorAssetSearchResult[]>()
    for (const item of results) {
      const label =
        item.assetClass.includes('crypto')
          ? 'Crypto'
          : item.assetClass.includes('etf') || item.assetClass.includes('fund')
            ? 'ETF / fonds'
            : item.assetClass.includes('index')
              ? 'Indices'
              : 'Actions'
      entries.set(label, [...(entries.get(label) ?? []), item])
    }
    return [...entries.entries()]
  }, [results])

  return (
    <Panel
      title="Univers & Watchlist"
      description="Recherche locale enrichie par l'univers connu, les prix disponibles et les actifs suivis."
      tone="brand"
      icon={<StatusDot tone="brand" size={8} />}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-border/50 bg-surface-1 px-3 py-3">
            <label
              htmlFor="advisor-asset-search-input"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Ajouter un actif a surveiller
            </label>
            <input
              id="advisor-asset-search-input"
              value={query}
              onChange={event => onQueryChange(event.target.value)}
              placeholder="nvidia, bitcoin, msci world, amundi pea, air liquide"
              className="mt-2 h-11 w-full rounded-lg border border-border/60 bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Cet actif sera surveille par l IA, mais ne sera pas forcement recommande. L Advisor le
              comparera aux autres opportunites selon le risque, la strategie et les donnees
              disponibles.
            </p>
          </div>

          <div className="space-y-4">
            {groups.length > 0 ? (
              groups.map(([label, items]) => (
                <div key={label} className="space-y-2">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {label}
                  </p>
                  <div className="grid gap-2">
                    {items.map(asset => {
                      const watched = watchedBySymbol.get(asset.symbol) ?? null
                      return (
                        <AssetSearchRow
                          key={`${asset.symbol}-${asset.assetClass}`}
                          asset={asset}
                          watched={watched}
                          isAdmin={isAdmin}
                          isPending={isPending}
                          onAdd={onAdd}
                          onUpdate={onUpdate}
                        />
                      )
                    })}
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-border/50 bg-surface-1/40 px-3 py-5 text-sm text-muted-foreground">
                Tape un nom, ticker ou ISIN pour voir les actifs connus localement.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Watchlist active
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Un signal d interet change le ranking, sans annuler les penalites de risque.
            </p>
          </div>
          {watchlist.length > 0 ? (
            <div className="grid gap-2">
              {watchlist.map(item => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border/50 bg-surface-1 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <AssetIdentity symbol={item.symbol} name={item.name} assetClass={item.assetClass} />
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => onRemove(item.id)}
                      disabled={!isAdmin || isPending}
                    >
                      Retirer
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{item.userIntent}</Badge>
                    <Badge variant="outline">{item.userInterestLevel}</Badge>
                    <Badge variant="outline">{item.currency}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border/50 bg-surface-1/40 px-3 py-5 text-sm text-muted-foreground">
              Aucun actif suivi. Ajoute une idee pour que l Advisor la surveille dans les prochains
              plans.
            </p>
          )}
        </div>
      </div>
    </Panel>
  )
}

function AssetSearchRow({
  asset,
  watched,
  isAdmin,
  isPending,
  onAdd,
  onUpdate,
}: {
  asset: DashboardAdvisorAssetSearchResult
  watched: DashboardAdvisorAssetWatchlistItem | null
  isAdmin: boolean
  isPending: boolean
  onAdd: (
    asset: DashboardAdvisorAssetSearchResult,
    intent: InvestmentUserIntent,
    level: 'watching' | 'interested' | 'high_interest'
  ) => void
  onUpdate: (
    item: DashboardAdvisorAssetWatchlistItem,
    intent: InvestmentUserIntent,
    level: 'watching' | 'interested' | 'high_interest'
  ) => void
}) {
  const updateOrAdd = (intent: InvestmentUserIntent, level: 'watching' | 'interested' | 'high_interest') => {
    if (watched) {
      onUpdate(watched, intent, level)
      return
    }
    onAdd(asset, intent, level)
  }
  return (
    <div className="rounded-lg border border-border/50 bg-surface-1 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AssetIdentity symbol={asset.symbol} name={asset.name} assetClass={asset.assetClass} />
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={asset.priceability === 'priceable' ? 'positive' : 'warning'}>
            {priceabilityLabel(asset.priceability)}
          </Badge>
          <Badge variant="outline">{INVESTMENT_BUCKET_LABEL[asset.suggestedBucket]}</Badge>
          <Badge variant="outline">risque {INVESTMENT_RISK_LABEL[asset.riskLevel]}</Badge>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <QualityRow label="PEA" value={asset.eligibilityByAccount.pea} />
        <QualityRow label="IBKR" value={asset.eligibilityByAccount.brokerage} />
        <QualityRow label="Binance" value={asset.eligibilityByAccount.crypto} />
        <QualityRow
          label="Prix"
          value={
            asset.lastPrice === null
              ? 'non relie'
              : formatMoney(asset.lastPrice, asset.lastPriceCurrency ?? asset.currency)
          }
        />
      </div>
      {asset.warnings.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {asset.warnings.slice(0, 3).map(warning => (
            <Badge key={warning} variant="warning">
              {normalizeInvestmentWarning(warning)}
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="xs"
          variant={watched ? 'secondary' : 'outline'}
          disabled={!isAdmin || isPending}
          onClick={() => updateOrAdd('watch', 'watching')}
        >
          Surveiller
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={!isAdmin || isPending}
          onClick={() => updateOrAdd('analyze', 'high_interest')}
        >
          Interet eleve
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={!isAdmin || isPending}
          onClick={() => updateOrAdd('compare', 'interested')}
        >
          Comparer
        </Button>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={!isAdmin || isPending}
          onClick={() => updateOrAdd('exclude', 'watching')}
        >
          Exclure
        </Button>
      </div>
    </div>
  )
}

function AssetIdentity({
  symbol,
  name,
  assetClass,
}: {
  symbol: string
  name: string
  assetClass: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background font-mono text-xs font-semibold">
        {symbol.slice(0, 3)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {symbol} · {assetClass}
        </p>
      </div>
    </div>
  )
}

function PlanItemCollection({
  title,
  description,
  empty,
  items,
  tone,
}: {
  title: string
  description: string
  empty: string
  items: DashboardInvestmentPlanItem[]
  tone: 'brand' | 'violet' | 'warning' | 'plain'
}) {
  return (
    <Panel
      title={title}
      description={description}
      tone={tone}
      icon={<StatusDot tone={tone === 'warning' ? 'warn' : tone === 'plain' ? 'idle' : 'brand'} size={8} />}
    >
      {items.length > 0 ? (
        <div className="grid gap-3">
          {items.slice(0, 5).map(item => (
            <CompactPlanItem key={`${title}-${item.accountLabel}-${item.symbol}`} item={item} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border/50 bg-surface-1/40 px-3 py-5 text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </Panel>
  )
}

function CompactPlanItem({ item }: { item: DashboardInvestmentPlanItem }) {
  const freshness = investmentFreshnessOf(item)
  const amount = toInvestmentNumber(item.amountValue)
  return (
    <div className="rounded-lg border border-border/50 bg-surface-1 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AssetIdentity
          symbol={item.symbol ?? item.bucket}
          name={item.assetName ?? item.symbol ?? INVESTMENT_BUCKET_LABEL[item.bucket]}
          assetClass={item.recommendationTier ?? item.bucket}
        />
        <Badge variant={investmentActionVariant(item.action)}>
          {INVESTMENT_ACTION_LABEL[item.action] ?? item.action}
        </Badge>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.thesis}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="outline">{recommendabilityLabel(item.recommendabilityStatus)}</Badge>
        <Badge variant="outline">{item.recommendationMode ?? 'watch'}</Badge>
        <Badge variant="outline">risque {INVESTMENT_RISK_LABEL[item.riskLevel]}</Badge>
        <FreshnessBadge freshness={freshness} />
        {amount !== null ? (
          <Badge variant="warning">{formatMoney(amount, item.amountCurrency)}</Badge>
        ) : null}
      </div>
    </div>
  )
}

function ActionableStepList({
  steps,
  loading,
}: {
  steps: DashboardInvestmentActionableStep[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border/50 bg-surface-1 px-4 py-4 text-sm text-muted-foreground">
        Chargement des actions...
      </div>
    )
  }
  if (steps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/50 bg-surface-1/40 px-4 py-4 text-sm text-muted-foreground">
        Aucun geste actionnable tant que le plan n'est pas genere.
      </div>
    )
  }
  return (
    <div className="grid gap-2">
      {steps.map((step, index) => (
        <div
          key={`${step.type}-${step.bucket ?? 'global'}-${step.accountLabel ?? 'all'}-${index}`}
          className="rounded-lg border border-border/50 bg-surface-1 px-3 py-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-semibold">{step.message}</p>
            <Badge variant={step.priority === 'high' ? 'warning' : 'outline'}>
              {step.priority}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.reason}</p>
          {step.blockingReasons && step.blockingReasons.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {step.blockingReasons.slice(0, 3).map(reason => (
                <Badge key={reason} variant="outline">
                  {normalizeInvestmentWarning(reason)}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function TopAction({ action }: { action: DashboardInvestmentPlanItem }) {
  const freshness = investmentFreshnessOf(action)
  const amount = toInvestmentNumber(action.amountValue)
  const contributionAmount = toInvestmentNumber(action.recommendedContributionAmount)
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Compte" value={action.accountLabel} />
        <Metric label="Actif" value={action.assetName ?? action.symbol ?? 'non defini'} />
        <Metric
          label="Montant d'ordre"
          value={amount === null ? 'aucun' : formatMoney(amount, action.amountCurrency)}
          financial
        />
        <Metric
          label="Apport a orienter"
          value={
            contributionAmount === null
              ? 'non prioritaire'
              : formatMoney(contributionAmount, action.amountCurrency)
          }
          financial
        />
      </div>
      <Metric label="Confiance" value={formatInvestmentConfidence(action.confidence)} />
      <p className="text-sm leading-relaxed text-muted-foreground">{action.thesis}</p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{INVESTMENT_BUCKET_LABEL[action.bucket]}</Badge>
        <Badge variant="outline">risque {INVESTMENT_RISK_LABEL[action.riskLevel]}</Badge>
        <Badge variant="warning">a valider manuellement</Badge>
        <Badge variant="outline">auto-trade: non</Badge>
        <FreshnessBadge freshness={freshness} />
      </div>
      <EvidenceGrid item={action} />
    </div>
  )
}

function AccountRecommendation({
  label,
  item,
  policy,
}: {
  label: string
  item: DashboardInvestmentPlanItem | null
  policy: DashboardInvestmentAccountPolicy | null
}) {
  const freshness = item ? investmentFreshnessOf(item) : null
  const amount = item ? toInvestmentNumber(item.amountValue) : null
  const contributionAmount = item ? toInvestmentNumber(item.recommendedContributionAmount) : null
  return (
    <Panel
      title={label}
      description={policy?.humanReadablePolicy ?? 'Politique de compte non configuree.'}
      tone={item?.action === 'buy' ? 'positive' : item ? 'warning' : 'plain'}
      icon={<StatusDot tone={item?.action === 'buy' ? 'ok' : item ? 'warn' : 'idle'} size={8} />}
      actions={
        item ? (
          <Badge variant={investmentActionVariant(item.action)}>
            {INVESTMENT_ACTION_LABEL[item.action] ?? item.action}
          </Badge>
        ) : null
      }
    >
      {item ? (
        <div className="space-y-4">
          <div className="grid gap-2 text-sm">
            <QualityRow label="Poche" value={INVESTMENT_BUCKET_LABEL[item.bucket]} />
            <QualityRow label="Actif" value={item.assetName ?? item.symbol ?? 'non defini'} />
            <QualityRow
              label="Montant d'ordre"
              value={amount === null ? 'aucun' : formatMoney(amount, item.amountCurrency)}
            />
            <QualityRow
              label="Apport a orienter"
              value={
                contributionAmount === null
                  ? 'non prioritaire'
                  : formatMoney(contributionAmount, item.amountCurrency)
              }
            />
            <QualityRow
              label="Allocation"
              value={`${formatInvestmentPct(item.currentWeightPct)} -> ${formatInvestmentPct(item.targetWeightPct)}`}
            />
            <QualityRow label="Confiance" value={formatInvestmentConfidence(item.confidence)} />
            <QualityRow label="Risque" value={INVESTMENT_RISK_LABEL[item.riskLevel]} />
            <QualityRow
              label="Prix"
              value={
                freshness?.price
                  ? formatMoney(freshness.price, freshness.currency ?? 'EUR')
                  : 'prix non relie'
              }
            />
            <QualityRow label="Source" value={freshness?.provider ?? 'missing'} />
            <QualityRow
              label="Fraicheur"
              value={freshness?.isStale ? 'stale' : (freshness?.sourceType ?? 'missing')}
            />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{item.thesis}</p>
          <EvidenceGrid item={item} />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border/50 bg-surface-1/40 px-3 py-6 text-sm text-muted-foreground">
          Aucun item de plan pour ce compte. Genere un plan apres avoir configure les donnees et
          l'univers d'actifs.
        </p>
      )}
    </Panel>
  )
}

function StrategySplit({
  buckets,
  plan,
}: {
  buckets: Array<{ bucketKey: InvestmentBucketKey; targetPct: number; description: string }>
  plan: DashboardInvestmentActionPlan | null
}) {
  const allocation = plan?.allocation
  const actual: Record<InvestmentBucketKey, number | null | undefined> = {
    core: allocation?.corePct,
    growth: allocation?.growthPct,
    asymmetric: allocation?.asymmetricPct,
  }
  return (
    <div className="space-y-5">
      <div className="grid h-12 overflow-hidden rounded-lg border border-border/60 bg-surface-1 sm:grid-cols-[60fr_30fr_10fr]">
        <div className="flex items-center px-3 text-xs font-semibold text-primary">Core 60%</div>
        <div className="flex items-center px-3 text-xs font-semibold text-accent-2">Growth 30%</div>
        <div className="flex items-center px-3 text-xs font-semibold text-warning">Asym 10%</div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {buckets.map(bucket => {
          const drift = allocation?.drift.find(item => item.bucket === bucket.bucketKey)
          return (
            <div
              key={bucket.bucketKey}
              className="rounded-lg border border-border/50 bg-surface-1 px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{INVESTMENT_BUCKET_LABEL[bucket.bucketKey]}</p>
                <Badge variant={drift?.severity === 'ok' ? 'positive' : 'warning'}>
                  {drift?.severity ?? 'unknown'}
                </Badge>
              </div>
              <p className="font-financial mt-2 text-lg font-semibold">
                {formatInvestmentPct(actual[bucket.bucketKey])}
                <span className="ml-1 text-xs text-muted-foreground">
                  / {formatInvestmentPct(bucket.targetPct)}
                </span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {drift?.recommendedAction ?? bucket.description}
              </p>
            </div>
          )
        })}
      </div>
      {plan?.contribution && plan.contribution.length > 0 ? (
        <div className="rounded-lg border border-border/50 bg-surface-1 px-3 py-3">
          <p className="text-sm font-semibold">Prochain apport</p>
          <div className="mt-2 grid gap-2">
            {plan.contribution.map(item => (
              <p key={item.bucket} className="text-sm text-muted-foreground">
                <span className="font-financial text-foreground">
                  {formatMoney(item.amount, item.currency)}
                </span>{' '}
                vers {INVESTMENT_BUCKET_LABEL[item.bucket]} - {item.reason}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EvidenceGrid({ item }: { item: DashboardInvestmentPlanItem }) {
  const forItems = investmentListFor(item, 'for')
  const againstItems = investmentListFor(item, 'against')
  const invalidationItems = investmentListFor(item, 'invalidation')
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <EvidenceList title="Arguments pour" items={forItems} tone="positive" />
      <EvidenceList title="Arguments contre" items={againstItems} tone="warning" />
      <EvidenceList title="Invalidation" items={invalidationItems} tone="plain" />
    </div>
  )
}

function EvidenceList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'positive' | 'warning' | 'plain'
}) {
  const className =
    tone === 'positive'
      ? 'border-positive/30 bg-positive/8'
      : tone === 'warning'
        ? 'border-warning/30 bg-warning/8'
        : 'border-border/50 bg-surface-1'
  return (
    <div className={`rounded-lg border px-3 py-3 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">{title}</p>
      <div className="mt-2 space-y-1.5">
        {items.length > 0 ? (
          items.slice(0, 4).map(item => (
            <p key={item} className="text-xs leading-relaxed text-muted-foreground">
              {item}
            </p>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">Aucun element explicite.</p>
        )}
      </div>
    </div>
  )
}

function QualityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-surface-1 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium text-foreground">{value}</span>
    </div>
  )
}

function Metric({
  label,
  value,
  financial,
}: {
  label: string
  value: string
  financial?: boolean
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-surface-1 px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${financial ? 'font-financial' : ''}`}>{value}</p>
    </div>
  )
}

function FreshnessBadge({ freshness }: { freshness: DashboardInvestmentPriceFreshness | null }) {
  return (
    <Badge variant={investmentFreshnessBadgeTone(freshness)}>
      {investmentFreshnessBadgeLabel(freshness)}
    </Badge>
  )
}
