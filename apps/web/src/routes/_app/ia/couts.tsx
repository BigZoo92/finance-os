import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Badge, Card, CardContent } from '@finance-os/ui/components'
import { isAiRunActiveStatus } from '@finance-os/ai/run-status'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { getAiAdvisorUiFlags } from '@/features/ai-advisor-config'
import {
  dashboardAdvisorRunsQueryOptionsWithMode,
  dashboardAdvisorSpendQueryOptionsWithMode,
  dashboardCostOverviewQueryOptionsWithMode,
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
      context.queryClient.ensureQueryData(dashboardCostOverviewQueryOptionsWithMode({ mode })),
    ])
  },
  component: IaCoutsPage,
})

const formatCurrencyAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)

const formatCurrencyTotals = (
  totals: Array<{ currency: string; amount: number }>,
  fallback = '-'
) => {
  if (totals.length === 0) return fallback
  return totals.map(total => formatCurrencyAmount(total.amount, total.currency)).join(' + ')
}

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
  const costOverviewQuery = useQuery(dashboardCostOverviewQueryOptionsWithMode(modeOpts))

  const spendSeries = spendQuery.data?.daily.map(point => point.usd) ?? []
  const runs = runsQuery.data?.items ?? []
  const recurringMonthly = costOverviewQuery.data?.totals.recurringMonthlyByCurrency ?? []
  const variableMonthlyUsd = costOverviewQuery.data?.totals.variableMonthlyUsd ?? 0

  if (!aiAdvisorVisible) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Admin / Couts"
          icon="$"
          title="Couts"
          description="Surface reservee a la session admin."
        />
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Session admin requise.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin / Couts"
        icon="$"
        title="Couts"
        description="Suivi des couts Advisor, X et abonnements fournisseurs. La pipeline agentique de developpement reste separee."
        actions={isDemo ? <Badge variant="warning">demo</Badge> : null}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Advisor jour"
          value={spendQuery.data?.summary.dailyUsdSpent ?? 0}
          display={`$${(spendQuery.data?.summary.dailyUsdSpent ?? 0).toFixed(4)}`}
          tone="brand"
          loading={spendQuery.isPending}
        />
        <KpiTile
          label="Advisor mois"
          value={spendQuery.data?.summary.monthlyUsdSpent ?? 0}
          display={`$${(spendQuery.data?.summary.monthlyUsdSpent ?? 0).toFixed(4)}`}
          tone="plain"
          loading={spendQuery.isPending}
        />
        <KpiTile
          label="Abonnements / mois"
          value={recurringMonthly.reduce((sum, item) => sum + item.amount, 0)}
          display={formatCurrencyTotals(recurringMonthly)}
          tone="plain"
          loading={costOverviewQuery.isPending}
        />
        <KpiTile
          label="Variable mois"
          value={variableMonthlyUsd}
          display={`$${variableMonthlyUsd.toFixed(2)}`}
          tone="plain"
          loading={costOverviewQuery.isPending}
        />
      </section>

      {costOverviewQuery.data ? (
        <Panel title="Fournisseurs" tone="plain" icon={<span aria-hidden="true">$</span>}>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border/50 bg-background/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                X variable mois
              </p>
              <p className="mt-1 font-financial text-lg font-semibold">
                ${costOverviewQuery.data.variableUsage.xTwitter.monthlyUsd.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                {costOverviewQuery.data.variableUsage.xTwitter.costBasisThisMonth}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Advisor mois
              </p>
              <p className="mt-1 font-financial text-lg font-semibold">
                ${costOverviewQuery.data.variableUsage.advisor.monthlyUsd.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                {costOverviewQuery.data.variableUsage.advisor.status}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Fixe annuel
              </p>
              <p className="mt-1 font-financial text-lg font-semibold">
                {formatCurrencyTotals(costOverviewQuery.data.totals.recurringAnnualByCurrency)}
              </p>
              <p className="text-xs text-muted-foreground">
                {costOverviewQuery.data.recurringSubscriptions.length} lignes
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Depenses quotidiennes" tone="brand" icon={<span aria-hidden="true">$</span>}>
          {spendSeries.length > 1 ? (
            <div className="space-y-3">
              <MiniSparkline data={spendSeries} width={480} height={80} color="var(--primary)" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{spendQuery.data?.daily[0]?.date ?? '-'}</span>
                <span>{spendQuery.data?.daily.at(-1)?.date ?? '-'}</span>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Pas assez de donnees pour afficher la courbe.
            </p>
          )}
        </Panel>

        <Panel title="Budget Advisor" tone="plain" icon={<span aria-hidden="true">%</span>}>
          {spendQuery.data ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Budget jour
                  </p>
                  <p className="mt-1 font-financial text-lg font-semibold">
                    ${spendQuery.data.summary.dailyBudgetUsd.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Budget mois
                  </p>
                  <p className="mt-1 font-financial text-lg font-semibold">
                    ${spendQuery.data.summary.monthlyBudgetUsd.toFixed(2)}
                  </p>
                </div>
              </div>
              {spendQuery.data.summary.blocked ? (
                <p className="text-sm text-negative">Budget depasse.</p>
              ) : null}
              {spendQuery.data.anomalies.map(anomaly => (
                <p
                  key={`${anomaly.severity}:${anomaly.message}`}
                  className={`text-xs ${
                    anomaly.severity === 'critical' ? 'text-negative' : 'text-warning'
                  }`}
                >
                  {anomaly.message}
                </p>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Pas de donnees de budget.
            </p>
          )}
        </Panel>
      </div>

      {costOverviewQuery.data?.recurringSubscriptions.length ? (
        <Panel title="Abonnements suivis" tone="plain" icon={<span aria-hidden="true">=</span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-left">
                  <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Fournisseur
                  </th>
                  <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Ligne
                  </th>
                  <th className="py-2 pr-4 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Mensuel
                  </th>
                </tr>
              </thead>
              <tbody>
                {costOverviewQuery.data.recurringSubscriptions.map(subscription => (
                  <tr key={subscription.id} className="border-b border-border/20">
                    <td className="py-2 pr-4 text-muted-foreground">{subscription.provider}</td>
                    <td className="py-2 pr-4">{subscription.label}</td>
                    <td className="py-2 pr-4 text-right font-financial">
                      {formatCurrencyAmount(subscription.monthlyAmount, subscription.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {runs.length > 0 ? (
        <Panel title="Runs recents" tone="plain" icon={<span aria-hidden="true">{'>'}</span>}>
          <div className="space-y-2">
            {runs.slice(0, 8).map(run => (
              <div
                key={run.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/60 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <span className="text-sm text-foreground">#{run.id}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatDateTime(run.startedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      run.status === 'failed'
                        ? 'destructive'
                        : run.status === 'degraded' || isAiRunActiveStatus(run.status)
                          ? 'outline'
                          : 'secondary'
                    }
                  >
                    {run.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {run.runType}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  )
}
