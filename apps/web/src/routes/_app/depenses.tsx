import { createFileRoute } from '@tanstack/react-router'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import {
  dashboardSummaryQueryOptionsWithMode,
  dashboardTransactionsInfiniteQueryOptionsWithMode,
  dashboardQueryKeys,
} from '@/features/dashboard-query-options'
import type { DashboardRange, DashboardTransactionsResponse } from '@/features/dashboard-types'
import { patchTransactionClassification } from '@/features/dashboard-api'
import { ExpenseStructureCard } from '@/components/dashboard/expense-structure-card'
import { MonthlyCategoryBudgetsCard } from '@/components/dashboard/monthly-category-budgets-card'
import { MonthEndProjectionCard } from '@/components/dashboard/month-end-projection-card'
import { formatMoney, formatDate, toErrorMessage } from '@/lib/format'
import { exportTransactionsCsv } from '@/lib/export'
import { pushToast } from '@/lib/toast-store'

const searchSchema = z.object({
  range: z.enum(['7d', '30d', '90d']).optional(),
})

const resolveRange = (value: string | undefined): DashboardRange => {
  return value === '7d' || value === '90d' ? value : '30d'
}

export const Route = createFileRoute('/_app/depenses')({
  validateSearch: search => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ range: resolveRange(search.range) }),
  loader: async ({ context, deps }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined = auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    await Promise.all([
      context.queryClient.ensureQueryData(
        dashboardSummaryQueryOptionsWithMode({ range: deps.range, mode })
      ),
      context.queryClient.ensureInfiniteQueryData(
        dashboardTransactionsInfiniteQueryOptionsWithMode({ range: deps.range, limit: 30, mode })
      ),
    ])
  },
  component: DepensesPage,
})

const RANGE_OPTIONS: Array<{ label: string; value: DashboardRange }> = [
  { label: '7j', value: '7d' },
  { label: '30j', value: '30d' },
  { label: '90j', value: '90d' },
]

function DepensesPage() {
  const { range: searchRange } = Route.useSearch()
  const range = resolveRange(searchRange)
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()

  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const transactionsQuery = useInfiniteQuery(
    dashboardTransactionsInfiniteQueryOptionsWithMode({
      range,
      limit: 30,
      ...(authMode ? { mode: authMode } : {}),
    })
  )

  const transactions = transactionsQuery.data?.pages.flatMap(page => page.items) ?? []

  const classifyMutation = useMutation({
    mutationFn: async (transaction: DashboardTransactionsResponse['items'][number]) => {
      if (!isAdmin) throw new Error('Admin session required')
      const categoryInput = window.prompt('Catégorie', transaction.category ?? '')
      if (categoryInput === null) throw new Error('Annulé')
      const subcategoryInput = window.prompt('Sous-catégorie', transaction.subcategory ?? '')
      if (subcategoryInput === null) throw new Error('Annulé')
      const tagsInput = window.prompt('Tags (virgules)', transaction.tags.join(', '))
      if (tagsInput === null) throw new Error('Annulé')
      const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0)
      const category = categoryInput.trim()
      const subcategory = subcategoryInput.trim()
      return patchTransactionClassification({
        transactionId: transaction.id,
        category: category.length > 0 ? category : null,
        subcategory: subcategory.length > 0 ? subcategory : null,
        incomeType: null,
        tags,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.transactions({ range, limit: 30 }) })
      pushToast({ title: 'Classification sauvegardée', description: 'Mise à jour effectuée.', tone: 'success' })
    },
    onError: error => {
      if (error instanceof Error && error.message === 'Annulé') return
      pushToast({ title: 'Échec', description: toErrorMessage(error), tone: 'error' })
    },
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dépenses</h2>
          <p className="text-sm text-muted-foreground">Transactions, budgets et projections</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={transactions.length === 0}
            onClick={() => exportTransactionsCsv(transactions, range)}
          >
            Export CSV
          </Button>
          <div className="inline-flex items-center rounded-lg border border-border bg-surface-1 p-1">
            {RANGE_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => navigate({ search: { range: option.value } })}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  range === option.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={{ transitionDuration: 'var(--duration-fast)' }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Expense structure + budgets */}
      <div className="grid gap-6 md:grid-cols-2">
        <ExpenseStructureCard range={range} transactions={transactions} demo={isDemo} />
        <MonthlyCategoryBudgetsCard isAdmin={isAdmin} isDemo={isDemo} transactions={transactions} />
      </div>

      {/* Projection */}
      <MonthEndProjectionCard isAdmin={isAdmin} transactions={transactions} />

      {/* Transactions table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dernières transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactionsQuery.isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, index) => `expense-transaction-skeleton-${index + 1}`).map(key => (
                <div key={key} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune transaction sur cette période.
            </p>
          ) : (
            <>
              {/* Desktop table — hidden on mobile */}
              <div className="hidden md:block overflow-x-auto -mx-6">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Libellé</th>
                      <th className="px-6 py-3">Catégorie</th>
                      <th className="px-6 py-3 text-right">Montant</th>
                      {isAdmin && <th className="px-6 py-3" />}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr
                        key={tx.id}
                        className="border-b border-border/50 transition-colors hover:bg-surface-1"
                        style={{ transitionDuration: 'var(--duration-fast)' }}
                      >
                        <td className="whitespace-nowrap px-6 py-3 text-muted-foreground">{formatDate(tx.bookingDate)}</td>
                        <td className="px-6 py-3">
                          <p className="font-medium">{tx.label}</p>
                          <p className="text-xs text-muted-foreground">{tx.accountName ?? tx.powensAccountId}</p>
                        </td>
                        <td className="px-6 py-3">
                          <span className="text-xs text-muted-foreground">
                            {tx.category ?? 'Non catégorisé'}
                            {tx.subcategory ? ` / ${tx.subcategory}` : ''}
                          </span>
                        </td>
                        <td className={`whitespace-nowrap px-6 py-3 text-right font-financial font-medium ${tx.direction === 'expense' ? 'text-negative' : 'text-positive'}`}>
                          {formatMoney(tx.amount, tx.currency)}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-3">
                            <Button type="button" variant="ghost" size="sm" className="text-xs" disabled={classifyMutation.isPending} onClick={() => classifyMutation.mutate(tx)}>
                              Éditer
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="space-y-2 md:hidden">
                {transactions.map(tx => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors duration-150 hover:bg-surface-1 active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tx.label}</p>
                      <p className="text-sm text-muted-foreground/60">
                        {formatDate(tx.bookingDate)} · {tx.category ?? 'Non catégorisé'}
                      </p>
                    </div>
                    <p className={`font-financial text-sm font-semibold shrink-0 ${tx.direction === 'expense' ? 'text-negative' : 'text-positive'}`}>
                      {formatMoney(tx.amount, tx.currency)}
                    </p>
                  </div>
                ))}
              </div>

              {transactionsQuery.hasNextPage && (
                <div className="flex justify-center pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => transactionsQuery.fetchNextPage()}
                    disabled={transactionsQuery.isFetchingNextPage}
                  >
                    {transactionsQuery.isFetchingNextPage ? 'Chargement...' : 'Charger plus'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
