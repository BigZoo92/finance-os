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
import { adaptDashboardSummaryLegacy } from '@/features/dashboard-legacy-adapter'
import { getTrendDirection } from '@/components/dashboard/trend-visuals'
import { formatMoney } from '@/lib/format'
import { D3Sparkline } from '@/components/ui/d3-sparkline'

const searchSchema = z.object({ range: z.enum(['7d', '30d', '90d']).optional() })
const resolveRange = (v: string | undefined): DashboardRange => v === '7d' || v === '90d' ? v : '30d'

export const Route = createFileRoute('/_app/patrimoine')({
  validateSearch: s => searchSchema.parse(s),
  loaderDeps: ({ search }) => ({ range: resolveRange(search.range) }),
  loader: async ({ context, deps }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined = auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return
    await context.queryClient.ensureQueryData(dashboardSummaryQueryOptionsWithMode({ range: deps.range, mode }))
  },
  component: PatrimoinePage,
})

const RANGES: Array<{ label: string; value: DashboardRange }> = [
  { label: '7 jours', value: '7d' },
  { label: '30 jours', value: '30d' },
  { label: '90 jours', value: '90d' },
]

const ASSET_TYPE_LABEL: Record<'cash' | 'investment' | 'manual', string> = {
  cash: 'Liquidités',
  investment: 'Investissement',
  manual: 'Manuel',
}

function PatrimoinePage() {
  const { range: searchRange } = Route.useSearch()
  const range = resolveRange(searchRange)
  const navigate = Route.useNavigate()

  const authQuery = useQuery(authMeQueryOptions())
  const vs = resolveAuthViewState({ isPending: authQuery.isPending, ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}) })
  const isDemo = vs === 'demo'
  const isAdmin = vs === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const summaryQ = useQuery(dashboardSummaryQueryOptionsWithMode({ range, ...(authMode ? { mode: authMode } : {}) }))
  const adapted = adaptDashboardSummaryLegacy({ range, summary: summaryQ.data, ...(authMode ? { mode: authMode } : {}) })

  const sparkData = adapted.dailyWealthSnapshots.map(s => ({ date: s.date, value: s.balance }))
  const trend = getTrendDirection({ start: sparkData[0]?.value ?? null, end: sparkData.at(-1)?.value ?? null })
  const delta = (sparkData.at(-1)?.value ?? 0) - (sparkData[0]?.value ?? 0)

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary/60">◆ Patrimoine</p>
          <h2 className="mt-1 text-4xl font-bold tracking-tighter">
            {summaryQ.isPending ? (
              <span className="inline-block h-10 w-48 animate-shimmer rounded-xl" />
            ) : (
              <span className="font-financial">{formatMoney(adapted.totals.balance)}</span>
            )}
          </h2>
          {!summaryQ.isPending && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={trend === 'up' ? 'positive' : trend === 'down' ? 'destructive' : 'outline'} className="text-xs">
                {trend === 'up' ? `▲ +${formatMoney(delta)}` : trend === 'down' ? `▼ ${formatMoney(delta)}` : '● stable'}
              </Badge>
              <span className="text-xs text-muted-foreground/50">sur {range === '7d' ? '7 jours' : range === '90d' ? '90 jours' : '30 jours'}</span>
            </div>
          )}
        </motion.div>

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
                  layoutId="patri-range-pill"
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

      {/* D3 Wealth Chart — replaces old WealthHistory */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground/50">Évolution patrimoine</p>
        </div>
        {sparkData.length > 1 ? (
          <D3Sparkline
            data={sparkData}
            height={180}
            showArea
            showTooltip
            showDots
            animate
            formatValue={v => formatMoney(v)}
          />
        ) : (
          <div className="flex h-[160px] items-center justify-center rounded-2xl border border-dashed border-border/30">
            <span className="font-mono text-xs text-muted-foreground/40">[ données insuffisantes ]</span>
          </div>
        )}
      </section>

      {/* Connections */}
      <section>
        <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
          <span className="text-lg" aria-hidden="true">⊞</span> Soldes par connexion
        </p>
        <div className="space-y-2">
          {adapted.connections.length > 0 ? (
            adapted.connections.map((c, i) => (
              <motion.div
                key={c.powensConnectionId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors duration-150 hover:bg-card"
              >
                <div>
                  <p className="text-sm font-medium">{c.providerInstitutionName ?? `#${c.powensConnectionId}`}</p>
                  <p className="text-sm text-muted-foreground/60">{c.provider} · {c.accountCount} compte{c.accountCount > 1 ? 's' : ''}</p>
                </div>
                <p className="font-financial text-sm font-bold">{formatMoney(c.balance)}</p>
              </motion.div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground/40">Aucune connexion.</p>
          )}
        </div>
      </section>

      {/* Assets */}
      <section>
        <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
          <span className="text-lg" aria-hidden="true">◆</span> Actifs
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {adapted.assets.length > 0 ? (
            adapted.assets.map((asset, i) => (
              <motion.div
                key={asset.assetId}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                className="rounded-2xl border border-border/30 bg-card/50 p-4 transition-all duration-200 hover:bg-card hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{asset.name}</p>
                      <Badge variant="outline" className="text-xs">{ASSET_TYPE_LABEL[asset.type]}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground/60">{asset.providerInstitutionName ?? asset.source}</p>
                  </div>
                  <p className="font-financial text-sm font-bold whitespace-nowrap">{formatMoney(asset.valuation, asset.currency)}</p>
                </div>
              </motion.div>
            ))
          ) : (
            <p className="col-span-full py-6 text-center text-sm text-muted-foreground/40">Aucun actif.</p>
          )}
        </div>
      </section>
    </div>
  )
}
