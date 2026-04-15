import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { dashboardSummaryQueryOptionsWithMode } from '@/features/dashboard-query-options'
import type { DashboardRange } from '@/features/dashboard-types'
import { adaptDashboardSummaryLegacy } from '@/features/dashboard-legacy-adapter'
import { formatMoney, formatQuantity } from '@/lib/format'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { KpiTile } from '@/components/surfaces/kpi-tile'
import { ActionDock } from '@/components/surfaces/action-dock'
import { pushToast } from '@/lib/toast-store'

const searchSchema = z.object({
  range: z.enum(['7d', '30d', '90d']).optional(),
})

const resolveRange = (value: string | undefined): DashboardRange => {
  return value === '7d' || value === '90d' ? value : '30d'
}

export const Route = createFileRoute('/_app/investissements')({
  validateSearch: search => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ range: resolveRange(search.range) }),
  loader: async ({ context, deps }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined = auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return
    await context.queryClient.ensureQueryData(
      dashboardSummaryQueryOptionsWithMode({ range: deps.range, mode })
    )
  },
  component: InvestissementsPage,
})


function InvestissementsPage() {
  const { range: searchRange } = Route.useSearch()
  const range = resolveRange(searchRange)

  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const summaryQuery = useQuery(
    dashboardSummaryQueryOptionsWithMode({ range, ...(authMode ? { mode: authMode } : {}) })
  )
  const adaptedSummary = adaptDashboardSummaryLegacy({
    range, summary: summaryQuery.data, ...(authMode ? { mode: authMode } : {}),
  })
  const positions = adaptedSummary.positions

  const totalValue = positions.reduce(
    (sum, p) => sum + (p.currentValue ?? p.lastKnownValue ?? 0),
    0
  )

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Positions & valorisation"
        icon="△"
        title="Investissements"
        description="Vue des positions d'investissement, coût d'acquisition et PnL latent."
      />

      {/* Totals */}
      <div className="grid gap-3 sm:grid-cols-2">
        <KpiTile
          label="Valorisation totale"
          value={totalValue}
          display={formatMoney(totalValue)}
          tone="brand"
          size="lg"
          loading={summaryQuery.isPending}
          hint={`${positions.length} position${positions.length !== 1 ? 's' : ''} active${positions.length !== 1 ? 's' : ''}`}
        />
        <KpiTile
          label="Période"
          display={range}
          tone="violet"
          loading={summaryQuery.isPending}
          hint="Cette vue ne filtre pas encore par date."
        />
      </div>

      {/* Positions */}
      <Panel title="Positions" icon={<span aria-hidden="true">△</span>} tone="brand">
          {summaryQuery.isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, index) => `investments-position-skeleton-${index + 1}`).map(key => (
                <div key={key} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : positions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune position d'investissement active.
            </p>
          ) : (
            <div className="space-y-3">
              {positions.map(position => {
                const value = position.currentValue ?? position.lastKnownValue ?? 0
                const cost = position.costBasis ?? 0
                const pnl = cost > 0 ? value - cost : null

                return (
                  <div
                    key={position.positionId}
                    className="rounded-lg border border-border/50 bg-surface-1 p-4 transition-colors hover:bg-surface-2"
                    style={{ transitionDuration: 'var(--duration-fast)' }}
                  >
                    {/* Desktop: row layout */}
                    <div className="hidden sm:flex sm:items-center sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{position.name}</p>
                        <p className="text-xs text-muted-foreground">{position.assetName ?? position.accountName ?? 'Position'} · {position.positionKey}</p>
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">Quantité</p>
                          <p className="font-financial text-sm font-medium">{formatQuantity(position.quantity)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">Coût</p>
                          <p className="font-financial text-sm">{position.costBasis === null ? '-' : formatMoney(position.costBasis, position.currency)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">Valeur</p>
                          <p className="font-financial text-sm font-semibold">{formatMoney(value, position.currency)}</p>
                          {pnl !== null && (
                            <p className={`font-financial text-xs ${pnl >= 0 ? 'text-positive' : 'text-negative'}`}>{pnl >= 0 ? '+' : ''}{formatMoney(pnl, position.currency)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Mobile: stacked layout */}
                    <div className="sm:hidden space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{position.name}</p>
                          <p className="text-xs text-muted-foreground">{position.assetName ?? 'Position'}</p>
                        </div>
                        <p className="font-financial text-base font-bold shrink-0">{formatMoney(value, position.currency)}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-surface-0 py-1.5">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">Qté</p>
                          <p className="font-financial text-xs font-medium">{formatQuantity(position.quantity)}</p>
                        </div>
                        <div className="rounded-lg bg-surface-0 py-1.5">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">Coût</p>
                          <p className="font-financial text-xs">{position.costBasis === null ? '-' : formatMoney(position.costBasis, position.currency)}</p>
                        </div>
                        <div className="rounded-lg bg-surface-0 py-1.5">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">P&L</p>
                          <p className={`font-financial text-xs font-medium ${pnl !== null && pnl >= 0 ? 'text-positive' : 'text-negative'}`}>{pnl !== null ? `${pnl >= 0 ? '+' : ''}${formatMoney(pnl, position.currency)}` : '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </Panel>

      {/* Action dock — magnification toolbar for actions */}
      <ActionDock
        items={[
          {
            icon: <span aria-hidden="true">⟳</span>,
            label: 'Rafraîchir',
            tone: 'brand',
            onClick: () => pushToast({ title: 'Rafraîchissement', description: 'Données revalidées.', tone: 'info' }),
          },
          {
            icon: <span aria-hidden="true">↧</span>,
            label: 'Exporter',
            tone: 'violet',
            disabled: positions.length === 0,
            onClick: () => pushToast({ title: 'Export CSV', description: 'Fonctionnalité bientôt disponible.', tone: 'info' }),
          },
          {
            icon: <span aria-hidden="true">▣</span>,
            label: 'Nouvelle position',
            tone: 'positive',
            onClick: () => pushToast({ title: 'Création manuelle', description: 'Allez sur Patrimoine pour ajouter un actif.', tone: 'info' }),
          },
          {
            icon: <span aria-hidden="true">✕</span>,
            label: 'Réinitialiser',
            tone: 'negative',
            onClick: () => pushToast({ title: 'Réinitialisation', description: 'Filtres remis à zéro.', tone: 'info' }),
          },
        ]}
        className="mt-4"
      />
    </div>
  )
}
