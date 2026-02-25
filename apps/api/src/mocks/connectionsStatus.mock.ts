import type { PowensConnectionStatusView } from '../routes/integrations/powens/types'

export const getPowensConnectionsStatusMock = (): PowensConnectionStatusView[] => {
  return [
    {
      id: 1,
      powensConnectionId: 'demo-fortuneo',
      status: 'connected',
      lastSyncAt: new Date('2026-02-22T19:22:00.000Z'),
      lastSuccessAt: new Date('2026-02-22T19:22:00.000Z'),
      lastError: null,
      createdAt: new Date('2026-01-15T10:00:00.000Z'),
      updatedAt: new Date('2026-02-22T19:22:00.000Z'),
    },
    {
      id: 2,
      powensConnectionId: 'demo-revolut',
      status: 'syncing',
      lastSyncAt: new Date('2026-02-22T18:45:00.000Z'),
      lastSuccessAt: new Date('2026-02-22T17:59:00.000Z'),
      lastError: null,
      createdAt: new Date('2026-01-19T09:30:00.000Z'),
      updatedAt: new Date('2026-02-22T18:45:00.000Z'),
    },
  ]
}
