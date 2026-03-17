import type { PowensSyncRunView } from '../routes/integrations/powens/types'

export const getPowensSyncRunsMock = (): PowensSyncRunView[] => {
  return [
    {
      id: 'demo-sync-run-1',
      requestId: 'req-demo-1',
      connectionId: 'demo-fortuneo',
      startedAt: '2026-02-22T19:20:00.000Z',
      endedAt: '2026-02-22T19:22:00.000Z',
      result: 'success',
    },
    {
      id: 'demo-sync-run-2',
      requestId: 'req-demo-2',
      connectionId: 'demo-revolut',
      startedAt: '2026-02-22T18:44:00.000Z',
      endedAt: '2026-02-22T18:45:00.000Z',
      result: 'error',
      errorMessage: 'Powens timeout while fetching transactions',
      errorFingerprint: 'powens timeout while fetching transactions',
    },
    {
      id: 'demo-sync-run-3',
      requestId: 'req-demo-3',
      connectionId: 'demo-fortuneo',
      startedAt: '2026-02-22T18:00:00.000Z',
      endedAt: null,
      result: 'running',
    },
  ]
}
