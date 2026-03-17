import { describe, expect, it } from 'bun:test'
import { createPowensAdminAuditService } from './create-powens-admin-audit-service'

const createRedisListMock = () => {
  const storage: string[] = []

  return {
    client: {
      lpush: async (_key: string, value: string) => {
        storage.unshift(value)
      },
      ltrim: async (_key: string, start: number, stop: number) => {
        const next = storage.slice(start, stop + 1)
        storage.splice(0, storage.length, ...next)
      },
      lrange: async (_key: string, start: number, stop: number) => {
        return storage.slice(start, stop + 1)
      },
    },
    storage,
  }
}

describe('createPowensAdminAuditService', () => {
  it('stores and returns newest entries first', async () => {
    const redis = createRedisListMock()
    const service = createPowensAdminAuditService(redis.client as never)

    await service.recordEvent({
      id: 'evt-1',
      action: 'manual_sync',
      result: 'allowed',
      actorMode: 'admin',
      at: '2026-03-16T12:00:00.000Z',
      requestId: 'req-1',
    })

    await service.recordEvent({
      id: 'evt-2',
      action: 'callback',
      result: 'failed',
      actorMode: 'state',
      at: '2026-03-16T12:01:00.000Z',
      requestId: 'req-2',
      connectionId: 'conn-2',
      details: 'exchange_failed',
    })

    const events = await service.listRecentEvents(10)
    expect(events.map((event: { id: string }) => event.id)).toEqual(['evt-2', 'evt-1'])
    expect(events[0]).toMatchObject({
      connectionId: 'conn-2',
      details: 'exchange_failed',
    })
  })

  it('ignores malformed payloads from Redis', async () => {
    const redis = createRedisListMock()
    redis.storage.unshift('{"bad":true}')
    const service = createPowensAdminAuditService(redis.client as never)

    const events = await service.listRecentEvents(10)
    expect(events).toEqual([])
  })
})
