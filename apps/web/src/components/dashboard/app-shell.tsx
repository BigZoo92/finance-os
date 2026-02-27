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
import { postAuthLogout } from '@/features/auth-api'
import { authMeQueryOptions, authQueryKeys } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
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

const DemoWidgetBadge = ({ demo }: { demo: boolean }) => {
  if (!demo) {
    return null
  }

  return (
    <Badge variant="outline" className="border-amber-500/60 bg-amber-400/15 text-amber-700 dark:text-amber-300">
      DEMO
    </Badge>
  )
}

export function DashboardAppShell({ range }: { range: DashboardRange }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const authQuery = useQuery(authMeQueryOptions())
  const summaryQuery = useQuery(dashboardSummaryQueryOptions(range))
  const transactionsQuery = useInfiniteQuery(
    dashboardTransactionsInfiniteQueryOptions({
      range,
      limit: 30,
    })
  )
  const statusQuery = useQuery(powensStatusQueryOptions())
  const authViewState = resolveAuthViewState({
    mode: authQuery.data?.mode,
    isPending: authQuery.isPending,
  })
  const isAuthPending = authViewState === 'pending'
  const isAdmin = authViewState === 'admin'
  const isDemo = authViewState === 'demo'
  const isAuthUnavailable = authQuery.data?.error === 'auth_unavailable'

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!isAdmin) {
        throw new Error('Admin session required')
      }

      return fetchPowensConnectUrl()
    },
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
    mutationFn: async () => {
      if (!isAdmin) {
        throw new Error('Admin session required')
      }

      return postPowensSync()
    },
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

  const logoutMutation = useMutation({
    mutationFn: postAuthLogout,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: authQueryKeys.me(),
        }),
        queryClient.invalidateQueries({
          queryKey: powensQueryKeys.status(),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.all,
        }),
      ])

      pushToast({
        title: 'Session fermee',
        description: 'Retour en mode demo.',
        tone: 'info',
      })
    },
    onError: error => {
      pushToast({
        title: 'Logout impossible',
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
              {isAuthPending
                ? 'Verification de la session en cours...'
                : isDemo
                ? 'Mode demo: donnees mockees uniquement, actions sensibles desactivees.'
                : 'Mode admin: acces complet DB + Powens.'}
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
              disabled={!isAdmin || syncMutation.isPending}
              title={!isAdmin ? 'Action reservee au compte BigZoo' : undefined}
            >
              {syncMutation.isPending ? 'Sync...' : 'Sync now'}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => connectMutation.mutate()}
              disabled={!isAdmin || connectMutation.isPending}
              title={!isAdmin ? 'Action reservee au compte BigZoo' : undefined}
            >
              {connectMutation.isPending ? 'Ouverture...' : 'Connect bank'}
            </Button>

            {isAuthPending ? (
              <Button type="button" size="sm" variant="ghost" disabled>
                Session...
              </Button>
            ) : isDemo ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => navigate({ to: '/login' })}>
                Se connecter BigZoo
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? 'Deconnexion...' : 'Logout'}
              </Button>
            )}
          </div>
        </header>

        {isDemo ? (
          <p className="text-xs text-muted-foreground">
            Actions sensibles bloquees en mode demo (sync Powens, connexion banque, callback).
          </p>
        ) : null}

        {isDemo ? (
          <Card className="border-amber-500/40 bg-[linear-gradient(120deg,rgba(245,158,11,0.18),rgba(234,88,12,0.14),rgba(245,158,11,0.1))]">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  <Badge className="bg-amber-500 text-black hover:bg-amber-500">DEMO</Badge>
                  Mode demonstration active
                </p>
                <p className="text-sm text-amber-900/95 dark:text-amber-100/90">
                  Mode demo : donnees mockees. Connecte-toi BigZoo pour voir les vraies donnees.
                </p>
                {isAuthUnavailable ? (
                  <p className="text-xs text-amber-800/90 dark:text-amber-200/90">
                    Auth indisponible temporairement: fallback demo active.
                  </p>
                ) : null}
              </div>
              <Button type="button" onClick={() => navigate({ to: '/login' })}>
                Se connecter BigZoo
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Wealth overview
                <DemoWidgetBadge demo={isDemo} />
              </CardTitle>
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
              <CardTitle className="flex items-center gap-2">
                Top expense groups
                <DemoWidgetBadge demo={isDemo} />
              </CardTitle>
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
              <CardTitle className="flex items-center gap-2">
                Connections state
                <DemoWidgetBadge demo={isDemo} />
              </CardTitle>
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
              <CardTitle className="flex items-center gap-2">
                Balance by connection
                <DemoWidgetBadge demo={isDemo} />
              </CardTitle>
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
              <CardTitle className="flex items-center gap-2">
                Balance by account
                <DemoWidgetBadge demo={isDemo} />
              </CardTitle>
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
              <CardTitle className="flex items-center gap-2">
                Latest transactions
                <DemoWidgetBadge demo={isDemo} />
              </CardTitle>
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
