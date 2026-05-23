import { Badge, Button } from '@finance-os/ui/components'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import {
  postDashboardInvestmentPlanGenerate,
} from '@/features/dashboard-api'
import {
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
  DashboardInvestmentActionPlan,
  DashboardInvestmentPlanItem,
  DashboardInvestmentPriceFreshness,
  InvestmentBucketKey,
} from '@/features/dashboard-types'
import {
  INVESTMENT_ACTION_LABEL,
  INVESTMENT_BUCKET_LABEL,
  INVESTMENT_RISK_LABEL,
  buildInvestmentAccountSections,
  formatInvestmentConfidence,
  formatInvestmentPct,
  investmentActionVariant,
  investmentFreshnessBadgeLabel,
  investmentFreshnessBadgeTone,
  investmentFreshnessOf,
  investmentListFor,
  toInvestmentNumber,
} from '@/features/investment-strategy-view-model'
import { formatDateTime, formatMoney, toErrorMessage } from '@/lib/format'
import { KpiTile } from '@/components/surfaces/kpi-tile'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { StatusDot } from '@/components/surfaces/status-dot'

export const Route = createFileRoute('/_app/ia/strategie-investissement')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    await Promise.all([
      context.queryClient.ensureQueryData(dashboardInvestmentStrategyQueryOptionsWithMode({ mode })),
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

  const strategyQuery = useQuery(dashboardInvestmentStrategyQueryOptionsWithMode(modeOpts))
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

  const strategy = strategyQuery.data
  const planResponse = planQuery.data
  const plan = planResponse?.plan ?? null
  const topAction = plan?.topAction ?? plan?.items[0] ?? null
  const allocation = plan?.allocation
  const scorecard = scorecardQuery.data?.scorecard ?? planResponse?.calibration ?? null
  const lessons = lessonsQuery.data?.items ?? []
  const hypotheses = hypothesesQuery.data?.items ?? []
  const status = statusQuery.data
  const loading = strategyQuery.isPending || planQuery.isPending
  const error = [
    strategyQuery.error,
    planQuery.error,
    statusQuery.error,
    hypothesesQuery.error,
    scorecardQuery.error,
    lessonsQuery.error,
  ].find(Boolean)

  const accountItems = buildInvestmentAccountSections({
    plan,
    policies: strategy?.accountPolicies ?? [],
  })

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
        <Panel tone="warning" title="Surface degradee" icon={<StatusDot tone="warn" size={8} pulse />}>
          <p className="text-sm text-muted-foreground">{toErrorMessage(error)}</p>
        </Panel>
      ) : null}

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
          hint={scorecard ? `${scorecard.sampleSize} predictions revues` : 'Pas encore assez de donnees'}
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
              label="Graph writes"
              value={`${status?.memory.graphWritesSucceeded ?? 0} ok / ${status?.memory.graphWritesFailed ?? 0} fail`}
            />
            {status?.memory.lastGraphError ? (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                {status.memory.lastGraphError}
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
              value={scorecard ? formatInvestmentConfidence(scorecard.hitRate) : 'insufficient_data'}
            />
            <QualityRow
              label="Brier score"
              value={scorecard?.brierScore === null || scorecard?.brierScore === undefined
                ? 'insufficient_data'
                : scorecard.brierScore.toFixed(3)}
            />
          </div>
          <div className="mt-4 space-y-2">
            {lessons.slice(0, 3).map(lesson => (
              <div key={lesson.id} className="rounded-lg border border-border/50 bg-surface-1 px-3 py-2">
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
                Aucun apprentissage valide encore. Le systeme attend des outcomes revus avant de conclure.
              </p>
            ) : null}
          </div>
        </Panel>
      </section>

      <footer className="rounded-2xl border border-border/50 bg-card/60 px-5 py-3 backdrop-blur-md">
        <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px]">
          <span className="text-muted-foreground/55">
            strategy<span className="mx-1 text-muted-foreground/25">:</span>
            <span className="text-foreground/85">
              {strategy?.strategy.name ?? 'unavailable'}
            </span>
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
        Sans univers approuve, prix frais et contraintes satisfaites, Finance-OS affiche
        insuffisant_data ou watch plutot qu'un faux achat.
      </p>
    </div>
  )
}

function TopAction({ action }: { action: DashboardInvestmentPlanItem }) {
  const freshness = investmentFreshnessOf(action)
  const amount = toInvestmentNumber(action.amountValue)
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Compte" value={action.accountLabel} />
        <Metric label="Actif" value={action.assetName ?? action.symbol ?? 'non defini'} />
        <Metric
          label="Montant"
          value={amount === null ? '-' : formatMoney(amount, action.amountCurrency)}
          financial
        />
        <Metric label="Confiance" value={formatInvestmentConfidence(action.confidence)} />
      </div>
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
              label="Montant"
              value={amount === null ? '-' : formatMoney(amount, item.amountCurrency)}
            />
            <QualityRow label="Allocation" value={`${formatInvestmentPct(item.currentWeightPct)} -> ${formatInvestmentPct(item.targetWeightPct)}`} />
            <QualityRow label="Confiance" value={formatInvestmentConfidence(item.confidence)} />
            <QualityRow label="Risque" value={INVESTMENT_RISK_LABEL[item.riskLevel]} />
            <QualityRow label="Prix" value={freshness?.price ? formatMoney(freshness.price, freshness.currency ?? 'EUR') : '-'} />
            <QualityRow label="Source" value={freshness?.provider ?? 'missing'} />
            <QualityRow label="Fraicheur" value={freshness?.isStale ? 'stale' : freshness?.sourceType ?? 'missing'} />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{item.thesis}</p>
          <EvidenceGrid item={item} />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border/50 bg-surface-1/40 px-3 py-6 text-sm text-muted-foreground">
          Aucun item de plan pour ce compte. Genere un plan apres avoir configure les donnees et l'univers d'actifs.
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
            <div key={bucket.bucketKey} className="rounded-lg border border-border/50 bg-surface-1 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{INVESTMENT_BUCKET_LABEL[bucket.bucketKey]}</p>
                <Badge variant={drift?.severity === 'ok' ? 'positive' : 'warning'}>
                  {drift?.severity ?? 'unknown'}
                </Badge>
              </div>
              <p className="font-financial mt-2 text-lg font-semibold">
                {formatInvestmentPct(actual[bucket.bucketKey])}
                <span className="ml-1 text-xs text-muted-foreground">/ {formatInvestmentPct(bucket.targetPct)}</span>
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
