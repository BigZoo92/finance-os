import type { PowensConnectionStatusView } from '../types'
import type { DiagnosticProvider } from '../domain/diagnostics'

const hasTimeoutSignal = (connection: PowensConnectionStatusView) => {
  return (connection.lastError ?? '').toLowerCase().includes('timeout')
}

const hasAuthSignal = (connection: PowensConnectionStatusView) => {
  const message = (connection.lastError ?? '').toLowerCase()
  return connection.status === 'reconnect_required' || message.includes('token') || message.includes('auth')
}

export const createPowensDiagnosticProvider = ({
  listStatuses,
  isSafeModeActive,
}: {
  listStatuses: () => Promise<PowensConnectionStatusView[]>
  isSafeModeActive: () => boolean
}): DiagnosticProvider => {
  return {
    run: async () => {
      if (isSafeModeActive()) {
        return {
          provider: 'powens',
          outcome: 'degraded',
          guidance: 'External integrations are in safe mode. Dashboard remains usable.',
          retryable: false,
        }
      }

      const statuses = await listStatuses()
      if (statuses.some(hasAuthSignal)) {
        return {
          provider: 'powens',
          outcome: 'auth_error',
          issueType: 'auth',
          guidance: 'At least one connection needs credential refresh.',
          retryable: false,
        }
      }

      if (statuses.some(hasTimeoutSignal)) {
        return {
          provider: 'powens',
          outcome: 'timeout',
          issueType: 'timeout',
          guidance: 'Powens timed out during recent checks. Retry is recommended.',
          retryable: true,
        }
      }

      if (statuses.some(connection => connection.status === 'error' || connection.lastSyncStatus === 'KO')) {
        return {
          provider: 'powens',
          outcome: 'provider_error',
          issueType: 'provider',
          guidance: 'Provider returned errors for some connections, but dashboard data stays usable.',
          retryable: true,
        }
      }

      return {
        provider: 'powens',
        outcome: 'ok',
        guidance: 'All provider diagnostics checks are healthy.',
        retryable: true,
      }
    },
  }
}
