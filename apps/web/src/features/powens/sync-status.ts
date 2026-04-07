import type { PowensConnectionStatus, PowensPersistedSyncReasonCode } from './types'

export type PowensConnectionSyncBadgeModel = {
  badgeLabel: 'OK' | 'KO' | 'En cours' | 'Inconnu'
  badgeVariant: 'secondary' | 'destructive' | 'outline'
  badgeClassName?: string
  reasonLabel: string
  tooltipLabel: string
}

const REASON_LABEL: Record<PowensPersistedSyncReasonCode, string> = {
  SUCCESS: 'Synchronisation complete',
  PARTIAL_IMPORT: 'Import partiel',
  SYNC_FAILED: 'Echec de synchronisation',
  RECONNECT_REQUIRED: 'Reconnexion requise',
}

const formatAttemptTime = (value: string | null) => {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const toSnapshotFreshnessLabel = (value: string | null) => {
  const formatted = formatAttemptTime(value)
  return formatted ? `Dernier snapshot confirme a ${formatted}` : 'Dernier snapshot inconnu'
}

const toTooltipLabel = ({
  attemptAt,
  snapshotAt,
}: {
  attemptAt: string | null
  snapshotAt: string | null
}) => {
  const formattedAttempt = formatAttemptTime(attemptAt)
  const attemptLabel = formattedAttempt ? `Dernier essai a ${formattedAttempt}` : 'Dernier essai inconnu'

  return `${attemptLabel} · ${toSnapshotFreshnessLabel(snapshotAt)}`
}

export const getPowensConnectionSyncBadgeModel = ({
  connection,
  persistenceEnabled,
}: {
  connection: PowensConnectionStatus
  persistenceEnabled: boolean
}): PowensConnectionSyncBadgeModel => {
  const snapshotAt = connection.lastSuccessAt ?? connection.lastSyncAt
  const tooltipLabel = toTooltipLabel({
    attemptAt: connection.lastSyncAttemptAt,
    snapshotAt,
  })

  if (connection.status === 'syncing') {
    return {
      badgeLabel: 'En cours',
      badgeVariant: 'outline',
      badgeClassName: 'border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-300',
      reasonLabel: 'Synchronisation en cours',
      tooltipLabel,
    }
  }

  if (persistenceEnabled && connection.lastSyncStatus) {
    return {
      badgeLabel: connection.lastSyncStatus,
      badgeVariant: connection.lastSyncStatus === 'OK' ? 'secondary' : 'destructive',
      reasonLabel: connection.lastSyncReasonCode
        ? connection.lastSyncStatus === 'KO'
          ? `${REASON_LABEL[connection.lastSyncReasonCode]} · lecture seule sur dernier snapshot`
          : REASON_LABEL[connection.lastSyncReasonCode]
        : connection.lastSyncStatus === 'OK'
          ? 'Synchronisation complete'
          : 'Echec de synchronisation · lecture seule sur dernier snapshot',
      tooltipLabel,
    }
  }

  if (!persistenceEnabled) {
    if (connection.status === 'connected') {
      return {
        badgeLabel: 'OK',
        badgeVariant: 'secondary',
        reasonLabel: 'Statut runtime connecte',
        tooltipLabel,
      }
    }

    if (connection.status === 'error' || connection.status === 'reconnect_required') {
      return {
        badgeLabel: 'KO',
        badgeVariant: 'destructive',
        reasonLabel:
          connection.status === 'reconnect_required'
            ? 'Reconnexion requise'
            : 'Statut runtime en erreur',
        tooltipLabel,
      }
    }
  }

  return {
    badgeLabel: 'Inconnu',
    badgeVariant: 'outline',
    reasonLabel: 'Aucun resultat persiste',
    tooltipLabel,
  }
}
