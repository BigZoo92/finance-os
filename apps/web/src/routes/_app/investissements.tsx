import { css } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
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

const eyebrow = css({
  fontFamily: 'mono',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: 'muted.foreground',
})

// `divide-y divide-border`: a rule between rows, none around the list.
const dividedList = css({
  '& > :not(:last-child)': { borderBottomWidth: '1px', borderColor: 'border' },
})

const allocationRow = css({
  display: 'grid',
  gap: '2',
  py: '4',
  sm: { gridTemplateColumns: '8rem 1fr auto', alignItems: 'center', gap: '4' },
})

const allocationAmount = css({ textStyle: 'sm', sm: { minW: '24', textAlign: 'right' } })

const detailList = css({
  borderYWidth: '1px',
  borderColor: 'border',
  textStyle: 'sm',
  '& > :not(:last-child)': { borderBottomWidth: '1px', borderColor: 'border' },
})

const detailRow = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '4',
  py: '3',
})

const detailLabel = css({ color: 'muted.foreground' })

const totalAmount = css({
  mt: '2',
  display: 'block',
  textStyle: '4xl',
  fontWeight: 'semibold',
  sm: { textStyle: '5xl' },
})

const pnlAmount = css({ mt: '2', display: 'block', textStyle: '2xl', fontWeight: 'semibold' })

const filterGrid = css({
  display: 'grid',
  gap: '2',
  sm: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  lg: { gridTemplateColumns: '12rem 9rem 9rem 9rem' },
})

const searchIcon = css({
  pointerEvents: 'none',
  position: 'absolute',
  left: '3',
  top: '50%',
  translate: '0 -50%',
  color: 'muted.foreground',
})

// The trigger recipe owns `width: fit-content`; a `min-width` stretches it to the
// field without racing that atom (max(fit-content, 100%) is the field width).

const loadingStatus = css({ borderYWidth: '1px', borderColor: 'border', py: '8' })

const visuallyHidden = css({ srOnly: true })

function AllocationList({
  allocations,
}: {
  allocations: ReturnType<typeof buildInvestmentsViewModel>['providerAllocation']
}) {
  if (allocations.length === 0) {
    return (
      <styled.p py="6" textStyle="sm" color="muted.foreground">
        Répartition indisponible
      </styled.p>
    )
  }

  return (
    <div className={dividedList}>
      {allocations.map(allocation => (
        <div key={allocation.key} className={allocationRow}>
          <styled.p textStyle="sm" fontWeight="medium">
            {allocation.label}
          </styled.p>
          <Progress value={allocation.weightPct} label={allocation.label} showValue />
          <Amount value={allocation.value} decimals={0} className={allocationAmount} />
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
      <DialogContent
        smDown={{
          bottom: '0',
          left: '0',
          top: 'auto',
          w: 'full',
          maxW: 'none',
          translate: '0 0',
          roundedBottom: '0',
        }}
      >
        {position ? (
          <>
            <DialogHeader>
              <DialogTitle>{position.asset}</DialogTitle>
              <DialogDescription>
                {providerLabel(position.provider)}
                {position.account ? `, ${position.account}` : ''}
              </DialogDescription>
            </DialogHeader>
            <dl className={detailList}>
              <div className={detailRow}>
                <dt className={detailLabel}>Valeur</dt>
                <dd>
                  <Amount value={position.value} />
                </dd>
              </div>
              <div className={detailRow}>
                <dt className={detailLabel}>Coût d’acquisition</dt>
                <dd>
                  <Amount value={position.costBasis} />
                </dd>
              </div>
              <div className={detailRow}>
                <dt className={detailLabel}>P&amp;L</dt>
                <styled.dd textAlign="right">
                  <Amount value={position.pnlAmount} signed />
                  <PercentChange value={position.pnlPercent} decimals={1} mt="1" />
                </styled.dd>
              </div>
              <div className={detailRow}>
                <dt className={detailLabel}>Classe</dt>
                <dd>{assetClassLabel(position.assetClass)}</dd>
              </div>
              <div className={detailRow}>
                <dt className={detailLabel}>Valorisation</dt>
                <dd>
                  <ValuationState state={position.valuationState} />
                </dd>
              </div>
              <div className={detailRow}>
                <dt className={detailLabel}>Mise à jour</dt>
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
    <styled.div spaceY="8">
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

      <styled.section borderYWidth="1px" borderColor="border" py="6">
        <styled.div
          display="grid"
          gap="6"
          md={{
            gridTemplateColumns: 'minmax(0, 1.3fr) minmax(15rem, 0.7fr)',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <p className={eyebrow}>Valeur connue</p>
            <Amount value={model.totalKnownValue} decimals={0} className={totalAmount} />
            <styled.div mt="3" display="flex" flexWrap="wrap" columnGap="5" rowGap="2">
              <Freshness asOf={externalSummaryQuery.data?.generatedAt} />
              {model.unknownValueCount > 0 ? (
                <Status
                  tone="attention"
                  label={`${model.unknownValueCount} valorisation${model.unknownValueCount > 1 ? 's' : ''} inconnue${model.unknownValueCount > 1 ? 's' : ''}`}
                />
              ) : null}
            </styled.div>
          </div>
          <styled.div
            borderLeftWidth="1px"
            borderColor="border"
            pl="5"
            mdDown={{ borderLeftWidth: '0', borderTopWidth: '1px', pl: '0', pt: '5' }}
          >
            <styled.p textStyle="sm" color="muted.foreground">
              P&amp;L calculable
            </styled.p>
            <Amount value={model.totalPnlKnown} signed decimals={0} className={pnlAmount} />
            <styled.p mt="2" textStyle="xs" color="muted.foreground">
              {model.unknownPnlCount > 0
                ? `${model.unknownPnlCount} position${model.unknownPnlCount > 1 ? 's' : ''} sans P&L fiable`
                : 'Toutes les positions sont couvertes'}
            </styled.p>
          </styled.div>
        </styled.div>
      </styled.section>

      <styled.div display="grid" gap="8" lg={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <section>
          <styled.h2 textStyle="md" fontWeight="semibold">
            Par source
          </styled.h2>
          <AllocationList allocations={model.providerAllocation} />
        </section>
        <section>
          <styled.h2 textStyle="md" fontWeight="semibold">
            Par classe d’actifs
          </styled.h2>
          <AllocationList allocations={model.assetClassAllocation} />
        </section>
      </styled.div>

      <styled.section spaceY="4">
        <styled.div
          display="flex"
          flexDirection="column"
          gap="3"
          lg={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}
        >
          <div>
            <styled.h2 textStyle="lg" fontWeight="semibold">
              Positions
            </styled.h2>
            <styled.p mt="1" textStyle="sm" color="muted.foreground">
              {filteredPositions.length} affichée{filteredPositions.length !== 1 ? 's' : ''}
            </styled.p>
          </div>
          <div className={filterGrid}>
            <styled.label position="relative" htmlFor="investment-search">
              <span className={visuallyHidden}>Rechercher un actif</span>
              <SearchPixelIcon size={14} className={searchIcon} />
              <Input
                id="investment-search"
                value={q}
                onChange={event => updateSearch({ q: event.target.value })}
                placeholder="Rechercher"
                pl="9"
              />
            </styled.label>
            <Select
              value={provider}
              onValueChange={value => updateSearch({ provider: value, account: 'all' })}
            >
              <SelectTrigger w="full" aria-label="Filtrer par source">
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
              <SelectTrigger w="full" aria-label="Filtrer par compte">
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
              <SelectTrigger w="full" aria-label="Filtrer par classe">
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
        </styled.div>

        {isPending && model.positions.length === 0 ? (
          <Status tone="progress" label="Chargement des positions" className={loadingStatus} />
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
      </styled.section>

      <PositionDetail position={selectedPosition} onClose={closePositionDetail} />
    </styled.div>
  )
}
