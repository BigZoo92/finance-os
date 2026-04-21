import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Badge } from '@finance-os/ui/components'
import { motion } from 'motion/react'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { dashboardSummaryQueryOptionsWithMode } from '@/features/dashboard-query-options'
import type { DashboardRange } from '@/features/dashboard-types'
import { financialGoalsQueryOptionsWithMode } from '@/features/goals/query-options'
import { powensStatusQueryOptionsWithMode } from '@/features/powens/query-options'
import { adaptDailySurfaceViewModel } from '@/features/dashboard-view-model-adapter'
import { getTrendDirection, summarizeCashflowDirection } from '@/components/dashboard/trend-visuals'
import { formatMoney } from '@/lib/format'
import { D3Sparkline } from '@/components/ui/d3-sparkline'
import { CockpitHero } from '@/components/surfaces/cockpit-hero'
import { KpiTile } from '@/components/surfaces/kpi-tile'
import { Panel } from '@/components/surfaces/panel'
import { StatusDot } from '@/components/surfaces/status-dot'

const searchSchema = z.object({ range: z.enum(['7d', '30d', '90d']).optional() })
const resolveRange = (v: string | undefined): DashboardRange => (v === '7d' || v === '90d' ? v : '30d')

export const Route = createFileRoute('/_app/')({
  validateSearch: s => searchSchema.parse(s),
  loaderDeps: ({ search }) => ({ range: resolveRange(search.range) }),
  loader: async ({ context, deps }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return
    await Promise.all([
      context.queryClient.ensureQueryData(dashboardSummaryQueryOptionsWithMode({ range: deps.range, mode })),
      context.queryClient.ensureQueryData(financialGoalsQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(powensStatusQueryOptionsWithMode({ mode })),
    ])
  },
  component: CockpitPage,
})

const RANGES: Array<{ label: string; value: DashboardRange }> = [
  { label: '7 j', value: '7d' },
  { label: '30 j', value: '30d' },
  { label: '90 j', value: '90d' },
]

const COCKPIT_ROTATIONS = [
  'cockpit · personnel · premium',
  'dense · lisible · vivant',
  'vos finances · à vue',
]

function CockpitPage() {
  const { range: searchRange } = Route.useSearch()
  const range = resolveRange(searchRange)
  const navigate = Route.useNavigate()

  const authQuery = useQuery(authMeQueryOptions())
  const vs = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = vs === 'demo'
  const isAdmin = vs === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const summaryQ = useQuery(dashboardSummaryQueryOptionsWithMode({ range, ...(authMode ? { mode: authMode } : {}) }))
  const statusQ = useQuery(powensStatusQueryOptionsWithMode(authMode ? { mode: authMode } : {}))
  const goalsQ = useQuery(financialGoalsQueryOptionsWithMode({ mode: authMode }))

  const adapted = adaptDailySurfaceViewModel({
    mode: authMode ?? 'demo',
    range,
    summary: summaryQ.data,
  })
  const trend = getTrendDirection({
    start: adapted.dailyWealthSnapshots[0]?.balance ?? null,
    end: adapted.dailyWealthSnapshots.at(-1)?.balance ?? null,
  })
  const delta =
    (adapted.dailyWealthSnapshots.at(-1)?.balance ?? 0) - (adapted.dailyWealthSnapshots[0]?.balance ?? 0)
  const cf = summarizeCashflowDirection({
    incomes: adapted.totals.incomes,
    expenses: adapted.totals.expenses,
  })

  const conns = statusQ.data?.connections ?? []
  const connsOk = conns.filter(c => c.status === 'connected').length
  const connsFail = conns.filter(c => c.status === 'error' || c.status === 'reconnect_required').length

  const goals = goalsQ.data?.items ?? []
  const activeGoals = goals.filter(g => !g.archivedAt)

  const sparkData = adapted.dailyWealthSnapshots.map(s => ({ date: s.date, value: s.balance }))
  const [secondaryReady, setSecondaryReady] = useState(false)
  const staleData = !summaryQ.isPending && summaryQ.isError && summaryQ.data !== undefined

  useEffect(() => {
    if (summaryQ.isPending) {
      setSecondaryReady(false)
      return
    }

    const timeout = window.setTimeout(() => setSecondaryReady(true), 120)
    return () => window.clearTimeout(timeout)
  }, [summaryQ.isPending, summaryQ.dataUpdatedAt])

  return (
    <div className="space-y-10 md:space-y-12">
      {/* ── Hero — LiquidEther + TextPressure "COCKPIT" + CircularText halo ── */}
      <CockpitHero
        rotations={COCKPIT_ROTATIONS}
        range={range}
        rangeOptions={RANGES}
        onRangeChange={next => navigate({ search: { range: next } })}
        isDemo={isDemo}
        isAdmin={isAdmin}
      />

      {/* ── Wealth chart + KPI rail ── */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <Panel
          title={
            <span>
              Évolution du patrimoine{' '}
              <span className="font-mono text-[11px] font-normal uppercase tracking-[0.18em] text-muted-foreground/60">
                · {range}
              </span>
            </span>
          }
          description="Flux net de vos comptes agrégés sur la période. Survol = valeur au jour."
          icon={<span className="text-base" aria-hidden="true">◊</span>}
          tone="brand"
          actions={
            <Badge
              variant={trend === 'up' ? 'positive' : trend === 'down' ? 'destructive' : 'outline'}
              className="text-[11px]"
            >
              {trend === 'up' ? `▲ +${formatMoney(delta)}` : trend === 'down' ? `▼ ${formatMoney(delta)}` : '● stable'}
            </Badge>
          }
        >
          {sparkData.length > 1 ? (
            <D3Sparkline
              data={sparkData}
              height={220}
              showArea
              showTooltip
              animate
              color="var(--primary)"
              gradientFrom="var(--primary)"
              gradientTo="transparent"
              formatValue={v => formatMoney(v)}
            />
          ) : (
            <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed border-border/50 bg-surface-1">
              <span className="font-mono text-xs text-muted-foreground/50">[ données insuffisantes ]</span>
            </div>
          )}
        </Panel>

        <div className="grid grid-cols-2 gap-3 content-start lg:grid-cols-1 lg:gap-3">
          <KpiTile
            label="Patrimoine"
            value={adapted.totals.balance}
            display={formatMoney(adapted.totals.balance)}
            tone="brand"
            size="lg"
            loading={summaryQ.isPending}
            icon={<span aria-hidden="true">◊</span>}
          />
          <KpiTile
            label="Cashflow"
            value={cf.net}
            display={formatMoney(cf.net)}
            tone={cf.direction === 'up' ? 'positive' : cf.direction === 'down' ? 'negative' : 'plain'}
            loading={summaryQ.isPending}
            hint={`Revenus ${formatMoney(adapted.totals.incomes)} · Dépenses ${formatMoney(adapted.totals.expenses)}`}
          />
          <KpiTile
            label="Revenus"
            value={adapted.totals.incomes}
            display={formatMoney(adapted.totals.incomes)}
            tone="positive"
            loading={summaryQ.isPending}
          />
          <KpiTile
            label="Dépenses"
            value={adapted.totals.expenses}
            display={formatMoney(adapted.totals.expenses)}
            tone="negative"
            loading={summaryQ.isPending}
          />
        </div>
      </section>

      {staleData ? (
        <Panel
          title="Données en retard, cockpit utilisable"
          tone="warning"
          icon={<span className="text-base" aria-hidden="true">◔</span>}
          description={`Dernière mise à jour locale: ${new Date(summaryQ.dataUpdatedAt).toLocaleString('fr-FR')}.`}
        >
          <p className="text-sm text-muted-foreground">
            Action conseillée: relancez la synchronisation Powens depuis Intégrations, puis revenez ici.
          </p>
        </Panel>
      ) : null}

      {/* ── Insights — top expenses / connections / goals ── */}
      <section className="grid gap-5 md:gap-6 lg:grid-cols-3">
        {!secondaryReady ? (
          <Panel title="Chargement progressif" description="Affinage des surfaces quotidiennes…" tone="plain">
            <p className="py-6 text-sm text-muted-foreground">Les tuiles critiques sont prêtes, les détails arrivent.</p>
          </Panel>
        ) : null}
        {secondaryReady ? (
          <>
        <Panel
          title="Top dépenses"
          icon={<span className="text-base text-negative" aria-hidden="true">↔</span>}
          tone="negative"
        >
          <div className="space-y-1">
            {adapted.topExpenseGroups.length > 0 ? (
              adapted.topExpenseGroups.slice(0, 5).map((g, i) => (
                <motion.div
                  key={`${g.category}-${g.merchant}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.28 }}
                  className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-surface-1"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-negative/12 px-1.5 font-financial text-[10.5px] font-semibold text-negative"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{g.label}</p>
                      <p className="text-[11.5px] text-muted-foreground/70">
                        {g.count} transaction{g.count > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <p className="font-financial text-sm font-semibold text-negative">{formatMoney(g.total)}</p>
                </motion.div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground/50">Aucune dépense.</p>
            )}
          </div>
        </Panel>

        <Panel
          title="Connexions"
          icon={<span className="text-base text-accent-2" aria-hidden="true">⊞</span>}
          tone="violet"
          actions={
            <div className="flex items-center gap-3 text-[11.5px]">
              <span className="flex items-center gap-1.5 text-positive">
                <StatusDot tone="ok" size={6} /> {connsOk} OK
              </span>
              {connsFail > 0 && (
                <span className="flex items-center gap-1.5 text-negative">
                  <StatusDot tone="err" pulse size={6} /> {connsFail} erreur
                </span>
              )}
            </div>
          }
        >
          <div className="space-y-1">
            {adapted.connections.slice(0, 5).map(c => (
              <div
                key={c.powensConnectionId}
                className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-surface-1"
              >
                <span className="truncate text-sm text-foreground/85">
                  {c.providerInstitutionName ?? `#${c.powensConnectionId}`}
                </span>
                <span className="font-financial text-sm font-medium">{formatMoney(c.balance)}</span>
              </div>
            ))}
            {adapted.connections.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground/50">Aucune connexion.</p>
            )}
          </div>
        </Panel>

        <Panel
          title="Objectifs"
          icon={<span className="text-base text-primary" aria-hidden="true">◎</span>}
          tone="brand"
        >
          <div className="space-y-4">
            {activeGoals.length > 0 ? (
              activeGoals.slice(0, 4).map((g, i) => {
                const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0
                return (
                  <div key={g.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{g.name}</span>
                      <span className="font-financial text-xs font-semibold text-primary">
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-surface-1">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          background:
                            'linear-gradient(90deg, var(--aurora-a) 0%, var(--aurora-b) 55%, var(--aurora-c) 100%)',
                          boxShadow: '0 0 8px oklch(from var(--primary) l c h / 45%)',
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.12 * i }}
                      />
                      <motion.div
                        className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_oklch(from_var(--primary)_l_c_h/55%)]"
                        initial={{ left: 0, opacity: 0 }}
                        animate={{ left: `calc(${pct}% - 6px)`, opacity: pct > 4 ? 1 : 0 }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.12 * i }}
                      />
                    </div>
                    <p className="font-financial text-[11px] text-muted-foreground/70">
                      {formatMoney(g.currentAmount)} / {formatMoney(g.targetAmount)}
                    </p>
                  </div>
                )
              })
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground/50">Aucun objectif.</p>
            )}
          </div>
        </Panel>
          </>
        ) : null}
      </section>

      {/* ── Status bar — mono cockpit footer ── */}
      <footer className="rounded-2xl border border-border/50 bg-card/60 px-5 py-3 backdrop-blur-md">
        <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px]">
          <Stat
            label="patrimoine"
            value={formatMoney(adapted.totals.balance)}
            {...(trend === 'up' ? { tone: 'positive' as const } : trend === 'down' ? { tone: 'negative' as const } : {})}
          />
          <Stat
            label="cashflow"
            value={formatMoney(cf.net)}
            {...(cf.direction === 'up' ? { tone: 'positive' as const } : cf.direction === 'down' ? { tone: 'negative' as const } : {})}
          />
          <Stat label="connexions" value={`${connsOk}/${conns.length}`} />
          <Stat label="objectifs" value={`${activeGoals.length}`} />
          <Stat label="période" value={range} />
        </div>
      </footer>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'positive' | 'negative'
}) {
  return (
    <span className="text-muted-foreground/55">
      {label}
      <span className="mx-1 text-muted-foreground/25">:</span>
      <span
        className={
          tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : 'text-foreground/85'
        }
      >
        {value}
      </span>
    </span>
  )
}
