import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from '@finance-os/ui/components'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  dashboardQueryKeys,
  dashboardSummaryQueryOptions,
  dashboardTransactionsInfiniteQueryOptions,
} from '@/features/dashboard-query-options'
import type { DashboardRange } from '@/features/dashboard-types'
import { fetchPowensConnectUrl, postPowensSync } from '@/features/powens/api'
import { powensQueryKeys, powensStatusQueryOptions } from '@/features/powens/query-options'
import { pushToast } from '@/lib/toast-store'

const RANGE_OPTIONS: Array<{ label: string; value: DashboardRange }> = [
  { label: '7j', value: '7d' },
  { label: '30j', value: '30d' },
  { label: '90j', value: '90d' },
]

const STATUS_VARIANT: Record<
  'connected' | 'syncing' | 'error' | 'reconnect_required',
  'secondary' | 'outline' | 'destructive'
> = {
  connected: 'secondary',
  syncing: 'outline',
  error: 'destructive',
  reconnect_required: 'destructive',
}

const toErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message
  }

  return String(value)
}

const formatDateTime = (value: string | null) => {
  if (!value) {
    return '-'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }

  return parsed.toLocaleString('fr-FR')
}

const formatDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatMoney = (value: number, currency = 'EUR') => {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    }).format(value)
  }
}

export function DashboardAppShell({ range }: { range: DashboardRange }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const summaryQuery = useQuery(dashboardSummaryQueryOptions(range))
  const transactionsQuery = useInfiniteQuery(
    dashboardTransactionsInfiniteQueryOptions({
      range,
      limit: 30,
    })
  )
  const statusQuery = useQuery(powensStatusQueryOptions())

  const connectMutation = useMutation({
    mutationFn: fetchPowensConnectUrl,
    onSuccess: payload => {
      window.location.assign(payload.url)
    },
    onError: error => {
      pushToast({
        title: 'Connexion impossible',
        description: toErrorMessage(error),
        tone: 'error',
      })
    },
  })

  const syncMutation = useMutation({
    mutationFn: () => postPowensSync(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: powensQueryKeys.status(),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.all,
        }),
      ])

      pushToast({
        title: 'Sync enfilee',
        description: 'Le worker va traiter la synchronisation.',
        tone: 'success',
      })
    },
    onError: error => {
      pushToast({
        title: 'Sync refusee',
        description: toErrorMessage(error),
        tone: 'error',
      })
    },
  })

  const summary = summaryQuery.data
  const statusConnections = statusQuery.data?.connections ?? []
  const transactions = transactionsQuery.data?.pages.flatMap(page => page.items) ?? []
  const connectionBalanceById = new Map(
    (summary?.connections ?? []).map(connection => [connection.powensConnectionId, connection.balance])
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
        <header className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Finance OS Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Vue globale DB-first: comptes, transactions et etat Powens.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-md border p-1">
              {RANGE_OPTIONS.map(option => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={range === option.value ? 'default' : 'ghost'}
                  onClick={() =>
                    navigate({
                      to: '/',
                      search: {
                        range: option.value,
                      },
                    })
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? 'Sync...' : 'Sync now'}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? 'Ouverture...' : 'Connect bank'}
            </Button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Wealth overview</CardTitle>
              <CardDescription>Total balance across all active connections.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {summaryQuery.isPending ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : null}
              {summaryQuery.isError ? (
                <p className="text-sm text-destructive">{toErrorMessage(summaryQuery.error)}</p>
              ) : null}
              {summary ? (
                <>
                  <p className="text-3xl font-semibold">{formatMoney(summary.totals.balance)}</p>
                  <Separator />
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center justify-between">
                      <span>Income ({range})</span>
                      <span>{formatMoney(summary.totals.incomes)}</span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>Expenses ({range})</span>
                      <span>{formatMoney(summary.totals.expenses)}</span>
                    </p>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top expense groups</CardTitle>
              <CardDescription>Top 5 groups in the selected range.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {summary?.topExpenseGroups.length ? (
                summary.topExpenseGroups.map(group => (
                  <div key={`${group.category}-${group.merchant}`} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{group.label}</p>
                      <p className="text-xs text-muted-foreground">{group.count} transactions</p>
                    </div>
                    <p className="font-medium">{formatMoney(group.total)}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">Aucune depense sur cette periode.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Connections state</CardTitle>
              <CardDescription>Powens statuses and last sync timestamps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {statusQuery.isPending ? <p className="text-muted-foreground">Chargement...</p> : null}
              {statusQuery.isError ? (
                <p className="text-destructive">{toErrorMessage(statusQuery.error)}</p>
              ) : null}
              {!statusQuery.isPending && statusConnections.length === 0 ? (
                <p className="text-muted-foreground">Aucune connexion Powens.</p>
              ) : null}
              {statusConnections.map(connection => (
                <div key={connection.id} className="rounded-md border border-border/80 bg-muted/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">Connection #{connection.powensConnectionId}</p>
                    <Badge variant={STATUS_VARIANT[connection.status]}>{connection.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last sync: {formatDateTime(connection.lastSyncAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last success: {formatDateTime(connection.lastSuccessAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Balance:{' '}
                    {formatMoney(connectionBalanceById.get(connection.powensConnectionId) ?? 0)}
                  </p>
                  {connection.lastError ? (
                    <p className="text-xs text-destructive">Error: {connection.lastError}</p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Balance by connection</CardTitle>
              <CardDescription>Fortuneo/Revolut totals from local DB.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {summary?.connections.length ? (
                summary.connections.map(connection => (
                  <div
                    key={connection.powensConnectionId}
                    className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">Connection #{connection.powensConnectionId}</p>
                      <p className="text-xs text-muted-foreground">{connection.accountCount} accounts</p>
                    </div>
                    <p className="font-medium">{formatMoney(connection.balance)}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">Aucune connexion active.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Balance by account</CardTitle>
              <CardDescription>All active accounts and current balances.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {summary?.accounts.length ? (
                summary.accounts.map(account => (
                  <div
                    key={account.powensAccountId}
                    className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">
                        #{account.powensConnectionId} {account.type ? `- ${account.type}` : ''}
                      </p>
                    </div>
                    <p className="font-medium">{formatMoney(account.balance, account.currency)}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">Aucun compte actif.</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Latest transactions</CardTitle>
              <CardDescription>Last 30 transactions, paginated with cursor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {transactionsQuery.isPending ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : null}
              {transactionsQuery.isError ? (
                <p className="text-sm text-destructive">{toErrorMessage(transactionsQuery.error)}</p>
              ) : null}
              {!transactionsQuery.isPending && transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune transaction sur cette periode.</p>
              ) : null}

              {transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">Label</th>
                        <th className="py-2 pr-3">Account</th>
                        <th className="py-2 pr-3">Connection</th>
                        <th className="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(transaction => (
                        <tr key={transaction.id} className="border-t border-border/70">
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {formatDate(transaction.bookingDate)}
                          </td>
                          <td className="py-2 pr-3">{transaction.label}</td>
                          <td className="py-2 pr-3">{transaction.accountName ?? transaction.powensAccountId}</td>
                          <td className="py-2 pr-3">{transaction.powensConnectionId}</td>
                          <td
                            className={
                              transaction.direction === 'expense'
                                ? 'py-2 text-right font-medium text-destructive'
                                : 'py-2 text-right font-medium text-emerald-500'
                            }
                          >
                            {formatMoney(transaction.amount, transaction.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {transactionsQuery.hasNextPage ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => transactionsQuery.fetchNextPage()}
                    disabled={transactionsQuery.isFetchingNextPage}
                  >
                    {transactionsQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
