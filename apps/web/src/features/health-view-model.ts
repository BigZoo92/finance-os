import type { DashboardDerivedRecomputeStatusResponse } from './dashboard-types'
import type { ExternalInvestmentStatusResponse } from './external-investments/types'
import type { PowensStatusResponse } from './powens/types'
import type { ValuationStatusResponse, ValuationUnresolvedResponse } from './valuation/types'
import type { XHealthResponse } from './x-twitter-api'

export type HealthProviderState =
  | 'connected'
  | 'up_to_date'
  | 'syncing'
  | 'attention'
  | 'reconnect_required'
  | 'error'
  | 'configured'
  | 'not_configured'
  | 'unavailable'

export type HealthProvider = {
  id: 'powens' | 'ibkr' | 'binance'
  label: string
  state: HealthProviderState
  detail: string
  needsAction: boolean
}

export type HealthFreshness = {
  id: 'accounts' | 'investments' | 'social' | 'advisor' | 'valuation'
  label: string
  asOf: string | null
}

export type HealthProblem = {
  id: string
  label: string
  detail: string
  destination: '/integrations' | '/orchestration' | null
}

export type HealthViewModel = {
  state: 'healthy' | 'degraded' | 'unknown'
  headline: string
  summary: string
  providers: HealthProvider[]
  freshness: HealthFreshness[]
  problems: HealthProblem[]
  valuation: {
    coveragePercent: number | null
    totalItems: number | null
    resolvedItems: number | null
    unresolvedItems: number | null
    statusCounts:
      | NonNullable<NonNullable<ValuationStatusResponse['latestRun']>['coverage']>['statusCounts']
      | null
  }
}

const latestDate = (values: Array<string | null | undefined>): string | null => {
  const latest = values
    .filter((value): value is string => Boolean(value))
    .map(value => new Date(value).getTime())
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0]
  return latest === undefined ? null : new Date(latest).toISOString()
}

const externalProvider = (
  provider: 'ibkr' | 'binance',
  status: ExternalInvestmentStatusResponse | null | undefined
): HealthProvider => {
  const configured = status?.providerConfigured[provider]
  const health = status?.health.find(item => item.provider === provider)
  const label = provider === 'ibkr' ? 'IBKR' : 'Binance'
  if (configured === undefined) {
    return {
      id: provider,
      label,
      state: 'unavailable',
      detail: 'Statut indisponible',
      needsAction: false,
    }
  }
  if (!configured) {
    return {
      id: provider,
      label,
      state: 'not_configured',
      detail: 'Aucune connexion active',
      needsAction: false,
    }
  }
  if (health?.status === 'failing') {
    return {
      id: provider,
      label,
      state: 'error',
      detail: 'La dernière synchronisation a échoué',
      needsAction: true,
    }
  }
  if (health?.status === 'degraded' || status?.safeModeActive) {
    return {
      id: provider,
      label,
      state: 'attention',
      detail: 'Certaines données demandent une vérification',
      needsAction: true,
    }
  }
  if (health?.status === 'healthy') {
    return {
      id: provider,
      label,
      state: 'up_to_date',
      detail: 'Connexion opérationnelle',
      needsAction: false,
    }
  }
  return {
    id: provider,
    label,
    state: 'configured',
    detail: 'En attente d’une première synchronisation',
    needsAction: false,
  }
}

export const createHealthViewModel = ({
  powens,
  external,
  derived,
  valuation,
  unresolved,
  xHealth,
}: {
  powens: PowensStatusResponse | null | undefined
  external: ExternalInvestmentStatusResponse | null | undefined
  derived: DashboardDerivedRecomputeStatusResponse | null | undefined
  valuation: ValuationStatusResponse | null | undefined
  unresolved: ValuationUnresolvedResponse | null | undefined
  xHealth: XHealthResponse | null | undefined
}): HealthViewModel => {
  const connections = powens?.connections ?? []
  const powensHasReconnect = connections.some(
    connection => connection.status === 'reconnect_required'
  )
  const powensHasError = connections.some(connection => connection.status === 'error')
  const powensSyncing = connections.some(connection => connection.status === 'syncing')
  const powensProvider: HealthProvider = !powens
    ? {
        id: 'powens',
        label: 'Powens',
        state: 'unavailable',
        detail: 'Statut indisponible',
        needsAction: false,
      }
    : powensHasReconnect
      ? {
          id: 'powens',
          label: 'Powens',
          state: 'reconnect_required',
          detail: 'Une banque doit être reconnectée',
          needsAction: true,
        }
      : powensHasError || powens.safeModeActive
        ? {
            id: 'powens',
            label: 'Powens',
            state: 'error',
            detail: 'Une connexion demande une intervention',
            needsAction: true,
          }
        : powensSyncing
          ? {
              id: 'powens',
              label: 'Powens',
              state: 'syncing',
              detail: 'Synchronisation en cours',
              needsAction: false,
            }
          : connections.length > 0
            ? {
                id: 'powens',
                label: 'Powens',
                state: 'connected',
                detail: `${connections.length} connexion${connections.length > 1 ? 's' : ''} active${connections.length > 1 ? 's' : ''}`,
                needsAction: false,
              }
            : {
                id: 'powens',
                label: 'Powens',
                state: 'not_configured',
                detail: 'Aucune banque connectée',
                needsAction: false,
              }

  const providers = [
    powensProvider,
    externalProvider('ibkr', external),
    externalProvider('binance', external),
  ]
  const coverage = valuation?.latestRun?.coverage ?? null
  const unresolvedCount = coverage?.unknownValueCount ?? unresolved?.items.length ?? null
  const totalItems = coverage?.totalItems ?? unresolved?.totalItems ?? null
  const resolvedItems =
    totalItems === null || unresolvedCount === null
      ? null
      : Math.max(0, totalItems - unresolvedCount)
  const problems: HealthProblem[] = providers
    .filter(provider => provider.needsAction)
    .map(provider => ({
      id: `provider-${provider.id}`,
      label: `${provider.label} demande une intervention`,
      detail: provider.detail,
      destination: '/integrations' as const,
    }))

  if (unresolvedCount && unresolvedCount > 0) {
    problems.push({
      id: 'valuation-unresolved',
      label: `${unresolvedCount} actif${unresolvedCount > 1 ? 's' : ''} sans valorisation fiable`,
      detail: 'Consulter les actifs concernés',
      destination: null,
    })
  }
  if (derived?.state === 'failed') {
    problems.push({
      id: 'derived-failed',
      label: 'Le recalcul des données a échoué',
      detail: 'Relancer le job depuis Orchestration',
      destination: '/orchestration',
    })
  }

  const hasUnknown = providers.some(provider => provider.state === 'unavailable') || !valuation
  const state = problems.length > 0 ? 'degraded' : hasUnknown ? 'unknown' : 'healthy'

  return {
    state,
    headline:
      state === 'healthy'
        ? 'Tout fonctionne'
        : state === 'degraded'
          ? 'Une intervention est requise'
          : 'État incomplet',
    summary:
      state === 'healthy'
        ? 'Les connexions et calculs suivis sont opérationnels.'
        : state === 'degraded'
          ? `${problems.length} problème${problems.length > 1 ? 's' : ''} à examiner`
          : 'Une partie des informations est temporairement indisponible.',
    providers,
    freshness: [
      {
        id: 'accounts',
        label: 'Comptes',
        asOf: latestDate(connections.map(connection => connection.lastSuccessAt)),
      },
      {
        id: 'investments',
        label: 'Investissements',
        asOf: latestDate(external?.health.map(item => item.lastSuccessAt) ?? []),
      },
      { id: 'social', label: 'Social', asOf: xHealth?.lastDailyRunStartedAt ?? null },
      { id: 'advisor', label: 'Advisor', asOf: derived?.latestRun?.finishedAt ?? null },
      { id: 'valuation', label: 'Valorisation', asOf: valuation?.latestRun?.finishedAt ?? null },
    ],
    problems,
    valuation: {
      coveragePercent: coverage?.coveragePercent ?? null,
      totalItems,
      resolvedItems,
      unresolvedItems: unresolvedCount,
      statusCounts: coverage?.statusCounts ?? null,
    },
  }
}
