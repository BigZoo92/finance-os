import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
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
import { adaptDashboardSummaryLegacy } from '@/features/dashboard-legacy-adapter'
import { getTrendDirection, summarizeCashflowDirection } from '@/components/dashboard/trend-visuals'
import { formatMoney } from '@/lib/format'
import { D3Sparkline } from '@/components/ui/d3-sparkline'

const searchSchema = z.object({ range: z.enum(['7d', '30d', '90d']).optional() })
const resolveRange = (v: string | undefined): DashboardRange => v === '7d' || v === '90d' ? v : '30d'

export const Route = createFileRoute('/_app/')({
  validateSearch: s => searchSchema.parse(s),
  loaderDeps: ({ search }) => ({ range: resolveRange(search.range) }),
  loader: async ({ context, deps }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined = auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
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
  { label: '7 jours', value: '7d' },
  { label: '30 jours', value: '30d' },
  { label: '90 jours', value: '90d' },
]

function CockpitPage() {
  const { range: searchRange } = Route.useSearch()
  const range = resolveRange(searchRange)
  const navigate = Route.useNavigate()

  const authQuery = useQuery(authMeQueryOptions())
  const vs = resolveAuthViewState({ isPending: authQuery.isPending, ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}) })
  const isDemo = vs === 'demo'
  const isAdmin = vs === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const summaryQ = useQuery(dashboardSummaryQueryOptionsWithMode({ range, ...(authMode ? { mode: authMode } : {}) }))
  const statusQ = useQuery(powensStatusQueryOptionsWithMode(authMode ? { mode: authMode } : {}))
  const goalsQ = useQuery(financialGoalsQueryOptionsWithMode({ mode: authMode }))

  const adapted = adaptDashboardSummaryLegacy({ range, summary: summaryQ.data, ...(authMode ? { mode: authMode } : {}) })
  const trend = getTrendDirection({ start: adapted.dailyWealthSnapshots[0]?.balance ?? null, end: adapted.dailyWealthSnapshots.at(-1)?.balance ?? null })
  const delta = (adapted.dailyWealthSnapshots.at(-1)?.balance ?? 0) - (adapted.dailyWealthSnapshots[0]?.balance ?? 0)
  const cf = summarizeCashflowDirection({ incomes: adapted.totals.incomes, expenses: adapted.totals.expenses })

  const conns = statusQ.data?.connections ?? []
  const connsOk = conns.filter(c => c.status === 'connected').length
  const connsFail = conns.filter(c => c.status === 'error' || c.status === 'reconnect_required').length

  const goals = goalsQ.data?.items ?? []
  const activeGoals = goals.filter(g => !g.archivedAt)

  const sparkData = adapted.dailyWealthSnapshots.map(s => ({ date: s.date, value: s.balance }))

  return (
    <div className="space-y-10">
      {/* ── Hero KPI section ── */}
      <section>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            <p className="font-mono text-xs uppercase tracking-widest text-primary/60">◈ Finance OS</p>
            <h2 className="mt-1 text-4xl font-bold tracking-tighter">Cockpit</h2>
            {isDemo && <Badge variant="warning" className="mt-2">Mode démo</Badge>}
          </motion.div>

          {/* Range pills */}
          <div className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-card/80 p-1 backdrop-blur-sm">
            {RANGES.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => navigate({ search: { range: r.value } })}
                className={`relative rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 ${
                  range === r.value ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range === r.value && (
                  <motion.div
                    layoutId="range-pill"
                    className="absolute inset-0 rounded-full bg-primary shadow-[0_0_12px_oklch(from_var(--primary)_l_c_h/25%)]"
                    style={{ zIndex: -1 }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Wealth hero — no card wrapper, direct presence */}
        <div className="mt-8 grid gap-6 md:gap-8 lg:grid-cols-[2fr_1fr]">
          {/* Chart */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground/60">Évolution patrimoine</p>
              <Badge variant={trend === 'up' ? 'positive' : trend === 'down' ? 'destructive' : 'outline'} className="text-xs">
                {trend === 'up' ? `▲ +${formatMoney(delta)}` : trend === 'down' ? `▼ ${formatMoney(delta)}` : '● stable'}
              </Badge>
            </div>
            {sparkData.length > 1 ? (
              <D3Sparkline
                data={sparkData}
                height={140}
                showArea
                showTooltip
                animate
                formatValue={v => formatMoney(v)}
              />
            ) : (
              <div className="flex h-[140px] items-center justify-center rounded-2xl border border-dashed border-border/30">
                <span className="font-mono text-xs text-muted-foreground/40">[ données insuffisantes ]</span>
              </div>
            )}
          </div>

          {/* KPI stack — vertical, no cards */}
          <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-col lg:justify-between lg:gap-4">
            <Kpi label="Patrimoine" value={formatMoney(adapted.totals.balance)} large loading={summaryQ.isPending} />
            <Kpi label="Revenus" value={formatMoney(adapted.totals.incomes)} color="positive" loading={summaryQ.isPending} />
            <Kpi label="Dépenses" value={formatMoney(adapted.totals.expenses)} color="negative" loading={summaryQ.isPending} />
            <Kpi label="Cashflow" value={formatMoney(cf.net)} {...(cf.direction === 'up' ? { color: 'positive' as const } : cf.direction === 'down' ? { color: 'negative' as const } : {})} loading={summaryQ.isPending} />
          </div>
        </div>
      </section>

      {/* ── Quick insights — fluid layout ── */}
      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Top expenses — direct list, no card */}
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
            <span className="text-lg" aria-hidden="true">↔</span> Top dépenses
          </p>
          <div className="space-y-1.5">
            {adapted.topExpenseGroups.length > 0 ? (
              adapted.topExpenseGroups.slice(0, 5).map((g, i) => (
                <motion.div
                  key={`${g.category}-${g.merchant}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.25 }}
                  className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-card"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-bold text-negative/60 w-4 text-right">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{g.label}</p>
                      <p className="text-xs text-muted-foreground/60">{g.count} transaction{g.count > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <p className="font-financial text-sm font-semibold text-negative">{formatMoney(g.total)}</p>
                </motion.div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground/40">Aucune dépense.</p>
            )}
          </div>
        </div>

        {/* Connections */}
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-accent-2/60">
            <span className="text-lg" aria-hidden="true">⊞</span> Connexions
          </p>
          <div className="mb-3 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-positive" /> {connsOk} OK</span>
            {connsFail > 0 && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-negative animate-pulse" /> {connsFail} erreur</span>}
          </div>
          <div className="space-y-1">
            {adapted.connections.slice(0, 5).map(c => (
              <div key={c.powensConnectionId} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 transition-colors duration-150 hover:bg-card">
                <span className="truncate text-sm text-muted-foreground">{c.providerInstitutionName ?? `#${c.powensConnectionId}`}</span>
                <span className="font-financial text-sm font-medium">{formatMoney(c.balance)}</span>
              </div>
            ))}
            {adapted.connections.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground/40">Aucune connexion.</p>}
          </div>
        </div>

        {/* Goals */}
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-accent-2/60">
            <span className="text-lg" aria-hidden="true">◎</span> Objectifs
          </p>
          <div className="space-y-3">
            {activeGoals.length > 0 ? (
              activeGoals.slice(0, 4).map((g, i) => {
                const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0
                return (
                  <div key={g.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{g.name}</span>
                      <span className="font-financial text-xs font-semibold text-primary">{Math.round(pct)}%</span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-border/30">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/70 to-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.15 * i }}
                      />
                      {/* Glow dot at end */}
                      <motion.div
                        className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_oklch(from_var(--primary)_l_c_h/50%)]"
                        initial={{ left: 0, opacity: 0 }}
                        animate={{ left: `calc(${pct}% - 6px)`, opacity: pct > 5 ? 1 : 0 }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.15 * i }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground/40">Aucun objectif.</p>
            )}
          </div>
        </div>
      </section>

      {/* ── ASCII status bar ── */}
      <footer className="rounded-2xl bg-card/50 px-5 py-3">
        <div className="font-mono text-xs flex flex-wrap gap-x-6 gap-y-1">
          <Stat label="patrimoine" value={formatMoney(adapted.totals.balance)} {...(trend === 'up' ? { tone: 'positive' as const } : trend === 'down' ? { tone: 'negative' as const } : {})} />
          <Stat label="cashflow" value={formatMoney(cf.net)} {...(cf.direction === 'up' ? { tone: 'positive' as const } : cf.direction === 'down' ? { tone: 'negative' as const } : {})} />
          <Stat label="connexions" value={`${connsOk}/${conns.length}`} />
          <Stat label="objectifs" value={`${activeGoals.length}`} />
          <Stat label="période" value={range} />
        </div>
      </footer>
    </div>
  )
}

function Kpi({ label, value, large, color, loading }: { label: string; value: string; large?: boolean; color?: 'positive' | 'negative'; loading?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/50 px-5 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">{label}</p>
      {loading ? (
        <div className={`mt-1 ${large ? 'h-9 w-36' : 'h-6 w-24'} animate-shimmer rounded-lg`} />
      ) : (
        <p className={`mt-0.5 font-financial font-bold tracking-tight ${large ? 'text-2xl' : 'text-lg'} ${color === 'positive' ? 'text-positive' : color === 'negative' ? 'text-negative' : ''}`}>
          {value}
        </p>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <span className="text-muted-foreground/50">
      {label}<span className="mx-1 text-muted-foreground/20">:</span>
      <span className={tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : 'text-foreground/70'}>{value}</span>
    </span>
  )
}
