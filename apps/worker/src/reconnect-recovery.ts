const RECONNECT_REQUIRED_RECOVERY_INTERVAL_MS = 24 * 60 * 60 * 1000

type ReconnectRecoveryInput = {
  status: 'connected' | 'syncing' | 'error' | 'reconnect_required'
  lastFailedAt: Date | string | null
  lastSyncAttemptAt: Date | string | null
  now: Date
}

const toTimestamp = (value: Date | string | null) => {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    const timestamp = value.getTime()
    return Number.isFinite(timestamp) ? timestamp : null
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

export const shouldRunReconnectRecoverySync = ({
  status,
  lastFailedAt,
  lastSyncAttemptAt,
  now,
}: ReconnectRecoveryInput) => {
  if (status !== 'reconnect_required') {
    return true
  }

  const lastFailureTimestamp = toTimestamp(lastFailedAt)
  const lastAttemptTimestamp = toTimestamp(lastSyncAttemptAt)

  const mostRecentReconnectTimestamp =
    lastFailureTimestamp === null
      ? lastAttemptTimestamp
      : lastAttemptTimestamp === null
        ? lastFailureTimestamp
        : Math.max(lastFailureTimestamp, lastAttemptTimestamp)

  if (mostRecentReconnectTimestamp === null) {
    return true
  }

  return now.getTime() - mostRecentReconnectTimestamp >= RECONNECT_REQUIRED_RECOVERY_INTERVAL_MS
}
