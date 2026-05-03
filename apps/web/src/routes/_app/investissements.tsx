import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { Badge, Input } from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { dashboardSummaryQueryOptionsWithMode } from '@/features/dashboard-query-options'
import {
  externalInvestmentsCashFlowsQueryOptionsWithMode,
  externalInvestmentsPositionsQueryOptionsWithMode,
  externalInvestmentsSummaryQueryOptionsWithMode,
  externalInvestmentsTradesQueryOptionsWithMode,
} from '@/features/external-investments/query-options'
import type {
  ExternalInvestmentAssetClass,
  ExternalInvestmentProvider,
} from '@/features/external-investments/types'
import type { DashboardRange } from '@/features/dashboard-types'
import { adaptDashboardSummaryLegacy } from '@/features/dashboard-legacy-adapter'
import {
  buildSocialBenchmarkExplainability,
  logSocialBenchmarkExplainabilityEvent,
} from '@/features/social-benchmark-explainability'
import { formatDateTime, formatMoney, formatQuantity } from '@/lib/format'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { KpiTile } from '@/components/surfaces/kpi-tile'
import { ActionDock } from '@/components/surfaces/action-dock'
import { pushToast } from '@/lib/toast-store'
import {
  PersonalActionsPanel,
  PersonalEmptyState,
  PersonalSectionHeading,
  type PersonalActionItem,
} from '@/components/personal/personal-ux'

const searchSchema = z.object({
  range: z.enum(['7d', '30d', '90d']).optional(),
  provider: z.enum(['all', 'ibkr', 'binance']).optional(),
  account: z.string().optional(),
  assetClass: z.string().optional(),
  q: z.string().optional(),
})

const resolveRange = (value: string | undefined): DashboardRange => {
  return value === '7d' || value === '90d' ? value : '30d'
}

const SELECT_CLASS_NAME =
  'flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs'

const providerLabel = (provider: ExternalInvestmentProvider | 'all') => {
  if (provider === 'ibkr') return 'IBKR'
  if (provider === 'binance') return 'Binance'
  return 'Tous'
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
    await Promise.all([
      context.queryClient.ensureQueryData(externalInvestmentsSummaryQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(externalInvestmentsPositionsQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(
        externalInvestmentsTradesQueryOptionsWithMode({ mode, limit: 20 })
      ),
      context.queryClient.ensureQueryData(
        externalInvestmentsCashFlowsQueryOptionsWithMode({ mode, limit: 20 })
      ),
    ])
  },
  component: InvestissementsPage,
})


function InvestissementsPage() {
  const { range: searchRange, provider = 'all', account = 'all', assetClass = 'all', q = '' } =
    Route.useSearch()
  const range = resolveRange(searchRange)
  const navigate = Route.useNavigate()

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
  const externalSummaryQuery = useQuery(
    externalInvestmentsSummaryQueryOptionsWithMode({ ...(authMode ? { mode: authMode } : {}) })
  )
  const externalPositionsQuery = useQuery(
    externalInvestmentsPositionsQueryOptionsWithMode({ ...(authMode ? { mode: authMode } : {}) })
  )
  const externalTradesQuery = useQuery(
    externalInvestmentsTradesQueryOptionsWithMode({
      ...(authMode ? { mode: authMode } : {}),
      limit: 20,
    })
  )
  const externalCashFlowsQuery = useQuery(
    externalInvestmentsCashFlowsQueryOptionsWithMode({
      ...(authMode ? { mode: authMode } : {}),
      limit: 20,
    })
  )
  const adaptedSummary = adaptDashboardSummaryLegacy({
    range, summary: summaryQuery.data, ...(authMode ? { mode: authMode } : {}),
  })
  const positions = adaptedSummary.positions
  const externalPositions = externalPositionsQuery.data?.items ?? []
  const externalBundle = externalSummaryQuery.data?.bundle ?? null
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null)

  const totalValue = positions.reduce(
    (sum, p) => sum + (p.currentValue ?? p.lastKnownValue ?? 0),
    0
  )
  const externalKnownValue = externalBundle?.totalKnownValue ?? 0
  const cryptoExposure = externalBundle?.cryptoExposure
  const binanceKnownValue =
    externalBundle?.allocationByProvider.find(item => item.key === 'binance')?.value ?? 0
  const ibkrKnownValue =
    externalBundle?.allocationByProvider.find(item => item.key === 'ibkr')?.value ?? 0
  const providerOptions = ['all', 'ibkr', 'binance'] as const
  const accountOptions = [
    'all',
    ...Array.from(new Set(externalPositions.map(position => position.accountAlias ?? position.accountExternalId))),
  ]
  const assetClassOptions = [
    'all',
    ...Array.from(new Set(externalPositions.map(position => position.assetClass))),
  ] as Array<'all' | ExternalInvestmentAssetClass>
  const filteredExternalPositions = externalPositions.filter(position => {
    const matchesProvider =
      provider === 'all' || position.provider === (provider as ExternalInvestmentProvider)
    const accountLabel = position.accountAlias ?? position.accountExternalId
    const matchesAccount = account === 'all' || accountLabel === account
    const matchesAssetClass = assetClass === 'all' || position.assetClass === assetClass
    const normalizedQuery = q.trim().toLowerCase()
    const matchesSearch =
      normalizedQuery.length === 0 ||
      `${position.name} ${position.symbol ?? ''} ${position.provider}`.toLowerCase().includes(normalizedQuery)
    return matchesProvider && matchesAccount && matchesAssetClass && matchesSearch
  })
  const externalTrades = externalTradesQuery.data?.items ?? []
  const externalCashFlows = externalCashFlowsQuery.data?.items ?? []
  const qualityWarningCount =
    (externalBundle?.unknownCostBasisWarnings.length ?? 0) +
    (externalBundle?.missingMarketDataWarnings.length ?? 0) +
    (externalBundle?.staleDataWarnings.length ?? 0)
  const investmentActions: PersonalActionItem[] = [
    {
      label: qualityWarningCount > 0 ? 'Vérifier les données' : 'Contrôler les intégrations',
      description:
        qualityWarningCount > 0
          ? `${qualityWarningCount} alerte${qualityWarningCount > 1 ? 's' : ''}: coût, prix ou fraîcheur à clarifier.`
          : 'S’assurer que les snapshots IBKR/Binance sont bien récents.',
      to: '/integrations',
      icon: '⊞',
      tone: qualityWarningCount > 0 ? 'warning' : 'plain',
    },
    {
      label: "Demander à l'Advisor",
      description: 'Comprendre les risques, la concentration ou les données manquantes.',
      to: '/ia/chat',
      icon: '□',
      tone: 'brand',
    },
    {
      label: 'Voir le patrimoine global',
      description: 'Replacer les investissements dans l’ensemble de tes actifs.',
      to: '/patrimoine',
      icon: '◇',
      tone: 'plain',
    },
  ]
  const updateExternalSearch = (next: {
    provider?: ExternalInvestmentProvider | 'all'
    account?: string
    assetClass?: string
    q?: string
  }) =>
    navigate({
      search: {
        range,
        provider: next.provider ?? provider,
        account: next.account ?? account,
        assetClass: next.assetClass ?? assetClass,
        q: next.q ?? q,
      },
    })
  const explainabilityModel = useMemo(
    () =>
      buildSocialBenchmarkExplainability({
        mode: authMode ?? 'unknown',
        positions: adaptedSummary.positions,
        assets: adaptedSummary.assets,
      }),
    [adaptedSummary.assets, adaptedSummary.positions, authMode]
  )

  useEffect(() => {
    logSocialBenchmarkExplainabilityEvent(explainabilityModel)
  }, [explainabilityModel])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cockpit personnel"
        icon="△"
        title="Investissements"
        description="Ce que tu détiens, ce qui est valorisé, et ce qui doit rester en lecture seule ou à vérifier."
      />

      <section className="space-y-4">
        <PersonalSectionHeading
          eyebrow="Aujourd'hui"
          title="Ton portefeuille en clair"
          description="Les providers restent en arrière-plan; la première lecture porte sur les montants et la qualité des données."
        />
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
        <KpiTile
          label="Externe connu"
          value={externalKnownValue}
          display={formatMoney(externalKnownValue)}
          tone="positive"
          loading={externalSummaryQuery.isPending}
          hint={`${externalPositions.length} position${externalPositions.length !== 1 ? 's' : ''} IBKR/Binance`}
        />
        <KpiTile
          label="Crypto connu"
          value={cryptoExposure?.value ?? 0}
          display={formatMoney(cryptoExposure?.value ?? 0)}
          tone={cryptoExposure && cryptoExposure.unknownValueCount > 0 ? 'warning' : 'violet'}
          loading={externalSummaryQuery.isPending}
          hint={`${cryptoExposure?.weightPct ?? 0}% du portefeuille externe valorise`}
        />
      </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title={qualityWarningCount > 0 ? 'Données à vérifier' : 'Données de portefeuille utilisables'}
          description="Coût d'achat, prix de marché et fraîcheur changent le niveau de confiance, pas les garde-fous read-only."
          icon={<span aria-hidden="true">△</span>}
          tone={qualityWarningCount > 0 ? 'warning' : 'positive'}
        >
          {qualityWarningCount > 0 ? (
            <div className="space-y-2 text-sm">
              {externalBundle?.unknownCostBasisWarnings.slice(0, 2).map(item => (
                <p key={item} className="text-warning">Coût inconnu: {item}</p>
              ))}
              {externalBundle?.missingMarketDataWarnings.slice(0, 2).map(item => (
                <p key={item} className="text-warning">Prix manquant: {item}</p>
              ))}
              {externalBundle?.staleDataWarnings.slice(0, 2).map(item => (
                <p key={item} className="text-warning">Donnée ancienne: {item}</p>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Aucune alerte majeure sur les positions chargées. Les données externes restent lues depuis le cache.
            </p>
          )}
        </Panel>
        <PersonalActionsPanel
          title="Prochaines actions"
          description="Comprendre et vérifier, sans action de marché."
          items={investmentActions}
        />
      </section>

      <PersonalSectionHeading
        eyebrow="Mes données"
        title="Positions et allocations"
        description="Les détails provider sont disponibles, mais secondaires par rapport à tes avoirs."
      />

      <Panel
        title="Portefeuille externe"
        description="Positions IBKR Flex et Binance Spot lues depuis le cache. Aucun ordre, aucune exécution."
        icon={<span aria-hidden="true">◇</span>}
        tone="brand"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border/50 bg-surface-1 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">IBKR</p>
            <p className="font-financial mt-1 text-lg font-semibold">{formatMoney(ibkrKnownValue)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Reporting Flex uniquement.</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-surface-1 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Binance</p>
            <p className="font-financial mt-1 text-lg font-semibold">{formatMoney(binanceKnownValue)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Spot USER_DATA / Wallet en lecture seule.</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-surface-1 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Qualite</p>
            <p className="mt-1 text-lg font-semibold">{qualityWarningCount === 0 ? 'OK' : `${qualityWarningCount} alerte${qualityWarningCount !== 1 ? 's' : ''}`}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {externalBundle?.confidence ? `Confiance ${externalBundle.confidence}` : 'Bundle non genere'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">Provider</span>
            <select
              value={provider}
              onChange={event =>
                updateExternalSearch({
                  provider: event.target.value as ExternalInvestmentProvider | 'all',
                })
              }
              className={SELECT_CLASS_NAME}
            >
              {providerOptions.map(option => (
                <option key={option} value={option}>
                  {providerLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">Compte</span>
            <select
              value={account}
              onChange={event => updateExternalSearch({ account: event.target.value })}
              className={SELECT_CLASS_NAME}
            >
              {accountOptions.map(option => (
                <option key={option} value={option}>
                  {option === 'all' ? 'Tous' : option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">Classe</span>
            <select
              value={assetClass}
              onChange={event => updateExternalSearch({ assetClass: event.target.value })}
              className={SELECT_CLASS_NAME}
            >
              {assetClassOptions.map(option => (
                <option key={option} value={option}>
                  {option === 'all' ? 'Toutes' : option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm" htmlFor="external-investment-search">
            <span className="text-muted-foreground">Recherche</span>
            <Input
              id="external-investment-search"
              value={q}
              onChange={event => updateExternalSearch({ q: event.target.value })}
              placeholder="Symbole, nom, provider..."
            />
          </label>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-4">Position</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3 text-right">Quantite</th>
                <th className="px-4 py-3 text-right">Valeur</th>
                <th className="px-4 py-3 text-right">P/L</th>
                <th className="py-3 pl-4">Qualite</th>
              </tr>
            </thead>
            <tbody>
              {externalPositionsQuery.isPending ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Chargement du cache externe...
                  </td>
                </tr>
              ) : filteredExternalPositions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Aucune position externe pour ces filtres. Efface la recherche ou choisis "Tous".
                  </td>
                </tr>
              ) : (
                filteredExternalPositions.map(position => {
                  const value = position.normalizedValue ?? position.providerValue
                  const pnl = position.unrealizedPnl ?? position.realizedPnl
                  return (
                    <tr key={position.positionKey} className="border-b border-border/50">
                      <td className="py-3 pr-4">
                        <p className="font-medium">{position.symbol ?? position.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {position.name} · {position.assetClass}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={position.provider === 'ibkr' ? 'violet' : 'default'}>
                          {providerLabel(position.provider)}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {position.accountAlias ?? position.accountExternalId}
                        </p>
                      </td>
                      <td className="font-financial px-4 py-3 text-right">
                        {formatQuantity(position.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-financial font-medium">
                          {value === null
                            ? '-'
                            : formatMoney(value, position.valueCurrency ?? position.currency ?? 'EUR')}
                        </p>
                        <p className="text-xs text-muted-foreground">{position.valueSource}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p
                          className={`font-financial ${
                            pnl === null ? 'text-muted-foreground' : pnl >= 0 ? 'text-positive' : 'text-negative'
                          }`}
                        >
                          {pnl === null ? '-' : formatMoney(pnl, position.valueCurrency ?? 'EUR')}
                        </p>
                      </td>
                      <td className="py-3 pl-4">
                        <div className="flex flex-wrap gap-1.5">
                          {position.costBasis === null && <Badge variant="warning">cout inconnu</Badge>}
                          {position.valueSource === 'unknown' && <Badge variant="warning">valeur inconnue</Badge>}
                          {position.degradedReasons.map(reason => (
                            <Badge key={reason} variant="outline">
                              {reason}
                            </Badge>
                          ))}
                          {position.degradedReasons.length === 0 &&
                            position.costBasis !== null &&
                            position.valueSource !== 'unknown' && <Badge variant="positive">OK</Badge>}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {externalBundle && (
          <div className="mt-4 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
            <p>Provider coverage: {externalBundle.providerCoverage.map(item => `${providerLabel(item.provider)} ${item.status}`).join(' · ')}</p>
            <p>Valeurs inconnues: {externalBundle.unknownValuePositionCount}</p>
            <p>Hypotheses: {externalBundle.assumptions.slice(0, 2).join(' · ') || '-'}</p>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Mouvements récents"
          description="Historique lu en cache pour comprendre ce qui a changé."
          icon={<span aria-hidden="true">↕</span>}
          tone="violet"
        >
          {externalTrades.length === 0 ? (
            <PersonalEmptyState
              title="Aucun mouvement en cache"
              description="Les trades apparaîtront ici après ingestion read-only depuis les rapports ou APIs autorisés."
            />
          ) : (
            <div className="space-y-2">
              {externalTrades.slice(0, 6).map(trade => (
                <div key={trade.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-surface-1 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{trade.symbol ?? 'Instrument inconnu'}</p>
                    <p className="text-xs text-muted-foreground">
                      {providerLabel(trade.provider)} · {formatDateTime(trade.tradedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={trade.side === 'buy' ? 'positive' : trade.side === 'sell' ? 'destructive' : 'outline'}>
                      {trade.side}
                    </Badge>
                    <p className="font-financial mt-1 text-xs text-muted-foreground">
                      {trade.netAmount === null ? formatQuantity(trade.quantity) : formatMoney(trade.netAmount, trade.currency ?? 'EUR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Flux cash" description="Entrées et sorties de cash liées aux providers externes." icon={<span aria-hidden="true">⇄</span>} tone="positive">
          {externalCashFlows.length === 0 ? (
            <PersonalEmptyState
              title="Aucun flux cash en cache"
              description="Aucune entrée ou sortie externe n'est disponible pour cette période."
            />
          ) : (
            <div className="space-y-2">
              {externalCashFlows.slice(0, 6).map(flow => (
                <div key={flow.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-surface-1 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{flow.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {providerLabel(flow.provider)} · {formatDateTime(flow.occurredAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-financial text-sm font-medium">
                      {flow.amount === null ? '-' : formatQuantity(flow.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{flow.currency ?? flow.asset ?? '-'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Positions */}
      <Panel title="Positions internes" description="Positions déjà présentes dans le résumé patrimonial." icon={<span aria-hidden="true">△</span>} tone="brand">
          {summaryQuery.isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, index) => `investments-position-skeleton-${index + 1}`).map(key => (
                <div key={key} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : positions.length === 0 ? (
            <PersonalEmptyState
              title="Aucune position active"
              description="Tes positions apparaîtront ici quand elles seront présentes dans les données du cockpit."
            />
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

      {explainabilityModel.enabled && (
        <Panel title="Pourquoi ce benchmark diffère" icon={<span aria-hidden="true">◉</span>} tone="violet">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Résumé: lecture heuristique non-conseil. Les benchmarks bruts restent affichés même en fallback.
            </p>
            <div className="rounded-lg border border-border/50 bg-surface-1 p-3 text-xs text-muted-foreground">
              <p className="font-mono uppercase tracking-[0.16em]">Trace</p>
              <p className="mt-1 font-mono">{explainabilityModel.traceId}</p>
              {explainabilityModel.staleInsight && (
                <p className="mt-2 text-warning">
                  Données potentiellement anciennes: narration générée avec confiance réduite.
                </p>
              )}
            </div>
            <div className="space-y-2">
              {explainabilityModel.insights.map(insight => {
                const expanded = expandedInsightId === insight.id
                return (
                  <div key={insight.id} className="rounded-lg border border-border/60 bg-surface-1/70 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{insight.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{insight.summary}</p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                          insight.confidence === 'high'
                            ? 'bg-positive/15 text-positive'
                            : insight.confidence === 'medium'
                              ? 'bg-warning/15 text-warning'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        confiance {insight.confidence}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
                      aria-expanded={expanded}
                      onClick={() => setExpandedInsightId(expanded ? null : insight.id)}
                    >
                      {expanded ? 'Masquer le détail' : 'Afficher le détail'}
                    </button>
                    {expanded && (
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <p>{insight.detail}</p>
                        {insight.fallbackReason && (
                          <p className="text-warning">Fallback: {insight.fallbackReason}</p>
                        )}
                        <p className="font-mono">
                          Règles: {insight.ruleHits.join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {explainabilityModel.generationFailed && (
              <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
                Génération narrative indisponible ({explainabilityModel.failureReason}). Les benchmarks de base
                restent visibles.
              </p>
            )}
          </div>
        </Panel>
      )}

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
