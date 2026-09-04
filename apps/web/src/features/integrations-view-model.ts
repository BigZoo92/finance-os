import type {
  ExternalInvestmentProvider,
  ExternalInvestmentStatusResponse,
} from './external-investments/types'
import type { PowensStatusResponse } from './powens/types'

export type IntegrationProviderId = 'powens' | ExternalInvestmentProvider
export type IntegrationPrimaryAction = 'connect' | 'reconnect' | 'sync' | 'none'
export type IntegrationProviderState =
  | 'connected'
  | 'up_to_date'
  | 'syncing'
  | 'attention'
  | 'reconnect_required'
  | 'error'
  | 'configured'
  | 'not_configured'
  | 'unavailable'

export type IntegrationProviderModel = {
  id: IntegrationProviderId
  label: string
  role: string
  state: IntegrationProviderState
  lastSyncAt: string | null
  detail: string
  primaryAction: IntegrationPrimaryAction
  primaryActionLabel: string | null
  safeMode: boolean
}

const latestDate = (values: Array<string | null | undefined>): string | null => {
  const timestamp = values
    .filter((value): value is string => Boolean(value))
    .map(value => new Date(value).getTime())
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0]
  return timestamp === undefined ? null : new Date(timestamp).toISOString()
}

const externalProvider = (
  provider: ExternalInvestmentProvider,
  response: ExternalInvestmentStatusResponse | null | undefined
): IntegrationProviderModel => {
  const label = provider === 'ibkr' ? 'IBKR' : 'Binance'
  const role =
    provider === 'ibkr'
      ? 'Portefeuille titres en lecture seule'
      : 'Portefeuille crypto en lecture seule'
  const configured = response?.providerConfigured[provider]
  const health = response?.health.find(item => item.provider === provider)
  const connection = response?.connections.find(item => item.provider === provider)
  const safeMode = response?.safeModeActive ?? false
  const base = {
    id: provider,
    label,
    role,
    lastSyncAt: health?.lastSuccessAt ?? connection?.lastSuccessAt ?? null,
    safeMode,
  }
  if (configured === undefined) {
    return {
      ...base,
      state: 'unavailable',
      detail: 'Statut indisponible',
      primaryAction: 'none',
      primaryActionLabel: null,
    }
  }
  if (!configured) {
    return {
      ...base,
      state: 'not_configured',
      detail: 'Aucune connexion active',
      primaryAction: 'none',
      primaryActionLabel: null,
    }
  }
  if (health?.status === 'failing') {
    return {
      ...base,
      state: 'error',
      detail: 'La dernière synchronisation a échoué',
      primaryAction: 'sync',
      primaryActionLabel: 'Relancer',
    }
  }
  if (health?.status === 'degraded') {
    return {
      ...base,
      state: 'attention',
      detail: 'Certaines données sont incomplètes',
      primaryAction: 'sync',
      primaryActionLabel: 'Synchroniser',
    }
  }
  if (health?.status === 'healthy') {
    return {
      ...base,
      state: 'up_to_date',
      detail: 'Connexion opérationnelle',
      primaryAction: 'sync',
      primaryActionLabel: 'Synchroniser',
    }
  }
  return {
    ...base,
    state: 'configured',
    detail: 'Prêt pour une première synchronisation',
    primaryAction: 'sync',
    primaryActionLabel: 'Synchroniser',
  }
}

export const createIntegrationProviders = ({
  powens,
  external,
}: {
  powens: PowensStatusResponse | null | undefined
  external: ExternalInvestmentStatusResponse | null | undefined
}): IntegrationProviderModel[] => {
  const connections = powens?.connections ?? []
  const reconnectRequired = connections.some(
    connection => connection.status === 'reconnect_required'
  )
  const failed = connections.some(connection => connection.status === 'error')
  const syncing = connections.some(connection => connection.status === 'syncing')
  const powensModel: IntegrationProviderModel = !powens
    ? {
        id: 'powens',
        label: 'Powens',
        role: 'Comptes bancaires et transactions',
        state: 'unavailable',
        lastSyncAt: null,
        detail: 'Statut indisponible',
        primaryAction: 'none',
        primaryActionLabel: null,
        safeMode: false,
      }
    : {
        id: 'powens',
        label: 'Powens',
        role: 'Comptes bancaires et transactions',
        state: reconnectRequired
          ? 'reconnect_required'
          : failed
            ? 'error'
            : syncing
              ? 'syncing'
              : connections.length > 0
                ? 'connected'
                : 'not_configured',
        lastSyncAt: latestDate(connections.map(connection => connection.lastSuccessAt)),
        detail: reconnectRequired
          ? 'Une banque doit être reconnectée'
          : failed
            ? 'Une connexion demande une intervention'
            : syncing
              ? 'Synchronisation en cours'
              : connections.length > 0
                ? `${connections.length} banque${connections.length > 1 ? 's' : ''} suivie${connections.length > 1 ? 's' : ''}`
                : 'Aucune banque connectée',
        primaryAction: reconnectRequired
          ? 'reconnect'
          : connections.length === 0
            ? 'connect'
            : 'sync',
        primaryActionLabel: reconnectRequired
          ? 'Reconnecter'
          : connections.length === 0
            ? 'Connecter'
            : 'Synchroniser',
        safeMode: powens.safeModeActive,
      }

  return [powensModel, externalProvider('ibkr', external), externalProvider('binance', external)]
}

export const canRunIntegrationAction = ({
  isAdmin,
  pending,
  safeMode,
  action,
}: {
  isAdmin: boolean
  pending: boolean
  safeMode: boolean
  action: IntegrationPrimaryAction
}) => isAdmin && !pending && !safeMode && action !== 'none'

export const getSafeIntegrationError = (action: IntegrationPrimaryAction | 'disconnect') => {
  switch (action) {
    case 'connect':
    case 'reconnect':
      return 'La connexion n’a pas pu être ouverte. Réessayez dans quelques instants.'
    case 'disconnect':
      return 'La connexion n’a pas pu être retirée. Réessayez dans quelques instants.'
    default:
      return 'La synchronisation n’a pas pu démarrer. Réessayez dans quelques instants.'
  }
}
