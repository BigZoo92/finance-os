import { Badge } from '@finance-os/ui/components'
import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import type { DashboardRange, DashboardTransactionsResponse } from '@/features/dashboard-types'

type DashboardTransaction = DashboardTransactionsResponse['items'][number]
type CategorySpendRow = { category: string; total: number; ratio: number }
type MonthlySpendRow = { month: string; label: string; total: number }

const RANGE_LABEL: Record<DashboardRange, string> = { '7d': '7 jours', '30d': '30 jours', '90d': '90 jours' }

const fmtMoney = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
const fmtPct = (v: number) => `${Math.round(v)}%`
const fmtMonth = (m: string) => {
  const d = new Date(`${m}-01T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? m : d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
}

export const summarizeExpenseCategories = (transactions: DashboardTransaction[], limit = 6): CategorySpendRow[] => {
  const map = new Map<string, number>()
  for (const tx of transactions) {
    const amt = tx.direction === 'expense' ? Math.abs(tx.amount) : 0
    if (amt <= 0) continue
    const key = (tx.category ?? 'Sans catégorie').trim() || 'Sans catégorie'
    map.set(key, (map.get(key) ?? 0) + amt)
  }
  const total = [...map.values()].reduce((s, v) => s + v, 0)
  return [...map.entries()]
    .map(([category, t]) => ({ category, total: t, ratio: total > 0 ? (t / total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export const summarizeExpenseTimeline = (transactions: DashboardTransaction[], limit = 6): MonthlySpendRow[] => {
  const map = new Map<string, number>()
  for (const tx of transactions) {
    const amt = tx.direction === 'expense' ? Math.abs(tx.amount) : 0
    if (amt <= 0) continue
    const month = tx.bookingDate.slice(0, 7)
    map.set(month, (map.get(month) ?? 0) + amt)
  }
  return [...map.entries()]
    .map(([month, total]) => ({ month, total, label: fmtMonth(month) }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-limit)
}

export const buildExpenseStructureExplanation = ({ topCategory, totalExpenses }: { topCategory: CategorySpendRow | null; totalExpenses: number }) => {
  if (!topCategory || totalExpenses <= 0) return 'Pas assez de données pour dégager une tendance.'
  return `${topCategory.category} est le principal poste avec ${fmtMoney(topCategory.total)}, soit ${fmtPct(topCategory.ratio)} des dépenses.`
}

// Color palette for categories
const CAT_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)']

export function ExpenseStructureCard({
  range, transactions, demo,
}: {
  range: DashboardRange
  transactions: DashboardTransactionsResponse['items']
  demo: boolean
}) {
  const cats = summarizeExpenseCategories(transactions)
  const timeline = summarizeExpenseTimeline(transactions)
  const maxMonth = timeline.reduce((m, r) => Math.max(m, r.total), 0)
  const totalExpenses = cats.reduce((s, r) => s + r.total, 0)
  const [active, setActive] = useState<string | null>(null)
  const explanation = useMemo(() => buildExpenseStructureExplanation({ topCategory: cats[0] ?? null, totalExpenses }), [cats, totalExpenses])

  if (cats.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border/30">
        <span className="font-mono text-xs text-muted-foreground/40">[ aucune dépense sur la période ]</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
          <span aria-hidden="true">↔</span> Structure des dépenses
        </p>
        {demo && <Badge variant="warning" className="text-xs">DÉMO</Badge>}
      </div>

      {/* Categories — horizontal bars with color coding */}
      <div className="space-y-2">
        {cats.map((row, i) => {
          const isActive = active === row.category
          const color = CAT_COLORS[i % CAT_COLORS.length]
          return (
            <motion.button
              key={row.category}
              type="button"
              onClick={() => setActive(isActive ? null : row.category)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              className={`group flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition-all duration-150 ${
                isActive ? 'bg-card ring-1 ring-primary/20' : 'hover:bg-card/60'
              }`}
            >
              {/* Color bar indicator */}
              <div className="relative h-8 w-1 rounded-full overflow-hidden bg-border/20">
                <motion.div
                  className="absolute bottom-0 w-full rounded-full"
                  style={{ backgroundColor: color }}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(row.ratio, 10)}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
                />
              </div>

              {/* Label */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{row.category}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="relative h-1.5 flex-1 rounded-full bg-border/20 overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ backgroundColor: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${row.ratio}%` }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
                    />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground/60 w-8 text-right">{fmtPct(row.ratio)}</span>
                </div>
              </div>

              {/* Amount */}
              <p className="font-financial text-sm font-semibold whitespace-nowrap">{fmtMoney(row.total)}</p>
            </motion.button>
          )
        })}
      </div>

      {/* Monthly timeline — compact horizontal bars */}
      {timeline.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground/40">Évolution mensuelle</p>
          {timeline.map((row, i) => (
            <div key={row.month} className="flex items-center gap-3">
              <span className="w-16 text-right text-xs text-muted-foreground/60 shrink-0">{row.label}</span>
              <div className="relative h-3 flex-1 rounded-full bg-border/15 overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-negative/50 to-negative/80"
                  initial={{ width: 0 }}
                  animate={{ width: `${maxMonth === 0 ? 0 : (row.total / maxMonth) * 100}%` }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 }}
                />
              </div>
              <span className="font-financial text-sm font-medium w-14 text-right shrink-0">{fmtMoney(row.total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Explanation */}
      <p className="text-sm text-muted-foreground/60 italic">{explanation}</p>
    </div>
  )
}
