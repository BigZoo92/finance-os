import {
  Amount,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Freshness,
  Input,
  PercentChange,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Status,
  ValuationState,
} from '@finance-os/ui/components'
import { SearchPixelIcon, TrendingPixelIcon } from '@finance-os/ui/icons/pixel'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import { PositionsTable } from '@/components/data/positions-table'
import { PersonalEmptyState } from '@/components/personal/personal-ux'
import { PageHeader } from '@/components/surfaces/page-header'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { dashboardSummaryQueryOptionsWithMode } from '@/features/dashboard-query-options'
import type { DashboardRange } from '@/features/dashboard-types'
import {
  externalInvestmentsPositionsQueryOptionsWithMode,
  externalInvestmentsSummaryQueryOptionsWithMode,
} from '@/features/external-investments/query-options'
import type { ExternalInvestmentAssetClass } from '@/features/external-investments/types'
import {
  buildInvestmentsViewModel,
  type InvestmentPositionRow,
} from '@/features/investments/view-model'

const searchSchema = z.object({
  range: z.enum(['7d', '30d', '90d']).optional(),
  provider: z.string().optional(),
  account: z.string().optional(),
  assetClass: z.string().optional(),
  q: z.string().optional(),
})

const resolveRange = (value: string | undefined): DashboardRange => {
  return value === '7d' || value === '90d' ? value : '30d'
}

const providerLabel = (provider: string) => {
  if (provider === 'ibkr') return 'IBKR'
  if (provider === 'binance') return 'Binance'
  if (provider === 'powens') return 'Powens'
  if (provider === 'manual') return 'Manuel'
  return provider
}

const assetClassLabel = (assetClass: ExternalInvestmentAssetClass) => {
  if (assetClass === 'equity') return 'Actions'
  if (assetClass === 'etf') return 'ETF'
  if (assetClass === 'crypto') return 'Crypto'
  if (assetClass === 'stablecoin') return 'Stablecoins'
  if (assetClass === 'fund') return 'Fonds'
  if (assetClass === 'bond') return 'Obligations'
  if (assetClass === 'commodity') return 'Matières premières'
  if (assetClass === 'cash') return 'Liquidités'
  return 'Non classé'
}

export const Route = createFileRoute('/_app/investissements')({
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
      context.queryClient.ensureQueryData(externalInvestmentsSummaryQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(
        externalInvestmentsPositionsQueryOptionsWithMode({ mode })
      ),
    ])
  },
  component: InvestissementsPage,
})

function AllocationList({
  allocations,
}: {
  allocations: ReturnType<typeof buildInvestmentsViewModel>['providerAllocation']
}) {
  if (allocations.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">Répartition indisponible</p>
  }

  return (
    <div className="divide-y divide-border">
      {allocations.map(allocation => (
        <div
          key={allocation.key}
          className="grid gap-2 py-4 sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:gap-4"
        >
          <p className="text-sm font-medium">{allocation.label}</p>
          <Progress value={allocation.weightPct} label={allocation.label} showValue />
          <Amount
            value={allocation.value}
            decimals={0}
            className="text-sm sm:min-w-24 sm:text-right"
          />
        </div>
      ))}
    </div>
  )
}

function PositionDetail({
  position,
  onClose,
}: {
  position: InvestmentPositionRow | null
  onClose: () => void
}) {
  return (
    <Dialog open={position !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none">
        {position ? (
          <>
            <DialogHeader>
              <DialogTitle>{position.asset}</DialogTitle>
              <DialogDescription>
                {providerLabel(position.provider)}
                {position.account ? `, ${position.account}` : ''}
              </DialogDescription>
            </DialogHeader>
            <dl className="divide-y divide-border border-y border-border text-sm">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Valeur</dt>
                <dd>
                  <Amount value={position.value} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Coût d’acquisition</dt>
                <dd>
                  <Amount value={position.costBasis} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-muted-foreground">P&amp;L</dt>
                <dd className="text-right">
                  <Amount value={position.pnlAmount} signed />
                  <PercentChange value={position.pnlPercent} decimals={1} className="mt-1" />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Classe</dt>
                <dd>{assetClassLabel(position.assetClass)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Valorisation</dt>
                <dd>
                  <ValuationState state={position.valuationState} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Mise à jour</dt>
                <dd>
                  <Freshness asOf={position.valuedAt} />
                </dd>
              </div>
            </dl>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Fermer
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function InvestissementsPage() {
  const {
    range: searchRange,
    provider = 'all',
    account = 'all',
    assetClass = 'all',
    q = '',
  } = Route.useSearch()
  const range = resolveRange(searchRange)
  const navigate = Route.useNavigate()
  const [selectedPosition, setSelectedPosition] = useState<InvestmentPositionRow | null>(null)
  const positionTriggerRef = useRef<HTMLButtonElement | null>(null)

  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const authMode: AuthMode | undefined =
    authViewState === 'admin' ? 'admin' : authViewState === 'demo' ? 'demo' : undefined

  const summaryQuery = useQuery(
    dashboardSummaryQueryOptionsWithMode({ range, ...(authMode ? { mode: authMode } : {}) })
  )
  const externalSummaryQuery = useQuery(
    externalInvestmentsSummaryQueryOptionsWithMode({ ...(authMode ? { mode: authMode } : {}) })
  )
  const externalPositionsQuery = useQuery(
    externalInvestmentsPositionsQueryOptionsWithMode({ ...(authMode ? { mode: authMode } : {}) })
  )

  const model = useMemo(
    () =>
      buildInvestmentsViewModel({
        summary: summaryQuery.data,
        externalPositions: externalPositionsQuery.data?.items ?? [],
        externalBundle: externalSummaryQuery.data?.bundle,
      }),
    [externalPositionsQuery.data?.items, externalSummaryQuery.data?.bundle, summaryQuery.data]
  )

  const providerOptions = ['all', ...new Set(model.positions.map(position => position.provider))]
  const accountOptions = [
    'all',
    ...new Set(model.positions.flatMap(position => (position.account ? [position.account] : []))),
  ]
  const assetClassOptions = [
    'all',
    ...new Set(model.positions.map(position => position.assetClass)),
  ]
  const normalizedQuery = q.trim().toLowerCase()
  const filteredPositions = model.positions.filter(position => {
    const matchesProvider = provider === 'all' || position.provider === provider
    const matchesAccount = account === 'all' || position.account === account
    const matchesAssetClass = assetClass === 'all' || position.assetClass === assetClass
    const matchesSearch =
      normalizedQuery.length === 0 ||
      `${position.asset} ${position.symbol ?? ''}`.toLowerCase().includes(normalizedQuery)
    return matchesProvider && matchesAccount && matchesAssetClass && matchesSearch
  })
  const updateSearch = (
    next: Partial<{ provider: string; account: string; assetClass: string; q: string }>
  ) =>
    navigate({
      search: {
        range,
        provider: next.provider ?? provider,
        account: next.account ?? account,
        assetClass: next.assetClass ?? assetClass,
        q: next.q ?? q,
      },
    })

  const isPending =
    authQuery.isPending ||
    summaryQuery.isPending ||
    externalSummaryQuery.isPending ||
    externalPositionsQuery.isPending
  const hasError =
    summaryQuery.isError || externalSummaryQuery.isError || externalPositionsQuery.isError
  const dataStatus = externalSummaryQuery.data?.dataStatus
  const closePositionDetail = () => {
    setSelectedPosition(null)
    window.requestAnimationFrame(() => positionTriggerRef.current?.focus())
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Portefeuille"
        icon={<TrendingPixelIcon size={12} />}
        title="Investissements"
        status={
          dataStatus?.status === 'degraded' ? (
            <Status tone="attention" label="Données partielles" />
          ) : hasError ? (
            <Status tone="attention" label="Une source est indisponible" />
          ) : isPending ? (
            <Status tone="progress" label="Chargement" />
          ) : (
            <Status tone="positive" label="Portefeuille consolidé" />
          )
        }
      />

      <section className="border-y border-border py-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(15rem,0.7fr)] md:items-end">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Valeur connue
            </p>
            <Amount
              value={model.totalKnownValue}
              decimals={0}
              className="mt-2 block text-4xl font-semibold sm:text-5xl"
            />
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              <Freshness asOf={externalSummaryQuery.data?.generatedAt} />
              {model.unknownValueCount > 0 ? (
                <Status
                  tone="attention"
                  label={`${model.unknownValueCount} valorisation${model.unknownValueCount > 1 ? 's' : ''} inconnue${model.unknownValueCount > 1 ? 's' : ''}`}
                />
              ) : null}
            </div>
          </div>
          <div className="border-l border-border pl-5 max-md:border-l-0 max-md:border-t max-md:pl-0 max-md:pt-5">
            <p className="text-sm text-muted-foreground">P&amp;L calculable</p>
            <Amount
              value={model.totalPnlKnown}
              signed
              decimals={0}
              className="mt-2 block text-2xl font-semibold"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {model.unknownPnlCount > 0
                ? `${model.unknownPnlCount} position${model.unknownPnlCount > 1 ? 's' : ''} sans P&L fiable`
                : 'Toutes les positions sont couvertes'}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-base font-semibold">Par source</h2>
          <AllocationList allocations={model.providerAllocation} />
        </section>
        <section>
          <h2 className="text-base font-semibold">Par classe d’actifs</h2>
          <AllocationList allocations={model.assetClassAllocation} />
        </section>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Positions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredPositions.length} affichée{filteredPositions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[12rem_9rem_9rem_9rem]">
            <label className="relative" htmlFor="investment-search">
              <span className="sr-only">Rechercher un actif</span>
              <SearchPixelIcon
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="investment-search"
                value={q}
                onChange={event => updateSearch({ q: event.target.value })}
                placeholder="Rechercher"
                className="pl-9"
              />
            </label>
            <Select
              value={provider}
              onValueChange={value => updateSearch({ provider: value, account: 'all' })}
            >
              <SelectTrigger className="w-full" aria-label="Filtrer par source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerOptions.map(value => (
                  <SelectItem key={value} value={value}>
                    {value === 'all' ? 'Toutes sources' : providerLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={account} onValueChange={value => updateSearch({ account: value })}>
              <SelectTrigger className="w-full" aria-label="Filtrer par compte">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.map(value => (
                  <SelectItem key={value} value={value}>
                    {value === 'all' ? 'Tous comptes' : value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={assetClass} onValueChange={value => updateSearch({ assetClass: value })}>
              <SelectTrigger className="w-full" aria-label="Filtrer par classe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assetClassOptions.map(value => (
                  <SelectItem key={value} value={value}>
                    {value === 'all'
                      ? 'Toutes classes'
                      : assetClassLabel(value as ExternalInvestmentAssetClass)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isPending && model.positions.length === 0 ? (
          <Status
            tone="progress"
            label="Chargement des positions"
            className="border-y border-border py-8"
          />
        ) : hasError && model.positions.length === 0 ? (
          <PersonalEmptyState
            title="Positions indisponibles"
            description="Une ou plusieurs sources ne répondent pas. Le reste du cockpit reste accessible."
          />
        ) : filteredPositions.length === 0 ? (
          <PersonalEmptyState
            title="Aucune position"
            description="Aucune position ne correspond à ces filtres."
          />
        ) : (
          <PositionsTable
            positions={filteredPositions}
            onSelect={(position, trigger) => {
              positionTriggerRef.current = trigger
              setSelectedPosition(position)
            }}
          />
        )}
      </section>

      <PositionDetail position={selectedPosition} onClose={closePositionDetail} />
    </div>
  )
}
