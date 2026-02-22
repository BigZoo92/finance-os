import { schema } from '@finance-os/db'
import { desc } from 'drizzle-orm'
import { Elysia } from 'elysia'
import type { PowensRoutesDependencies } from '../integrations/powens/types'

const SYNC_COUNT_METRIC_PREFIX = 'powens:metrics:sync:count:'
const POWENS_CALLS_METRIC_PREFIX = 'powens:metrics:powens_calls:count:'
const LAST_SYNC_STARTED_AT_KEY = 'powens:metrics:sync:last_started_at'
const LAST_SYNC_STARTED_CONNECTION_KEY = 'powens:metrics:sync:last_started_connection'
const LAST_SYNC_ENDED_AT_KEY = 'powens:metrics:sync:last_ended_at'
const LAST_SYNC_ENDED_CONNECTION_KEY = 'powens:metrics:sync:last_ended_connection'
const LAST_SYNC_RESULT_KEY = 'powens:metrics:sync:last_result'

const toDateKey = (value: Date) => value.toISOString().slice(0, 10)

const toCount = (raw: string | null) => {
  if (!raw) {
    return 0
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

export const createDebugRoutes = ({ db, redisClient, env }: PowensRoutesDependencies) => {
  return new Elysia({ prefix: '/debug' }).get('/metrics', async ({ request, set }) => {
    if (!env.PRIVATE_ACCESS_TOKEN && !env.DEBUG_METRICS_TOKEN) {
      set.status = 403
      return {
        status: 'error',
        message: 'Debug metrics endpoint is disabled',
      }
    }

    if (env.DEBUG_METRICS_TOKEN) {
      const provided = request.headers.get('x-finance-os-debug-token')

      if (provided !== env.DEBUG_METRICS_TOKEN) {
        set.status = 401
        return {
          status: 'error',
          message: 'Unauthorized debug endpoint',
        }
      }
    }

    const todayKey = toDateKey(new Date())
    const redisValues = await redisClient.mGet([
      `${SYNC_COUNT_METRIC_PREFIX}${todayKey}`,
      `${POWENS_CALLS_METRIC_PREFIX}${todayKey}`,
      LAST_SYNC_STARTED_AT_KEY,
      LAST_SYNC_STARTED_CONNECTION_KEY,
      LAST_SYNC_ENDED_AT_KEY,
      LAST_SYNC_ENDED_CONNECTION_KEY,
      LAST_SYNC_RESULT_KEY,
    ])

    const connections = await db
      .select({
        powensConnectionId: schema.powensConnection.powensConnectionId,
        status: schema.powensConnection.status,
        lastSyncAt: schema.powensConnection.lastSyncAt,
        lastSuccessAt: schema.powensConnection.lastSuccessAt,
        lastError: schema.powensConnection.lastError,
      })
      .from(schema.powensConnection)
      .orderBy(desc(schema.powensConnection.updatedAt))

    return {
      day: todayKey,
      syncCountToday: toCount(redisValues[0] ?? null),
      powensCallsToday: toCount(redisValues[1] ?? null),
      lastSync: {
        startedAt: redisValues[2] ?? null,
        startedConnectionId: redisValues[3] ?? null,
        endedAt: redisValues[4] ?? null,
        endedConnectionId: redisValues[5] ?? null,
        result: redisValues[6] ?? null,
      },
      connectionStatuses: connections.map(connection => ({
        powensConnectionId: connection.powensConnectionId,
        status: connection.status,
        lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
        lastSuccessAt: connection.lastSuccessAt?.toISOString() ?? null,
        lastError: connection.lastError,
      })),
    }
  })
}
