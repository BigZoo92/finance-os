import { afterEach, describe, expect, it, setSystemTime } from 'bun:test'
import { createInMemoryRedisClient } from './index'
import {
  acquireRedisLock,
  REDIS_LOCK_RELEASE_SCRIPT,
  type RedisLockHandle,
  withRedisLock,
} from './lock'

const LOCK_KEY = 'lock:test'

const expectAcquired = (lock: RedisLockHandle | null) => {
  if (!lock) {
    throw new Error('expected the lock to be acquired')
  }
  return lock
}

describe('acquireRedisLock', () => {
  afterEach(() => {
    setSystemTime()
  })

  it('acquires a free lock and skips while it is held', async () => {
    const redis = createInMemoryRedisClient()

    const lock = expectAcquired(
      await acquireRedisLock({ client: redis.client, key: LOCK_KEY, ttlSeconds: 30 })
    )
    expect(lock.key).toBe(LOCK_KEY)
    expect(lock.ttlSeconds).toBe(30)
    expect(await redis.client.get(LOCK_KEY)).toBe(lock.token)
    expect(
      await acquireRedisLock({ client: redis.client, key: LOCK_KEY, ttlSeconds: 30 })
    ).toBeNull()

    expect(await lock.release()).toBe('released')
    expect(await redis.client.get(LOCK_KEY)).toBeNull()
    expect(
      await acquireRedisLock({ client: redis.client, key: LOCK_KEY, ttlSeconds: 30 })
    ).not.toBeNull()
  })

  it('only the owner token can release the lock', async () => {
    const redis = createInMemoryRedisClient()
    const lock = expectAcquired(
      await acquireRedisLock({
        client: redis.client,
        key: LOCK_KEY,
        ttlSeconds: 30,
        token: 'owner-a',
      })
    )

    expect(
      await redis.client.eval(REDIS_LOCK_RELEASE_SCRIPT, {
        keys: [LOCK_KEY],
        arguments: ['intruder'],
      })
    ).toBe(0)
    expect(await redis.client.get(LOCK_KEY)).toBe('owner-a')

    expect(await lock.release()).toBe('released')
    expect(await redis.client.get(LOCK_KEY)).toBeNull()
    expect(await lock.release()).toBe('not_owner')
  })

  it('an expired owner cannot release a successor lock', async () => {
    const start = new Date('2026-09-25T10:00:00.000Z')
    setSystemTime(start)
    const redis = createInMemoryRedisClient()

    const first = expectAcquired(
      await acquireRedisLock({
        client: redis.client,
        key: LOCK_KEY,
        ttlSeconds: 30,
        token: 'owner-a',
      })
    )

    setSystemTime(new Date(start.getTime() + 31_000))
    const second = expectAcquired(
      await acquireRedisLock({
        client: redis.client,
        key: LOCK_KEY,
        ttlSeconds: 30,
        token: 'owner-b',
      })
    )

    expect(await first.release()).toBe('not_owner')
    expect(await redis.client.get(LOCK_KEY)).toBe('owner-b')
    expect(
      await acquireRedisLock({ client: redis.client, key: LOCK_KEY, ttlSeconds: 30 })
    ).toBeNull()
    expect(await second.release()).toBe('released')
  })

  it('returns error instead of throwing when the release script fails', async () => {
    const lock = expectAcquired(
      await acquireRedisLock({
        client: {
          set: async () => 'OK',
          eval: async () => {
            throw new Error('redis-disconnected')
          },
        },
        key: LOCK_KEY,
        ttlSeconds: 30,
      })
    )

    expect(await lock.release()).toBe('error')
  })
})

describe('withRedisLock', () => {
  afterEach(() => {
    setSystemTime()
  })

  it('runs the callback under the lease and releases on success', async () => {
    const redis = createInMemoryRedisClient()
    const signals: AbortSignal[] = []

    const outcome = await withRedisLock(
      { client: redis.client, key: LOCK_KEY, ttlSeconds: 30 },
      async ({ token, signal }) => {
        signals.push(signal)
        expect(await redis.client.get(LOCK_KEY)).toBe(token)
        return 'done'
      }
    )

    expect(outcome).toEqual({ status: 'completed', value: 'done' })
    expect(signals[0]?.aborted).toBe(false)
    expect(await redis.client.get(LOCK_KEY)).toBeNull()
  })

  it('skips without touching a lock held by someone else', async () => {
    const redis = createInMemoryRedisClient()
    await redis.client.set(LOCK_KEY, 'foreign-token', { NX: true, EX: 60 })
    let ran = false

    const outcome = await withRedisLock(
      { client: redis.client, key: LOCK_KEY, ttlSeconds: 30 },
      async () => {
        ran = true
      }
    )

    expect(outcome).toEqual({ status: 'skipped' })
    expect(ran).toBe(false)
    expect(await redis.client.get(LOCK_KEY)).toBe('foreign-token')
  })

  it('releases the lock when the callback throws', async () => {
    const redis = createInMemoryRedisClient()

    await expect(
      withRedisLock({ client: redis.client, key: LOCK_KEY, ttlSeconds: 30 }, async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    expect(await redis.client.get(LOCK_KEY)).toBeNull()
  })

  it('warns instead of deleting a successor lock when its own lease expired mid-run', async () => {
    const start = new Date('2026-09-25T10:00:00.000Z')
    setSystemTime(start)
    const redis = createInMemoryRedisClient()
    const events: Array<Record<string, unknown>> = []

    const outcome = await withRedisLock(
      {
        client: redis.client,
        key: LOCK_KEY,
        ttlSeconds: 30,
        log: event => {
          events.push(event)
        },
      },
      async () => {
        setSystemTime(new Date(start.getTime() + 31_000))
        expect(await redis.client.set(LOCK_KEY, 'successor-token', { NX: true, EX: 60 })).toBe('OK')
        return 'late'
      }
    )

    expect(outcome).toEqual({ status: 'completed', value: 'late' })
    expect(await redis.client.get(LOCK_KEY)).toBe('successor-token')
    expect(events).toEqual([
      {
        level: 'warn',
        msg: 'redis lock release skipped because the lease is no longer owned',
        lockKey: LOCK_KEY,
        releaseStatus: 'not_owner',
      },
    ])
  })

  it('aborts the lease signal when the TTL elapses', async () => {
    const redis = createInMemoryRedisClient()

    const outcome = await withRedisLock(
      { client: redis.client, key: LOCK_KEY, ttlSeconds: 1 },
      ({ signal }) =>
        Promise.race([
          new Promise<string>(resolve => {
            signal.addEventListener('abort', () => resolve('aborted'), { once: true })
          }),
          // Ref'd guard timer keeps the loop alive; the unref'd lease timer must win.
          new Promise<string>(resolve => {
            setTimeout(() => resolve('timed_out'), 1_500)
          }),
        ])
    )

    expect(outcome).toEqual({ status: 'completed', value: 'aborted' })
    expect(await redis.client.get(LOCK_KEY)).toBeNull()
  })
})
