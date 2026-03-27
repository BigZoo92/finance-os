import type { PowensConnectionStatus } from './types'

const RETRYABLE_CONNECTION_STATUSES = new Set<PowensConnectionStatus['status']>([
  'error',
  'reconnect_required',
])

export const isPowensConnectionRetryable = (connection: PowensConnectionStatus) => {
  return RETRYABLE_CONNECTION_STATUSES.has(connection.status)
}
