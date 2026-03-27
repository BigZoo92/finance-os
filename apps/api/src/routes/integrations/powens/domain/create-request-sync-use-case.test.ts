import { describe, expect, it } from 'bun:test'
import { createRequestSyncUseCase } from './create-request-sync-use-case'

describe('createRequestSyncUseCase', () => {
  it('enqueues full resync for a single connection when requested', async () => {
    const calls: Array<{ connectionId: string; requestId?: string; fullResync?: boolean }> = []
    const requestSync = createRequestSyncUseCase({
      enqueueConnectionSync: async params => {
        calls.push(params)
      },
      enqueueAllConnectionsSync: async () => {
        throw new Error('should not enqueue syncAll for connection full resync')
      },
      acquireManualSyncSlot: async () => ({
        allowed: true,
        retryAfterSeconds: 0,
      }),
    })

    await requestSync('conn-123', { requestId: 'req-123', fullResync: true })

    expect(calls).toEqual([
      {
        connectionId: 'conn-123',
        requestId: 'req-123',
        fullResync: true,
      },
    ])
  })

  it('does not set fullResync when syncing all connections', async () => {
    const calls: Array<{ requestId?: string }> = []
    const requestSync = createRequestSyncUseCase({
      enqueueConnectionSync: async () => {
        throw new Error('should not enqueue single-connection sync')
      },
      enqueueAllConnectionsSync: async params => {
        calls.push(params ?? {})
      },
      acquireManualSyncSlot: async () => ({
        allowed: true,
        retryAfterSeconds: 0,
      }),
    })

    await requestSync(undefined, { requestId: 'req-all', fullResync: true })

    expect(calls).toEqual([
      {
        requestId: 'req-all',
      },
    ])
  })
})
