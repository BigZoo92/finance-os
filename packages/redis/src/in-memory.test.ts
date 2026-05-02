import { describe, expect, it } from 'bun:test'
import { createInMemoryRedisClient } from './index'

describe('createInMemoryRedisClient', () => {
  it('supports basic rate-limit counters with TTL', async () => {
    const redis = createInMemoryRedisClient()

    expect(await redis.client.incr('login:demo')).toBe(1)
    expect(await redis.client.incr('login:demo')).toBe(2)
    expect(await redis.client.expire('login:demo', 60)).toBe(true)
    expect(await redis.client.ttl('login:demo')).toBeGreaterThan(0)

    await redis.close()
  })

  it('supports NX locks and safe lock release scripts', async () => {
    const redis = createInMemoryRedisClient()

    expect(await redis.client.set('lock:demo', 'token-1', { NX: true, EX: 30 })).toBe('OK')
    expect(await redis.client.set('lock:demo', 'token-2', { NX: true, EX: 30 })).toBeNull()
    expect(
      await redis.client.eval('release-lock', {
        keys: ['lock:demo'],
        arguments: ['wrong-token'],
      })
    ).toBe(0)
    expect(
      await redis.client.eval('release-lock', {
        keys: ['lock:demo'],
        arguments: ['token-1'],
      })
    ).toBe(1)
    expect(await redis.client.set('lock:demo', 'token-2', { NX: true, EX: 30 })).toBe('OK')

    await redis.close()
  })

  it('supports hash and list operations used by demo API boot paths', async () => {
    const redis = createInMemoryRedisClient()

    expect(await redis.client.hSet('push:settings', { enabled: 'true', scope: 'demo' })).toBe(2)
    expect(await redis.client.hGetAll('push:settings')).toEqual({
      enabled: 'true',
      scope: 'demo',
    })

    await redis.client.rPush('jobs', 'a')
    await redis.client.rPush('jobs', 'b')
    await redis.client.lPush('jobs', 'start')
    expect(await redis.client.lRange('jobs', 0, 1)).toEqual(['start', 'a'])
    expect(await redis.client.lLen('jobs')).toBe(3)
    await redis.client.lTrim('jobs', 0, 1)
    expect(await redis.client.lRange('jobs', 0, -1)).toEqual(['start', 'a'])

    await redis.close()
  })
})
