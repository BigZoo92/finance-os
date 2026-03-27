import { describe, expect, it } from 'vitest'
import { getPowensConnectionSyncBadgeModel } from './sync-status'
import type { PowensConnectionStatus } from './types'

const createConnection = (overrides?: Partial<PowensConnectionStatus>): PowensConnectionStatus => ({
  id: 1,
  source: 'banking',
  provider: 'powens',
  powensConnectionId: 'conn-1',
  providerConnectionId: 'conn-1',
  providerInstitutionId: 'fortuneo',
  providerInstitutionName: 'Fortuneo',
  status: 'connected',
  lastSyncStatus: 'OK',
  lastSyncReasonCode: 'SUCCESS',
  lastSyncAttemptAt: '2026-03-27T08:00:00.000Z',
  lastSyncAt: '2026-03-27T08:02:00.000Z',
  lastSuccessAt: '2026-03-27T08:02:00.000Z',
  lastFailedAt: null,
  lastError: null,
  syncMetadata: null,
  createdAt: '2026-03-01T08:00:00.000Z',
  updatedAt: '2026-03-27T08:02:00.000Z',
  ...overrides,
})

describe('getPowensConnectionSyncBadgeModel', () => {
  it('uses the persisted OK snapshot when enabled', () => {
    expect(
      getPowensConnectionSyncBadgeModel({
        connection: createConnection(),
        persistenceEnabled: true,
      })
    ).toEqual(
      expect.objectContaining({
        badgeLabel: 'OK',
        badgeVariant: 'secondary',
        reasonLabel: 'Synchronisation complete',
      })
    )
  })

  it('keeps En cours authoritative while a sync is running', () => {
    expect(
      getPowensConnectionSyncBadgeModel({
        connection: createConnection({
          status: 'syncing',
          lastSyncStatus: 'KO',
          lastSyncReasonCode: 'SYNC_FAILED',
        }),
        persistenceEnabled: true,
      })
    ).toEqual(
      expect.objectContaining({
        badgeLabel: 'En cours',
        reasonLabel: 'Synchronisation en cours',
      })
    )
  })

  it('falls back to runtime KO when persistence is disabled', () => {
    expect(
      getPowensConnectionSyncBadgeModel({
        connection: createConnection({
          status: 'reconnect_required',
          lastSyncStatus: 'OK',
          lastSyncReasonCode: 'SUCCESS',
        }),
        persistenceEnabled: false,
      })
    ).toEqual(
      expect.objectContaining({
        badgeLabel: 'KO',
        badgeVariant: 'destructive',
        reasonLabel: 'Reconnexion requise',
      })
    )
  })

  it('returns Inconnu when there is no persisted result yet', () => {
    expect(
      getPowensConnectionSyncBadgeModel({
        connection: createConnection({
          lastSyncStatus: null,
          lastSyncReasonCode: null,
        }),
        persistenceEnabled: true,
      })
    ).toEqual(
      expect.objectContaining({
        badgeLabel: 'Inconnu',
        badgeVariant: 'outline',
        reasonLabel: 'Aucun resultat persiste',
      })
    )
  })
})
