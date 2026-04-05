import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@finance-os/ui/components'
import { useInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { dashboardTransactionsInfiniteQueryOptionsWithMode } from '@/features/dashboard-query-options'
import type { DashboardRange, DashboardTransactionsResponse } from '@/features/dashboard-types'

const transactionSearchSchema = z.object({
  range: z.enum(['7d', '30d', '90d']).optional(),
  q: z.string().trim().min(1).max(120).optional(),
})

const resolveRange = (value: string | undefined): DashboardRange => {
  return value === '7d' || value === '90d' ? value : '30d'
}

const formatCurrency = (value: number, currency: string) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatDate = (value: string) => {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

const toErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message
  }

  return String(value)
}

export const Route = createFileRoute('/transactions')({
  validateSearch: search => transactionSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    range: resolveRange(search.range),
  }),
  loader: async ({ context, deps }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())

    await context.queryClient.ensureInfiniteQueryData(
      dashboardTransactionsInfiniteQueryOptionsWithMode({
        range: deps.range,
        limit: 30,
        mode: auth.mode,
      })
    )
  },
  component: TransactionsPage,
})

function filterTransactions(
  items: DashboardTransactionsResponse['items'],
  query: string | undefined
) {
  if (!query) {
    return items
  }

  const normalizedQuery = query.toLocaleLowerCase()
  return items.filter(item => {
    return [item.label, item.accountName ?? '', item.category ?? '', ...item.tags]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  })
}

function TransactionsPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const range = resolveRange(search.range)
  const query = search.q

  const auth = useSuspenseQuery(authMeQueryOptions()).data

  const transactionsQuery = useInfiniteQuery(
    dashboardTransactionsInfiniteQueryOptionsWithMode({
      range,
      limit: 30,
      mode: auth.mode,
    })
  )

  const transactions = transactionsQuery.data?.pages.flatMap(page => page.items) ?? []
  const filteredTransactions = filterTransactions(transactions, query)

  return (
    <div className="min-h-screen bg-background p-6 text-foreground md:p-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="text-sm font-medium" htmlFor="tx-q">
              Search
            </label>
            <Input
              id="tx-q"
              value={query ?? ''}
              onChange={event => {
                const nextValue = event.currentTarget.value.trim()
                void navigate({
                  to: '/transactions',
                  search: previous => {
                    if (nextValue) {
                      return {
                        ...previous,
                        q: nextValue,
                      }
                    }

                    const nextSearch = { ...previous }
                    delete nextSearch.q
                    return nextSearch
                  },
                  replace: true,
                })
              }}
              placeholder="Label, account, category, tag"
            />
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="tx-range">
              Range
            </label>
            <select
              id="tx-range"
              className="flex h-10 w-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={range}
              onChange={event => {
                const nextRange = event.currentTarget.value
                void navigate({
                  to: '/transactions',
                  search: previous => {
                    if (nextRange === '30d') {
                      const nextSearch = { ...previous }
                      delete nextSearch.range
                      return nextSearch
                    }

                    return {
                      ...previous,
                      range: nextRange as DashboardRange,
                    }
                  },
                })
              }}
            >
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
            </select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              Listing loaded from dashboard transactions query with URL-owned filters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {transactionsQuery.isPending ? <p>Loading transactions...</p> : null}
            {transactionsQuery.isError ? (
              <p className="text-sm text-destructive">{toErrorMessage(transactionsQuery.error)}</p>
            ) : null}
            {!transactionsQuery.isPending && !transactionsQuery.isError && filteredTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transaction matches the current filters.</p>
            ) : null}

            {filteredTransactions.length > 0 ? (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {filteredTransactions.map(item => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.bookingDate)} • {item.accountName ?? 'Unknown account'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={item.amount < 0 ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-600'}>
                        {formatCurrency(item.amount, item.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.category ?? 'Uncategorized'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {transactionsQuery.hasNextPage ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => transactionsQuery.fetchNextPage()}
                disabled={transactionsQuery.isFetchingNextPage}
              >
                {transactionsQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
