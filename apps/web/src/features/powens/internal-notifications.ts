import type { PowensConnectionStatus, PowensSyncRun } from './types'

export type PowensInternalNotification = {
  id: string
  connectionId: string
  title: string
  detail: string
  level: 'warning' | 'critical'
}

const toIsoTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return null
  }

  const parsed = new Date(value).getTime()
  if (!Number.isFinite(parsed)) {
    return null
  }

  return new Date(parsed).toISOString()
}

const toConnectionDetail = (connection: PowensConnectionStatus) => {
  const institution = connection.providerInstitutionName ?? connection.provider
  const lastFailureAt = toIsoTimestamp(connection.lastFailedAt)
  const errorMessage = connection.lastError?.trim()

  const fragments = [`Connexion ${institution}`]
  if (lastFailureAt) {
    fragments.push(`dernier echec ${lastFailureAt}`)
  }
  if (errorMessage) {
    fragments.push(errorMessage)
  }

  return fragments.join(' · ')
}

export const getPowensInternalNotifications = ({
  connections,
  runs,
}: {
  connections: PowensConnectionStatus[]
  runs: PowensSyncRun[]
}): PowensInternalNotification[] => {
  const latestRunByConnectionId = runs.reduce<Map<string, PowensSyncRun>>((acc, run) => {
    const existing = acc.get(run.connectionId)
    if (!existing) {
      acc.set(run.connectionId, run)
      return acc
    }

    const existingStartedAt = new Date(existing.startedAt).getTime()
    const runStartedAt = new Date(run.startedAt).getTime()
    if (runStartedAt > existingStartedAt) {
      acc.set(run.connectionId, run)
    }

    return acc
  }, new Map())

  const notifications = connections.reduce<PowensInternalNotification[]>((acc, connection) => {
      if (connection.status === 'reconnect_required') {
        acc.push(
          {
            id: `powens-reconnect-${connection.powensConnectionId}`,
            connectionId: connection.powensConnectionId,
            title: 'Reconnexion Powens requise',
            detail: toConnectionDetail(connection),
            level: 'critical' as const,
          },
        )
        return acc
      }

      if (connection.status === 'error') {
        acc.push(
          {
            id: `powens-error-${connection.powensConnectionId}`,
            connectionId: connection.powensConnectionId,
            title: 'Connexion Powens en erreur',
            detail: toConnectionDetail(connection),
            level: 'warning' as const,
          },
        )
        return acc
      }

      const latestRun = latestRunByConnectionId.get(connection.powensConnectionId)
      if (latestRun?.result === 'reconnect_required') {
        acc.push(
          {
            id: `powens-run-reconnect-${connection.powensConnectionId}`,
            connectionId: connection.powensConnectionId,
            title: 'Sync Powens bloquee: reconnect_required',
            detail: `Dernier run ${latestRun.startedAt}`,
            level: 'critical' as const,
          },
        )
        return acc
      }

      return acc
    }, [])

  return notifications.sort((left, right) => {
      if (left.level === right.level) {
        return left.connectionId.localeCompare(right.connectionId)
      }
      return left.level === 'critical' ? -1 : 1
    })
}
