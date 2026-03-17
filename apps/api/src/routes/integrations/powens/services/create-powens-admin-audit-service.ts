import type { PowensAdminAuditEvent, RedisClient } from '../types'

const AUDIT_LOG_KEY = 'powens:admin:audit-trail'
const MAX_EVENTS = 100

const safeParseEvent = (value: string): PowensAdminAuditEvent | null => {
  try {
    const parsed = JSON.parse(value) as PowensAdminAuditEvent
    if (
      typeof parsed.id === 'string' &&
      typeof parsed.action === 'string' &&
      typeof parsed.result === 'string' &&
      typeof parsed.actorMode === 'string' &&
      typeof parsed.at === 'string' &&
      typeof parsed.requestId === 'string'
    ) {
      return parsed
    }

    return null
  } catch {
    return null
  }
}

const asRedisFunction = <TArgs extends unknown[], TResult>(
  candidate: ((...args: TArgs) => TResult) | undefined,
  name: string
) => {
  if (typeof candidate !== 'function') {
    throw new Error(`Redis client is missing ${name}`)
  }

  return candidate
}

export const createPowensAdminAuditService = (redisClient: RedisClient) => {
  const lpush = asRedisFunction((redisClient as never as { lpush?: (...args: [string, string]) => Promise<unknown> }).lpush, 'lpush')
  const ltrim = asRedisFunction(
    (redisClient as never as { ltrim?: (...args: [string, number, number]) => Promise<unknown> }).ltrim,
    'ltrim'
  )
  const lrange = asRedisFunction(
    (redisClient as never as { lrange?: (...args: [string, number, number]) => Promise<unknown> }).lrange,
    'lrange'
  )

  const recordEvent = async (event: PowensAdminAuditEvent) => {
    const serialized = JSON.stringify(event)
    await lpush(AUDIT_LOG_KEY, serialized)
    await ltrim(AUDIT_LOG_KEY, 0, MAX_EVENTS - 1)
  }

  const listRecentEvents = async (limit = 20) => {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.floor(limit))) : 20
    const raw = await lrange(AUDIT_LOG_KEY, 0, normalizedLimit - 1)
    const rows = Array.isArray(raw) ? raw : []

    return rows
      .map(entry => (typeof entry === 'string' ? safeParseEvent(entry) : null))
      .filter((entry): entry is PowensAdminAuditEvent => entry !== null)
  }

  return {
    recordEvent,
    listRecentEvents,
  }
}
