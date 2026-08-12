import {
  Button,
  CurrencyAmount,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Freshness,
  Input,
  SegmentedControl,
  Status,
} from '@finance-os/ui/components'
import { DownloadPixelIcon } from '@finance-os/ui/icons/pixel'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { TransactionsTable } from '@/components/data/transactions-table'
import { ExpenseStructureCard } from '@/components/dashboard/expense-structure-card'
import { MonthlyCategoryBudgetsCard } from '@/components/dashboard/monthly-category-budgets-card'
import { PageHeader } from '@/components/surfaces/page-header'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { patchTransactionClassification } from '@/features/dashboard-api'
import {
  dashboardQueryKeys,
  dashboardSummaryQueryOptionsWithMode,
  dashboardTransactionsInfiniteQueryOptionsWithMode,
} from '@/features/dashboard-query-options'
import type { DashboardRange, DashboardTransactionsResponse } from '@/features/dashboard-types'
import { buildExpensePeriodViewModel } from '@/features/expenses-view-model'
import { exportTransactionsCsv } from '@/lib/export'
import { toErrorMessage } from '@/lib/format'
import { pushToast } from '@/lib/toast-store'

type Transaction = DashboardTransactionsResponse['items'][number]
type ClassificationDraft = { category: string; subcategory: string; tags: string }

const searchSchema = z.object({ range: z.enum(['7d', '30d', '90d']).optional() })
const resolveRange = (value: string | undefined): DashboardRange =>
  value === '7d' || value === '90d' ? value : '30d'

export const Route = createFileRoute('/_app/depenses')({
  validateSearch: search => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ range: resolveRange(search.range) }),
  loader: async ({ context, deps }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
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
  { label: '7 j', value: '7d' },
  { label: '30 j', value: '30d' },
  { label: '90 j', value: '90d' },
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
  const summaryQuery = useQuery(
    dashboardSummaryQueryOptionsWithMode({ range, ...(authMode ? { mode: authMode } : {}) })
  )
  const transactions = transactionsQuery.data?.pages.flatMap(page => page.items) ?? []
  const period = buildExpensePeriodViewModel(summaryQuery.data)
  const firstPage = transactionsQuery.data?.pages[0]
  const uncategorizedCount = transactions.filter(transaction => !transaction.category).length
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  const classifyMutation = useMutation({
    mutationFn: async ({
      transaction,
      draft,
    }: {
      transaction: Transaction
      draft: ClassificationDraft
    }) => {
      if (!isAdmin) throw new Error('Session admin requise')
      return patchTransactionClassification({
        transactionId: transaction.id,
        category: draft.category.trim() || null,
        subcategory: draft.subcategory.trim() || null,
        incomeType: null,
        tags: draft.tags
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.transactions({ range, limit: 30 }),
      })
      setEditingTransaction(null)
      pushToast({
        title: 'Classification sauvegardée',
        description: 'Catégorie mise à jour.',
        tone: 'success',
      })
    },
    onError: error => {
      pushToast({ title: 'Échec', description: toErrorMessage(error), tone: 'error' })
    },
  })

  return (
    <div className="space-y-9 md:space-y-11">
      <PageHeader
        title="Dépenses"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={transactions.length === 0}
              onClick={() => exportTransactionsCsv(transactions, range)}
            >
              <DownloadPixelIcon size={14} />
              Export CSV
            </Button>
            <SegmentedControl
              options={RANGE_OPTIONS}
              value={range}
              onChange={next => navigate({ search: { range: next } })}
              aria-label="Période"
            />
          </div>
        }
      />

      <section className="grid gap-6 border-y border-border py-6 sm:grid-cols-3">
        <PeriodValue
          label="Dépenses"
          value={period.expenses}
          currency={period.currency}
          tone="negative"
        />
        <PeriodValue
          label="Revenus"
          value={period.incomes}
          currency={period.currency}
          tone="positive"
        />
        <PeriodValue
          label="Solde"
          value={period.net}
          currency={period.currency}
          tone={period.net !== null && period.net < 0 ? 'negative' : 'positive'}
        />
      </section>
      {period.currency === null && summaryQuery.data ? (
        <Status tone="attention" label="Totaux indisponibles pour plusieurs devises" />
      ) : summaryQuery.isError && !summaryQuery.data ? (
        <Status tone="negative" label="Totaux indisponibles" />
      ) : null}

      <section className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:gap-14">
        <ExpenseStructureCard model={period} />
        <MonthlyCategoryBudgetsCard isAdmin={isAdmin} isDemo={isDemo} />
      </section>

      <section aria-labelledby="transactions-title">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
          <div>
            <h2
              id="transactions-title"
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
            >
              Transactions
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {transactions.length} chargée{transactions.length > 1 ? 's' : ''}
              {transactionsQuery.hasNextPage ? ', liste partielle' : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {uncategorizedCount > 0 ? (
              <Status tone="attention" label={`${uncategorizedCount} à classer`} />
            ) : null}
            <Freshness asOf={firstPage?.freshness.lastSyncedAt} />
          </div>
        </div>

        {transactionsQuery.isPending ? (
          <Status tone="progress" label="Chargement" className="border-y border-border py-8" />
        ) : transactionsQuery.isError && transactions.length === 0 ? (
          <div className="border border-dashed border-border p-6">
            <Status tone="negative" label="Transactions indisponibles" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="border border-dashed border-border p-6 text-sm text-muted-foreground">
            Aucune transaction pour cette période
          </div>
        ) : (
          <TransactionsTable
            transactions={transactions}
            isAdmin={isAdmin}
            editing={classifyMutation.isPending}
            onEdit={setEditingTransaction}
          />
        )}

        {transactionsQuery.hasNextPage ? (
          <div className="flex justify-center pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => transactionsQuery.fetchNextPage()}
              disabled={transactionsQuery.isFetchingNextPage}
            >
              {transactionsQuery.isFetchingNextPage ? 'Chargement' : 'Afficher plus'}
            </Button>
          </div>
        ) : null}
      </section>

      {editingTransaction ? (
        <TransactionCategoryEditor
          transaction={editingTransaction}
          pending={classifyMutation.isPending}
          onClose={() => !classifyMutation.isPending && setEditingTransaction(null)}
          onSave={draft => classifyMutation.mutate({ transaction: editingTransaction, draft })}
        />
      ) : null}
    </div>
  )
}

function PeriodValue({
  label,
  value,
  currency,
  tone,
}: {
  label: string
  value: number | null
  currency: string | null
  tone: 'positive' | 'negative'
}) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <CurrencyAmount
        value={value}
        currency={currency}
        className={`mt-2 block text-xl font-medium ${tone === 'negative' ? 'text-negative' : 'text-positive'}`}
      />
    </div>
  )
}

function TransactionCategoryEditor({
  transaction,
  pending,
  onClose,
  onSave,
}: {
  transaction: Transaction
  pending: boolean
  onClose: () => void
  onSave: (draft: ClassificationDraft) => void
}) {
  const [draft, setDraft] = useState<ClassificationDraft>({
    category: transaction.category ?? '',
    subcategory: transaction.subcategory ?? '',
    tags: transaction.tags.join(', '),
  })
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-frame">
        <DialogHeader>
          <DialogTitle>Modifier la catégorie</DialogTitle>
          <DialogDescription>{transaction.label}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={event => {
            event.preventDefault()
            onSave(draft)
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <label htmlFor="transaction-category" className="text-sm font-medium">
              Catégorie
            </label>
            <Input
              id="transaction-category"
              value={draft.category}
              onChange={event =>
                setDraft(current => ({ ...current, category: event.target.value }))
              }
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="transaction-subcategory" className="text-sm font-medium">
              Sous-catégorie
            </label>
            <Input
              id="transaction-subcategory"
              value={draft.subcategory}
              onChange={event =>
                setDraft(current => ({ ...current, subcategory: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="transaction-tags" className="text-sm font-medium">
              Tags
            </label>
            <Input
              id="transaction-tags"
              value={draft.tags}
              onChange={event => setDraft(current => ({ ...current, tags: event.target.value }))}
              placeholder="Séparés par des virgules"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Enregistrement' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
