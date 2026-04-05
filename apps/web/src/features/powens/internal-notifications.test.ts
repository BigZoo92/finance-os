import { describe, expect, it } from 'vitest'
import { getPowensInternalNotifications } from './internal-notifications'
import type { PowensConnectionStatus, PowensSyncRun } from './types'

const makeConnection = ({
  connectionId,
  status,
  institutionName,
}: {
  connectionId: string
  status: PowensConnectionStatus['status']
  institutionName?: string | null
}): PowensConnectionStatus => ({
  id: 1,
  source: 'powens',
  provider: 'powens',
  powensConnectionId: connectionId,
  providerConnectionId: `provider-${connectionId}`,
  providerInstitutionId: null,
  providerInstitutionName: institutionName ?? null,
  status,
  lastSyncStatus: null,
  lastSyncReasonCode: null,
  lastSyncAttemptAt: null,
  lastSyncAt: null,
  lastSuccessAt: null,
  lastFailedAt: '2026-04-01T10:00:00.000Z',
  lastError: 'token expired',
  syncMetadata: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const makeRun = ({
  connectionId,
  result,
  startedAt,
}: {
  connectionId: string
  result: PowensSyncRun['result']
  startedAt: string
}): PowensSyncRun => ({
  id: `${connectionId}-${startedAt}`,
  requestId: null,
  connectionId,
  startedAt,
  endedAt: null,
  result,
})

describe('getPowensInternalNotifications', () => {
  it('creates a critical notification for reconnect_required connections', () => {
    const notifications = getPowensInternalNotifications({
      connections: [makeConnection({ connectionId: 'conn-1', status: 'reconnect_required' })],
      runs: [],
    })

    expect(notifications).toEqual([
      expect.objectContaining({
        connectionId: 'conn-1',
        level: 'critical',
        title: 'Reconnexion Powens requise',
      }),
    ])
  })

  it('creates a warning notification for error connections', () => {
    const notifications = getPowensInternalNotifications({
      connections: [makeConnection({ connectionId: 'conn-2', status: 'error' })],
      runs: [],
    })

    expect(notifications).toEqual([
      expect.objectContaining({
        connectionId: 'conn-2',
        level: 'warning',
        title: 'Connexion Powens en erreur',
      }),
    ])
  })

  it('uses latest run when runtime status has not flipped yet', () => {
    const notifications = getPowensInternalNotifications({
      connections: [makeConnection({ connectionId: 'conn-3', status: 'connected' })],
      runs: [
        makeRun({
          connectionId: 'conn-3',
          result: 'success',
          startedAt: '2026-04-01T10:00:00.000Z',
        }),
        makeRun({
          connectionId: 'conn-3',
          result: 'reconnect_required',
          startedAt: '2026-04-01T11:00:00.000Z',
        }),
      ],
    })

    expect(notifications).toEqual([
      expect.objectContaining({
        connectionId: 'conn-3',
        level: 'critical',
        title: 'Sync Powens bloquee: reconnect_required',
      }),
    ])
  })
})
