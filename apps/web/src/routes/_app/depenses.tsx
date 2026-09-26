import { css, cva, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
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
import { ExpenseStructureCard } from '@/components/dashboard/expense-structure-card'
import { MonthlyCategoryBudgetsCard } from '@/components/dashboard/monthly-category-budgets-card'
import { TransactionsTable } from '@/components/data/transactions-table'
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

const eyebrow = css({
  fontFamily: 'mono',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: 'muted.foreground',
})

const periodAmount = cva({
  base: { mt: '2', display: 'block', textStyle: 'xl', fontWeight: 'medium' },
  variants: {
    tone: {
      positive: { color: 'positive' },
      negative: { color: 'negative' },
    },
  },
})

const emptyFrame = css({
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: 'border',
  p: '6',
})

const mutedText = css({ textStyle: 'sm', color: 'muted.foreground' })

const loadingStatus = css({ borderYWidth: '1px', borderColor: 'border', py: '8' })

// Tailwind's `space-y-2` put the margin on every child but the last: the inline
// <label> ignores it, so Panda's `spaceY` (a margin on the following control)
// would add 8px that the screen never had.
const fieldGroup = css({ '& > :not(:last-child)': { marginBlockEnd: '2' } })

const fieldLabel = css({ textStyle: 'sm', fontWeight: 'medium' })

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
    <styled.div spaceY="9" md={{ spaceY: '11' }}>
      <PageHeader
        title="Dépenses"
        actions={
          <styled.div display="flex" flexWrap="wrap" alignItems="center" gap="2">
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
          </styled.div>
        }
      />

      <styled.section
        display="grid"
        gap="6"
        borderYWidth="1px"
        borderColor="border"
        py="6"
        sm={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
      >
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
      </styled.section>
      {period.currency === null && summaryQuery.data ? (
        <Status tone="attention" label="Totaux indisponibles pour plusieurs devises" />
      ) : summaryQuery.isError && !summaryQuery.data ? (
        <Status tone="negative" label="Totaux indisponibles" />
      ) : null}

      <styled.section
        display="grid"
        gap="10"
        lg={{ gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)', gap: '14' }}
      >
        <ExpenseStructureCard model={period} />
        <MonthlyCategoryBudgetsCard isAdmin={isAdmin} isDemo={isDemo} />
      </styled.section>

      <section aria-labelledby="transactions-title">
        <styled.div
          display="flex"
          flexWrap="wrap"
          alignItems="flex-end"
          justifyContent="space-between"
          gap="4"
          pb="4"
        >
          <div>
            <h2 id="transactions-title" className={eyebrow}>
              Transactions
            </h2>
            <styled.p mt="2" textStyle="sm" color="muted.foreground">
              {transactions.length} chargée{transactions.length > 1 ? 's' : ''}
              {transactionsQuery.hasNextPage ? ', liste partielle' : ''}
            </styled.p>
          </div>
          <styled.div display="flex" flexWrap="wrap" alignItems="center" gap="4">
            {uncategorizedCount > 0 ? (
              <Status tone="attention" label={`${uncategorizedCount} à classer`} />
            ) : null}
            <Freshness asOf={firstPage?.freshness.lastSyncedAt} />
          </styled.div>
        </styled.div>

        {transactionsQuery.isPending ? (
          <Status tone="progress" label="Chargement" className={loadingStatus} />
        ) : transactionsQuery.isError && transactions.length === 0 ? (
          <div className={emptyFrame}>
            <Status tone="negative" label="Transactions indisponibles" />
          </div>
        ) : transactions.length === 0 ? (
          <div className={cx(emptyFrame, mutedText)}>Aucune transaction pour cette période</div>
        ) : (
          <TransactionsTable
            transactions={transactions}
            isAdmin={isAdmin}
            editing={classifyMutation.isPending}
            onEdit={setEditingTransaction}
          />
        )}

        {transactionsQuery.hasNextPage ? (
          <styled.div display="flex" justifyContent="center" pt="5">
            <Button
              type="button"
              variant="outline"
              onClick={() => transactionsQuery.fetchNextPage()}
              disabled={transactionsQuery.isFetchingNextPage}
            >
              {transactionsQuery.isFetchingNextPage ? 'Chargement' : 'Afficher plus'}
            </Button>
          </styled.div>
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
    </styled.div>
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
      <p className={eyebrow}>{label}</p>
      <CurrencyAmount value={value} currency={currency} className={periodAmount({ tone })} />
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
      <DialogContent
        maxW="md"
        smDown={{
          bottom: '0',
          left: '0',
          top: 'auto',
          w: 'full',
          maxW: 'none',
          translate: '0 0',
          roundedBottom: '0',
          roundedTop: 'frame',
        }}
      >
        <DialogHeader>
          <DialogTitle>Modifier la catégorie</DialogTitle>
          <DialogDescription>{transaction.label}</DialogDescription>
        </DialogHeader>
        <styled.form
          onSubmit={event => {
            event.preventDefault()
            onSave(draft)
          }}
          spaceY="4"
        >
          <div className={fieldGroup}>
            <label htmlFor="transaction-category" className={fieldLabel}>
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
          <div className={fieldGroup}>
            <label htmlFor="transaction-subcategory" className={fieldLabel}>
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
          <div className={fieldGroup}>
            <label htmlFor="transaction-tags" className={fieldLabel}>
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
        </styled.form>
      </DialogContent>
    </Dialog>
  )
}
