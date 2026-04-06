import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@finance-os/ui/components'
import type { DashboardRange, DashboardTransactionsResponse } from '@/features/dashboard-types'

type DashboardTransaction = DashboardTransactionsResponse['items'][number]

type CategorySpendRow = {
  category: string
  total: number
  ratio: number
}

type MonthlySpendRow = {
  month: string
  label: string
  total: number
}

const RANGE_LABEL: Record<DashboardRange, string> = {
  '7d': '7 jours',
  '30d': '30 jours',
  '90d': '90 jours',
}

const formatMoney = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

const formatPercent = (value: number) => {
  return `${Math.round(value)}%`
}

const formatMonthLabel = (month: string) => {
  const parsed = new Date(`${month}-01T00:00:00.000Z`)

  if (Number.isNaN(parsed.getTime())) {
    return month
  }

  return parsed.toLocaleDateString('fr-FR', {
    month: 'short',
    year: 'numeric',
  })
}

const getExpenseAmount = (transaction: DashboardTransaction) => {
  if (transaction.direction !== 'expense') {
    return 0
  }

  return Math.abs(transaction.amount)
}

export const summarizeExpenseCategories = (
  transactions: DashboardTransactionsResponse['items'],
  limit = 6
): CategorySpendRow[] => {
  const categoryTotals = new Map<string, number>()

  for (const transaction of transactions) {
    const amount = getExpenseAmount(transaction)

    if (amount <= 0) {
      continue
    }

    const key = (transaction.category ?? 'Sans categorie').trim() || 'Sans categorie'
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + amount)
  }

  const totalExpenses = [...categoryTotals.values()].reduce((sum, value) => sum + value, 0)

  return [...categoryTotals.entries()]
    .map(([category, total]) => ({
      category,
      total,
      ratio: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export const summarizeExpenseTimeline = (
  transactions: DashboardTransactionsResponse['items'],
  limit = 6
): MonthlySpendRow[] => {
  const monthlyTotals = new Map<string, number>()

  for (const transaction of transactions) {
    const amount = getExpenseAmount(transaction)

    if (amount <= 0) {
      continue
    }

    const month = transaction.bookingDate.slice(0, 7)
    monthlyTotals.set(month, (monthlyTotals.get(month) ?? 0) + amount)
  }

  return [...monthlyTotals.entries()]
    .map(([month, total]) => ({ month, total, label: formatMonthLabel(month) }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-limit)
}

export function ExpenseStructureCard({
  range,
  transactions,
  demo,
}: {
  range: DashboardRange
  transactions: DashboardTransactionsResponse['items']
  demo: boolean
}) {
  const categorySplit = summarizeExpenseCategories(transactions)
  const timeline = summarizeExpenseTimeline(transactions)
  const maxMonthlyExpense = timeline.reduce((max, row) => Math.max(max, row.total), 0)

  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Expense structure
          {demo ? <Badge variant="outline">DEMO</Badge> : null}
        </CardTitle>
        <CardDescription>
          Category mix and monthly trajectory for {RANGE_LABEL[range].toLowerCase()}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {categorySplit.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune depense exploitable sur cette periode pour construire la structure.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Repartition par categorie
              </p>
              <div className="space-y-2">
                {categorySplit.map(row => (
                  <div key={row.category} className="rounded-md border border-border/70 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <p className="font-medium">{row.category}</p>
                      <p className="text-muted-foreground">{formatMoney(row.total)}</p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full border border-border/70 bg-muted/30">
                      <div
                        className="h-full rounded-full bg-indigo-500/75"
                        style={{ width: `${Math.max(row.ratio, 4)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatPercent(row.ratio)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Evolution mensuelle des depenses
              </p>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">Historique mensuel insuffisant.</p>
              ) : (
                <div className="space-y-2">
                  {timeline.map(row => (
                    <div key={row.month} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-medium">{formatMoney(row.total)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full border border-border/70 bg-muted/30">
                        <div
                          className="h-full rounded-full bg-rose-500/75"
                          style={{
                            width: `${maxMonthlyExpense === 0 ? 0 : (row.total / maxMonthlyExpense) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
