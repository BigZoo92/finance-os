import { randomUUID } from 'node:crypto'

/**
 * Lua compare-and-delete: the key is deleted only while its value still equals the caller's
 * owner token, so a run whose lease expired can never release a successor's lock.
 */
export const REDIS_LOCK_RELEASE_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end'

/** Minimal client surface satisfied by both the node-redis client and the in-memory adapter. */
export type RedisLockClient = {
  set(key: string, value: string, options: { NX: true; EX: number }): Promise<string | null>
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>
}

export type RedisLockReleaseStatus = 'released' | 'not_owner' | 'error'

export type RedisLockHandle = {
  key: string
  token: string
  ttlSeconds: number
  /** Aborts when the lease ends so work bound to it (fetch, ...) never outlives the lock. */
  signal: AbortSignal
  /** Compare-and-delete with the owner token. Never throws, so it is safe in `finally`. */
  release(): Promise<RedisLockReleaseStatus>
}

export type RedisLockLogger = (event: {
  level: 'info' | 'warn' | 'error'
  msg: string
  [key: string]: unknown
}) => void

export type RedisLockOutcome<T> = { status: 'skipped' } | { status: 'completed'; value: T }

const isReleasedReply = (reply: unknown) => reply === 1 || reply === 1n || reply === '1'

export const acquireRedisLock = async ({
  client,
  key,
  ttlSeconds,
  token = randomUUID(),
}: {
  client: RedisLockClient
  key: string
  ttlSeconds: number
  token?: string
}): Promise<RedisLockHandle | null> => {
  const leaseSeconds = Math.max(1, Math.floor(ttlSeconds))
  const acquired = await client.set(key, token, { NX: true, EX: leaseSeconds })
  if (acquired !== 'OK') {
    return null
  }

  return {
    key,
    token,
    ttlSeconds: leaseSeconds,
    signal: AbortSignal.timeout(leaseSeconds * 1000),
    release: async () => {
      try {
        const reply = await client.eval(REDIS_LOCK_RELEASE_SCRIPT, {
          keys: [key],
          arguments: [token],
        })
        return isReleasedReply(reply) ? 'released' : 'not_owner'
      } catch {
        return 'error'
      }
    },
  }
}

export const withRedisLock = async <T>(
  {
    client,
    key,
    ttlSeconds,
    log,
  }: {
    client: RedisLockClient
    key: string
    ttlSeconds: number
    log?: RedisLockLogger
  },
  fn: (lease: { token: string; signal: AbortSignal }) => Promise<T>
): Promise<RedisLockOutcome<T>> => {
  const lock = await acquireRedisLock({ client, key, ttlSeconds })
  if (!lock) {
    return { status: 'skipped' }
  }

  try {
    return { status: 'completed', value: await fn({ token: lock.token, signal: lock.signal }) }
  } finally {
    const released = await lock.release()
    if (released !== 'released') {
      log?.({
        level: 'warn',
        msg:
          released === 'not_owner'
            ? 'redis lock release skipped because the lease is no longer owned'
            : 'redis lock release failed',
        lockKey: key,
        releaseStatus: released,
      })
    }
  }
}
