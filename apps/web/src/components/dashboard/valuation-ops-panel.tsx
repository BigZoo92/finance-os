import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { dashboardQueryKeys } from '@/features/dashboard-query-options'
import { runValuationRefresh } from '@/features/valuation/api'
import {
  valuationQueryKeys,
  valuationStatusQueryOptionsWithMode,
  valuationUnresolvedQueryOptionsWithMode,
} from '@/features/valuation/query-options'
import { StatusDot } from '@/components/surfaces/status-dot'
import { formatDateTime, formatMoney } from '@/lib/format'

const STATUS_LABELS: Array<{ key: keyof StatusCounts; label: string }> = [
  { key: 'priced', label: 'pricé' },
  { key: 'derived', label: 'dérivé' },
  { key: 'estimated', label: 'estimé' },
  { key: 'manual', label: 'manuel' },
  { key: 'stale', label: 'stale' },
  { key: 'unresolved', label: 'non résolu' },
  { key: 'unavailable', label: 'indisponible' },
]

type StatusCounts = {
  priced: number
  derived: number
  estimated: number
  manual: number
  stale: number
  unresolved: number
  unavailable: number
}

/**
 * Financial Data Core — minimal admin diagnostic surface.
 * Coverage, valuation statuses, FX freshness, unresolved list, dry-run/refresh.
 * Not a redesign: one ops panel, admin-triggered actions only.
 */
export function ValuationOpsPanel({
  mode,
  isAdmin,
}: {
  mode: AuthMode | undefined
  isAdmin: boolean
}) {
  const queryClient = useQueryClient()
  const statusQuery = useQuery(valuationStatusQueryOptionsWithMode({ mode }))
  const unresolvedQuery = useQuery(valuationUnresolvedQueryOptionsWithMode({ mode }))

  const refreshMutation = useMutation({
    mutationFn: (dryRun: boolean) => runValuationRefresh({ dryRun }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: valuationQueryKeys.all })
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all })
    },
  })

  const status = statusQuery.data
  const coverage = status?.latestRun?.coverage ?? null
  const unresolved = unresolvedQuery.data
  const isRunning = status?.state === 'running' || refreshMutation.isPending

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <StatusDot
            tone={
              status?.state === 'failed' ? 'err' : status?.state === 'completed' ? 'ok' : 'idle'
            }
          />
          Valorisation des actifs
        </CardTitle>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!isAdmin || isRunning}
            onClick={() => refreshMutation.mutate(true)}
          >
            Dry-run
          </Button>
          <Button
            size="sm"
            disabled={!isAdmin || isRunning}
            onClick={() => refreshMutation.mutate(false)}
          >
            Rafraîchir
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {statusQuery.isError && (
          <p className="text-sm text-muted-foreground">
            Statut de valorisation indisponible (API injoignable).
          </p>
        )}
        {refreshMutation.isError && (
          <p className="text-sm text-destructive">
            Échec du refresh valorisation (voir logs admin).
          </p>
        )}
        {status && (
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Total canonique (EUR)
              </p>
              <p className="mt-1 font-financial text-lg font-semibold">
                {coverage?.totalValueBase !== null && coverage?.totalValueBase !== undefined
                  ? formatMoney(coverage.totalValueBase)
                  : 'Indisponible'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Coverage</p>
              <p className="mt-1 font-financial text-lg font-semibold">
                {coverage?.coveragePercent !== null && coverage?.coveragePercent !== undefined
                  ? `${coverage.coveragePercent}%`
                  : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground/80">
                {coverage ? `${coverage.totalItems} actifs suivis` : 'aucun run'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">FX (ECB)</p>
              <p className="mt-1 text-sm">
                {status.fx.ratesAvailable} taux
                {status.fx.staleRates > 0 ? ` · ${status.fx.staleRates} stale` : ''}
              </p>
              <p className="text-[11px] text-muted-foreground/80">
                {formatDateTime(status.fx.latestRateTimestamp)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Dernier run
              </p>
              <p className="mt-1 text-sm">
                {status.latestRun
                  ? `${status.latestRun.dryRun ? 'dry-run' : 'réel'} · ${status.latestRun.status}`
                  : 'aucun'}
              </p>
              <p className="text-[11px] text-muted-foreground/80">
                {formatDateTime(status.latestRun?.finishedAt ?? null)}
              </p>
            </div>
          </div>
        )}
        {coverage && (
          <div className="flex flex-wrap gap-2">
            {STATUS_LABELS.map(({ key, label }) => {
              const count = coverage.statusCounts[key]
              if (count === 0) {
                return null
              }
              const variant =
                key === 'unresolved' || key === 'unavailable'
                  ? ('destructive' as const)
                  : key === 'stale' || key === 'estimated'
                    ? ('warning' as const)
                    : ('outline' as const)
              return (
                <Badge key={key} variant={variant}>
                  {label}: {count}
                </Badge>
              )
            })}
          </div>
        )}
        {status?.latestRun?.providerFailures && status.latestRun.providerFailures.length > 0 && (
          <div className="space-y-1">
            {status.latestRun.providerFailures.map(failure => (
              <p key={`${failure.provider}-${failure.errorCode}`} className="text-xs text-muted-foreground">
                <span className="font-medium">{failure.provider}</span>: {failure.safeErrorMessage}
              </p>
            ))}
          </div>
        )}
        {unresolved && unresolved.items.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Actifs sans valorisation fiable ({unresolved.items.length})
            </p>
            <ul className="mt-2 space-y-1">
              {unresolved.items.slice(0, 8).map(item => (
                <li key={item.itemKey} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{item.status}</Badge>
                  <span className="truncate">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.provider ?? 'manuel'}
                    {item.errorCode ? ` · ${item.errorCode}` : ''}
                  </span>
                </li>
              ))}
              {unresolved.items.length > 8 && (
                <li className="text-xs text-muted-foreground">
                  +{unresolved.items.length - 8} autres
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
