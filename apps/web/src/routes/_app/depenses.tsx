import { createFileRoute } from '@tanstack/react-router'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@finance-os/ui/components'
import { PageHeader } from '@/components/surfaces/page-header'
import { RangePill } from '@/components/surfaces/range-pill'
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
import { KpiTile } from '@/components/surfaces/kpi-tile'
import { Panel } from '@/components/surfaces/panel'
import {
  PersonalActionsPanel,
  PersonalEmptyState,
  PersonalSectionHeading,
  type PersonalActionItem,
} from '@/components/personal/personal-ux'

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
  const summaryQuery = useQuery(
    dashboardSummaryQueryOptionsWithMode({ range, ...(authMode ? { mode: authMode } : {}) })
  )
  const totalExpenses = transactions
    .filter(transaction => transaction.direction === 'expense')
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)
  const totalIncomes = transactions
    .filter(transaction => transaction.direction === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const netFlow = totalIncomes - totalExpenses
  const uncategorizedTransactions = transactions.filter(transaction => !transaction.category)
  const topExpenseCategory = [...transactions
    .filter(transaction => transaction.direction === 'expense')
    .reduce<Map<string, number>>((map, transaction) => {
      const key = (transaction.category ?? 'Sans catégorie').trim() || 'Sans catégorie'
      map.set(key, (map.get(key) ?? 0) + Math.abs(transaction.amount))
      return map
    }, new Map())]
    .sort((left, right) => right[1] - left[1])[0]
  const expenseActions: PersonalActionItem[] = [
    {
      label: uncategorizedTransactions.length > 0 ? 'Catégoriser les transactions' : 'Revoir les dernières lignes',
      description:
        uncategorizedTransactions.length > 0
          ? `${uncategorizedTransactions.length} transaction${uncategorizedTransactions.length > 1 ? 's' : ''} sans catégorie.`
          : 'Vérifier les libellés et les montants récents.',
      to: '/depenses',
      icon: '↔',
      tone: uncategorizedTransactions.length > 0 ? 'warning' : 'plain',
    },
    {
      label: 'Voir les objectifs',
      description: 'Relier tes dépenses à ce que tu veux financer.',
      to: '/objectifs',
      icon: '◎',
      tone: 'brand',
    },
    {
      label: "Demander à l'Advisor",
      description: 'Obtenir une lecture simple de ce qui pèse le plus.',
      to: '/ia/chat',
      icon: '□',
      tone: 'plain',
    },
  ]

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
      <PageHeader
        eyebrow="Cockpit personnel"
        icon="↔"
        title="Dépenses & revenus"
        description="Comprendre ce qui sort, ce qui rentre, et quelles lignes méritent une vérification."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={transactions.length === 0}
              onClick={() => exportTransactionsCsv(transactions, range)}
            >
              <span aria-hidden="true">↓</span>
              Export CSV
            </Button>
            <RangePill
              layoutId="depenses-range"
              ariaLabel="Période"
              options={RANGE_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
              value={range}
              onChange={next => navigate({ search: { range: next } })}
            />
          </>
        }
      />

      <section className="space-y-4">
        <PersonalSectionHeading
          eyebrow="Aujourd'hui"
          title="Tes flux en clair"
          description="Le résumé avant les catégories et la table de transactions."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile
            label="Dépenses"
            value={totalExpenses}
            display={formatMoney(totalExpenses)}
            tone="negative"
            loading={transactionsQuery.isPending}
            hint={`${transactions.filter(transaction => transaction.direction === 'expense').length} sortie${transactions.filter(transaction => transaction.direction === 'expense').length > 1 ? 's' : ''}`}
          />
          <KpiTile
            label="Revenus"
            value={totalIncomes}
            display={formatMoney(totalIncomes)}
            tone="positive"
            loading={transactionsQuery.isPending}
            hint={`${transactions.filter(transaction => transaction.direction === 'income').length} entrée${transactions.filter(transaction => transaction.direction === 'income').length > 1 ? 's' : ''}`}
          />
          <KpiTile
            label="Solde de période"
            value={netFlow}
            display={formatMoney(netFlow)}
            tone={netFlow >= 0 ? 'positive' : 'negative'}
            loading={transactionsQuery.isPending}
            hint={netFlow >= 0 ? 'Flux net positif' : 'Flux net négatif'}
          />
          <KpiTile
            label="À revoir"
            value={uncategorizedTransactions.length}
            display={String(uncategorizedTransactions.length)}
            tone={uncategorizedTransactions.length > 0 ? 'warning' : 'plain'}
            loading={transactionsQuery.isPending}
            hint="Transactions sans catégorie"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title="Ce qui pèse le plus"
          description="Une lecture simple du principal poste de dépense sur la période."
          icon={<span aria-hidden="true">↔</span>}
          tone="negative"
        >
          {transactionsQuery.isPending ? (
            <div className="h-16 animate-shimmer rounded-xl" />
          ) : topExpenseCategory ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Poste principal</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{topExpenseCategory[0]}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  À comparer avec tes budgets et objectifs avant de couper quoi que ce soit.
                </p>
              </div>
              <p className="font-financial text-3xl font-semibold text-negative">
                {formatMoney(topExpenseCategory[1])}
              </p>
            </div>
          ) : (
            <PersonalEmptyState
              title="Aucune dépense sur cette période"
              description="Essaie une plage plus large ou connecte un compte bancaire pour alimenter cette vue."
            />
          )}
        </Panel>
        <PersonalActionsPanel
          title="Prochaines actions"
          description="Garder la page utile sans transformer chaque ligne en problème."
          items={expenseActions}
        />
      </section>

      <PersonalSectionHeading
        eyebrow="Ma trajectoire"
        title="Structure et projection"
        description="Les catégories, budgets et fin de mois viennent après le résumé."
      />

      {/* Expense structure + budgets */}
      <div className="grid gap-6 md:grid-cols-2">
        <ExpenseStructureCard range={range} transactions={transactions} demo={isDemo} />
        <MonthlyCategoryBudgetsCard isAdmin={isAdmin} isDemo={isDemo} transactions={transactions} />
      </div>

      {/* Projection */}
      <MonthEndProjectionCard isAdmin={isAdmin} transactions={transactions} />

      <PersonalSectionHeading
        eyebrow="Mes données"
        title="Transactions"
        description="Inspecte les lignes, exporte si besoin, et classe uniquement en session admin."
      />

      {/* Transactions table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dernières transactions</CardTitle>
          <p className="text-sm text-muted-foreground">
            {summaryQuery.isError
              ? 'Données indisponibles pour l’instant, la liste reste utilisable si elle est déjà en cache.'
              : `${transactions.length} transaction${transactions.length > 1 ? 's' : ''} chargée${transactions.length > 1 ? 's' : ''} sur ${range}.`}
          </p>
        </CardHeader>
        <CardContent>
          {transactionsQuery.isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, index) => `expense-transaction-skeleton-${index + 1}`).map(key => (
                <div key={key} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <PersonalEmptyState
              title="Aucune transaction pour cette période"
              description="Essaie 90 jours ou vérifie les intégrations si tu attends des mouvements bancaires."
            />
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
                          {!tx.category ? (
                            <span className="ml-2 rounded-full border border-warning/25 bg-warning/10 px-2 py-0.5 text-[10px] text-warning">
                              à classer
                            </span>
                          ) : null}
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
                    className="rounded-xl px-3 py-3 transition-colors duration-150 hover:bg-surface-1 active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{tx.label}</p>
                        <p className="text-sm text-muted-foreground/60">
                          {formatDate(tx.bookingDate)} · {tx.category ?? 'Non catégorisé'}
                          {tx.subcategory ? ` / ${tx.subcategory}` : ''}
                        </p>
                      </div>
                      <p className={`font-financial text-sm font-semibold shrink-0 ${tx.direction === 'expense' ? 'text-negative' : 'text-positive'}`}>
                        {formatMoney(tx.amount, tx.currency)}
                      </p>
                    </div>
                    {isAdmin ? (
                      <div className="pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={classifyMutation.isPending}
                          onClick={() => classifyMutation.mutate(tx)}
                        >
                          Éditer la catégorie
                        </Button>
                      </div>
                    ) : null}
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
