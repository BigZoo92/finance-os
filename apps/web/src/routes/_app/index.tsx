import {
  Amount,
  Badge,
  CurrencyAmount,
  Freshness,
  Progress,
  SegmentedControl,
  Status,
  ValuationState,
} from '@finance-os/ui/components'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { getAiAdvisorUiFlags } from '@/features/ai-advisor-config'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { buildCockpitViewModel } from '@/features/cockpit-view-model'
import {
  dashboardAdvisorRecommendationsQueryOptionsWithMode,
  dashboardSummaryQueryOptionsWithMode,
} from '@/features/dashboard-query-options'
import type { DashboardRange } from '@/features/dashboard-types'
import { financialGoalsQueryOptionsWithMode } from '@/features/goals/query-options'
import { powensStatusQueryOptionsWithMode } from '@/features/powens/query-options'
import type { AttentionItem } from '@/features/trading-lab-api'
import { attentionItemsQueryOptions } from '@/features/trading-lab-query-options'

const searchSchema = z.object({ range: z.enum(['7d', '30d', '90d']).optional() })
const resolveRange = (value: string | undefined): DashboardRange =>
  value === '7d' || value === '90d' ? value : '30d'

export const Route = createFileRoute('/_app/')({
  validateSearch: search => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ range: resolveRange(search.range) }),
  loader: async ({ context, deps }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    const advisorFlags = getAiAdvisorUiFlags()
    const advisorVisible = advisorFlags.enabled && (!advisorFlags.adminOnly || mode === 'admin')
    const prefetches: Array<Promise<unknown>> = [
      context.queryClient.ensureQueryData(
        dashboardSummaryQueryOptionsWithMode({ range: deps.range, mode })
      ),
      context.queryClient.ensureQueryData(financialGoalsQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(powensStatusQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(attentionItemsQueryOptions({ status: 'open' })),
    ]

    if (advisorVisible) {
      prefetches.push(
        context.queryClient.ensureQueryData(
          dashboardAdvisorRecommendationsQueryOptionsWithMode({ mode })
        )
      )
    }
    await Promise.all(prefetches)
  },
  component: CockpitPage,
})

const RANGES: Array<{ label: string; value: DashboardRange }> = [
  { label: '7 j', value: '7d' },
  { label: '30 j', value: '30d' },
  { label: '90 j', value: '90d' },
]

const BREAKDOWN_TONE = {
  available: 'bg-primary',
  savings: 'bg-foreground/45',
  investments: 'bg-warm-accent',
  manual: 'bg-teal',
} as const

function CockpitPage() {
  const { range: searchRange } = Route.useSearch()
  const range = resolveRange(searchRange)
  const navigate = Route.useNavigate()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const authMode: AuthMode | undefined =
    authViewState === 'admin' ? 'admin' : authViewState === 'demo' ? 'demo' : undefined

  const summaryQuery = useQuery(
    dashboardSummaryQueryOptionsWithMode({
      range,
      ...(authMode ? { mode: authMode } : {}),
    })
  )
  const statusQuery = useQuery(powensStatusQueryOptionsWithMode(authMode ? { mode: authMode } : {}))
  const goalsQuery = useQuery(financialGoalsQueryOptionsWithMode({ mode: authMode }))
  const attentionQuery = useQuery(attentionItemsQueryOptions({ status: 'open' }))

  const advisorFlags = getAiAdvisorUiFlags()
  const advisorVisible =
    advisorFlags.enabled && (!advisorFlags.adminOnly || authViewState === 'admin')
  const recommendationsQuery = useQuery({
    ...dashboardAdvisorRecommendationsQueryOptionsWithMode(
      advisorVisible && authMode ? { mode: authMode } : {}
    ),
    enabled: advisorVisible && Boolean(authMode),
  })

  const viewModel = buildCockpitViewModel(summaryQuery.data)
  const activeGoals = (goalsQuery.data?.items ?? []).filter(goal => !goal.archivedAt)
  const connections = statusQuery.data?.connections ?? []
  const connectionFailures = connections.filter(
    connection => connection.status === 'error' || connection.status === 'reconnect_required'
  ).length
  const attentionItems: AttentionItem[] = attentionQuery.data?.items ?? []
  const lowProgressGoals = activeGoals.filter(
    goal => goal.targetAmount > 0 && goal.currentAmount / goal.targetAmount < 0.25
  ).length
  const highRiskRecommendations = (recommendationsQuery.data?.items ?? []).filter(
    recommendation => recommendation.riskLevel === 'high'
  ).length
  const attentionTotal =
    attentionItems.length + connectionFailures + lowProgressGoals + highRiskRecommendations

  const staleSummary = summaryQuery.isError && summaryQuery.data !== undefined
  const summaryUnavailable = summaryQuery.isError && summaryQuery.data === undefined
  const knownBreakdowns = viewModel.breakdowns.filter(
    breakdown => breakdown.value !== null && breakdown.value > 0
  )
  const breakdownTotal = knownBreakdowns.reduce((sum, breakdown) => sum + (breakdown.value ?? 0), 0)
  const savings = viewModel.breakdowns.find(breakdown => breakdown.key === 'savings')
  const investments = viewModel.breakdowns.find(breakdown => breakdown.key === 'investments')
  const available = viewModel.breakdowns.find(breakdown => breakdown.key === 'available')

  return (
    <div className="space-y-9 md:space-y-11">
      <PageHeader
        title="Cockpit"
        status={authViewState === 'demo' ? <Badge variant="outline">Mode démo</Badge> : undefined}
        actions={
          <SegmentedControl
            options={RANGES}
            value={range}
            onChange={next => navigate({ search: { range: next } })}
            aria-label="Période"
          />
        }
      />

      <section className="grid gap-8 border-b border-border pb-9 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)] lg:gap-12">
        <div>
          <p className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="size-2 rounded-tile bg-primary" aria-hidden="true" />
            Argent disponible
          </p>
          <Amount
            value={available?.value}
            className="mt-3 block text-[clamp(2.25rem,7vw,3.5rem)] font-medium tracking-[-0.035em] text-foreground"
          />
          <div className="mt-6 max-w-xl border-t border-border">
            {available?.items.length ? (
              available.items.map(item => (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                    {item.detail ? (
                      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                  <Amount value={item.value} decimals={2} className="text-sm text-foreground" />
                </div>
              ))
            ) : (
              <p className="border-b border-border py-5 text-sm text-muted-foreground">
                Données indisponibles
              </p>
            )}
          </div>
        </div>

        <div className="space-y-6 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-1">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Patrimoine total
            </p>
            <Amount value={viewModel.totalWealth} className="mt-2 block text-2xl font-medium" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Performance {range === '7d' ? '7 j' : range === '90d' ? '90 j' : '30 j'}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Données insuffisantes</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {summaryUnavailable ? (
              <Status tone="negative" label="Données indisponibles" />
            ) : staleSummary ? (
              <Status tone="attention" label="Données anciennes" />
            ) : summaryQuery.isPending ? (
              <Status tone="progress" label="Chargement" />
            ) : (
              <ValuationState state={viewModel.valuationState} />
            )}
            <Freshness asOf={viewModel.valuationAsOf} />
          </div>
          {viewModel.coveragePercent !== null ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[11px] text-muted-foreground">
                <span>Couverture</span>
                <span>{viewModel.coveragePercent.toLocaleString('fr-FR')} %</span>
              </div>
              <Progress value={viewModel.coveragePercent} label="Couverture de valorisation" />
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="wealth-breakdown-title">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2
            id="wealth-breakdown-title"
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
          >
            Répartition du patrimoine
          </h2>
          {viewModel.unknownValueCount > 0 ? (
            <Status
              tone="attention"
              label={`${viewModel.unknownValueCount} valeur${viewModel.unknownValueCount > 1 ? 's' : ''} à vérifier`}
            />
          ) : null}
        </div>
        {breakdownTotal > 0 ? (
          <div
            className="mt-4 flex h-1.5 gap-0.5 overflow-hidden rounded-[3px] bg-foreground/9"
            aria-hidden="true"
          >
            {knownBreakdowns.map(breakdown => (
              <span
                key={breakdown.key}
                className={BREAKDOWN_TONE[breakdown.key]}
                style={{ flexGrow: breakdown.value ?? 0 }}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            Répartition indisponible
          </div>
        )}
        <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {viewModel.breakdowns.map(breakdown => (
            <div key={breakdown.key} className="flex items-center gap-2.5">
              <span
                className={`size-2 rounded-tile ${BREAKDOWN_TONE[breakdown.key]}`}
                aria-hidden="true"
              />
              <span className="text-sm text-foreground">{breakdown.label}</span>
              <Amount value={breakdown.value} className="ml-auto text-xs text-muted-foreground" />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-9 border-t border-border pt-8 lg:grid-cols-2 lg:gap-12">
        <BreakdownList title="Épargne" breakdown={savings} />
        <BreakdownList title="Investissements" breakdown={investments} />
      </section>

      <Panel className="bg-surface-2" bodyClassName="grid gap-9 lg:grid-cols-2 lg:gap-12">
        <section aria-labelledby="top-expenses-title">
          <h2
            id="top-expenses-title"
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
          >
            Top dépenses
          </h2>
          <div className="mt-4 space-y-4">
            {summaryQuery.data?.topExpenseGroups.length ? (
              summaryQuery.data.topExpenseGroups.slice(0, 4).map(group => {
                const max = summaryQuery.data?.topExpenseGroups[0]?.total ?? 0
                return (
                  <div key={`${group.category}-${group.merchant}`}>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="truncate text-foreground">{group.label}</span>
                      <CurrencyAmount
                        value={group.total}
                        currency="EUR"
                        className="shrink-0 text-foreground"
                      />
                    </div>
                    <Progress
                      value={max > 0 ? group.total : null}
                      max={max || 1}
                      tone="neutral"
                      label={`Dépenses ${group.label}`}
                      className="mt-2"
                    />
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                {summaryQuery.isPending ? 'Chargement' : 'Aucune dépense'}
              </p>
            )}
          </div>
        </section>

        <section
          aria-labelledby="cockpit-goals-title"
          className="border-t border-border pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0"
        >
          <h2
            id="cockpit-goals-title"
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
          >
            Objectifs
          </h2>
          <div className="mt-4 space-y-5">
            {activeGoals.length ? (
              activeGoals.slice(0, 3).map(goal => {
                const progress =
                  goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : null
                return (
                  <div key={goal.id}>
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="truncate text-sm text-foreground">{goal.name}</span>
                      <span className="shrink-0 font-mono text-xs text-primary">
                        {progress === null
                          ? 'Indisponible'
                          : `${Math.min(100, Math.max(0, Math.round(progress)))} %`}
                      </span>
                    </div>
                    <Progress value={progress} label={goal.name} className="mt-2" />
                    <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                      <Amount value={goal.currentAmount} decimals={0} /> sur{' '}
                      <Amount value={goal.targetAmount} decimals={0} />
                    </p>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                {goalsQuery.isPending ? 'Chargement' : 'Aucun objectif actif'}
              </p>
            )}
          </div>
        </section>
      </Panel>

      {attentionTotal > 0 ? (
        <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
          <Status
            tone="attention"
            label={`${attentionTotal} élément${attentionTotal > 1 ? 's' : ''} à vérifier`}
          />
        </div>
      ) : null}
    </div>
  )
}

function BreakdownList({
  title,
  breakdown,
}: {
  title: string
  breakdown: ReturnType<typeof buildCockpitViewModel>['breakdowns'][number] | undefined
}) {
  return (
    <section aria-label={title}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h2>
        <Amount value={breakdown?.value} className="text-lg font-medium text-foreground" />
      </div>
      <div className="mt-4 border-t border-border">
        {breakdown?.items.length ? (
          breakdown.items.slice(0, 5).map(item => (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{item.label}</p>
                {item.detail ? (
                  <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                    {item.detail}
                  </p>
                ) : null}
              </div>
              <Amount value={item.value} className="text-sm text-foreground" />
            </div>
          ))
        ) : (
          <p className="border-b border-border py-5 text-sm text-muted-foreground">
            Aucune donnée disponible
          </p>
        )}
      </div>
    </section>
  )
}
