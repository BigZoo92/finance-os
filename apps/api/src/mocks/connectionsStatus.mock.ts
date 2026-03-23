import type { PowensConnectionStatusView } from '../routes/integrations/powens/types'

export const getPowensConnectionsStatusMock = (): PowensConnectionStatusView[] => {
  return [
    {
      id: 1,
      source: 'banking',
      provider: 'powens',
      powensConnectionId: 'demo-fortuneo',
      providerConnectionId: 'demo-fortuneo',
      providerInstitutionId: 'fortuneo',
      providerInstitutionName: 'Fortuneo',
      status: 'connected',
      lastSyncAttemptAt: new Date('2026-02-22T19:20:00.000Z'),
      lastSyncAt: new Date('2026-02-22T19:22:00.000Z'),
      lastSuccessAt: new Date('2026-02-22T19:22:00.000Z'),
      lastFailedAt: null,
      lastError: null,
      syncMetadata: {
        accountCount: 2,
        importedTransactionCount: 32,
        windowDays: 90,
      },
      createdAt: new Date('2026-01-15T10:00:00.000Z'),
      updatedAt: new Date('2026-02-22T19:22:00.000Z'),
    },
    {
      id: 2,
      source: 'banking',
      provider: 'powens',
      powensConnectionId: 'demo-revolut',
      providerConnectionId: 'demo-revolut',
      providerInstitutionId: 'revolut',
      providerInstitutionName: 'Revolut',
      status: 'syncing',
      lastSyncAttemptAt: new Date('2026-02-22T18:45:00.000Z'),
      lastSyncAt: new Date('2026-02-22T18:45:00.000Z'),
      lastSuccessAt: new Date('2026-02-22T17:59:00.000Z'),
      lastFailedAt: new Date('2026-02-21T16:14:00.000Z'),
      lastError: null,
      syncMetadata: {
        accountCount: 1,
        importedTransactionCount: 11,
        windowDays: 30,
      },
      createdAt: new Date('2026-01-19T09:30:00.000Z'),
      updatedAt: new Date('2026-02-22T18:45:00.000Z'),
    },
  ]
}
