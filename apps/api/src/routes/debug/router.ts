import { schema } from '@finance-os/db'
import { resolveRuntimeVersion } from '@finance-os/prelude'
import { desc, sql } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { getAuth, getInternalAuth, getRequestMeta } from '../../auth/context'
import { requireInternalToken } from '../../auth/guard'
import { logApiEvent } from '../../observability/logger'
import type { PowensRoutesDependencies } from '../integrations/powens/types'

const SYNC_COUNT_METRIC_PREFIX = 'powens:metrics:sync:count:'
const SYNC_STATUS_COUNT_METRIC_PREFIX = 'powens:metrics:sync_status:count:'
const POWENS_CALLS_METRIC_PREFIX = 'powens:metrics:powens_calls:count:'
const LAST_SYNC_STARTED_AT_KEY = 'powens:metrics:sync:last_started_at'
const LAST_SYNC_STARTED_CONNECTION_KEY = 'powens:metrics:sync:last_started_connection'
const LAST_SYNC_ENDED_AT_KEY = 'powens:metrics:sync:last_ended_at'
const LAST_SYNC_ENDED_CONNECTION_KEY = 'powens:metrics:sync:last_ended_connection'
const LAST_SYNC_RESULT_KEY = 'powens:metrics:sync:last_result'

const DEBUG_ENV_PRESENCE_KEYS = [
  'PRIVATE_ACCESS_TOKEN',
  'DATABASE_URL',
  'REDIS_URL',
  'AUTH_ADMIN_EMAIL',
  'AUTH_SESSION_SECRET',
  'AUTH_PASSWORD_HASH',
  'AUTH_PASSWORD_HASH_SOURCE',
  'POWENS_CLIENT_ID',
  'POWENS_CLIENT_SECRET',
  'APP_ENCRYPTION_KEY',
] as const

const toDateKey = (value: Date) => value.toISOString().slice(0, 10)

const toCount = (raw: string | null) => {
  if (!raw) {
    return 0
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

const SYNC_STATUS_METRIC_COMBINATIONS = [
  {
    status: 'OK',
    reasonCode: 'SUCCESS',
  },
  {
    status: 'OK',
    reasonCode: 'PARTIAL_IMPORT',
  },
  {
    status: 'KO',
    reasonCode: 'SYNC_FAILED',
  },
  {
    status: 'KO',
    reasonCode: 'RECONNECT_REQUIRED',
  },
] as const

const resolveCommitSha = (env: PowensRoutesDependencies['env']) => {
  return env.APP_COMMIT_SHA ?? null
}

const resolveVersion = (env: PowensRoutesDependencies['env']) => {
  return env.APP_VERSION ?? null
}

const resolveDebugRuntimeVersion = (env: PowensRoutesDependencies['env']) => {
  return resolveRuntimeVersion({
    service: 'api',
    nodeEnv: env.NODE_ENV,
    gitSha: process.env.GIT_SHA,
    gitTag: process.env.GIT_TAG,
    buildTime: process.env.BUILD_TIME,
    appCommitSha: env.APP_COMMIT_SHA,
    appVersion: env.APP_VERSION,
  })
}

const toEnvPresence = (env: PowensRoutesDependencies['env']) => {
  return Object.fromEntries(
    DEBUG_ENV_PRESENCE_KEYS.map(key => {
      return [key, Boolean(env[key])]
    })
  )
}

export const createDebugRoutes = ({ db, redisClient, env }: PowensRoutesDependencies) => {
  const checkRedisHealth = async () => {
    const startedAt = Date.now()

    try {
      const ping = (redisClient as never as { ping?: () => Promise<string> }).ping
      if (typeof ping !== 'function') {
        return {
          status: 'error' as const,
          latencyMs: Date.now() - startedAt,
          details: 'redis ping command unavailable',
        }
      }

      await ping()

      return {
        status: 'ok' as const,
        latencyMs: Date.now() - startedAt,
      }
    } catch (error) {
      return {
        status: 'error' as const,
        latencyMs: Date.now() - startedAt,
        details: error instanceof Error ? error.message : 'redis check failed',
      }
    }
  }

  const checkDbHealth = async () => {
    const startedAt = Date.now()

    try {
      await db.execute(sql`select 1`)

      return {
        status: 'ok' as const,
        latencyMs: Date.now() - startedAt,
      }
    } catch (error) {
      return {
        status: 'error' as const,
        latencyMs: Date.now() - startedAt,
        details: error instanceof Error ? error.message : 'database check failed',
      }
    }
  }

  const ensureDebugAuthAccess = (context: Parameters<typeof requireInternalToken>[0]) => {
    if (env.NODE_ENV !== 'production') {
      return
    }

    requireInternalToken(context)
  }

  return new Elysia({ prefix: '/debug' })
    .get('/health', async context => {
      requireInternalToken(context)

      const [dbHealth, redisHealth] = await Promise.all([checkDbHealth(), checkRedisHealth()])
      const ok = dbHealth.status === 'ok' && redisHealth.status === 'ok'

      if (!ok) {
        logApiEvent({
          level: 'warn',
          msg: 'debug health check degraded',
          requestId: getRequestMeta(context).requestId,
          databaseStatus: dbHealth.status,
          redisStatus: redisHealth.status,
        })
      }

      return {
        ok,
        requestId: getRequestMeta(context).requestId,
        version: resolveVersion(env),
        commitSha: resolveCommitSha(env),
        runtimeVersion: resolveDebugRuntimeVersion(env),
        environment: env.NODE_ENV,
        envPresence: toEnvPresence(env),
        checks: {
          database: {
            status: dbHealth.status,
            latencyMs: dbHealth.latencyMs,
            ...(dbHealth.status === 'error' ? { details: dbHealth.details } : {}),
          },
          redis: {
            status: redisHealth.status,
            latencyMs: redisHealth.latencyMs,
            ...(redisHealth.status === 'error' ? { details: redisHealth.details } : {}),
          },
        },
      }
    })
    .get('/auth', context => {
      ensureDebugAuthAccess(context)

      const auth = getAuth(context)
      const internalAuth = getInternalAuth(context)

      return {
        ok: true,
        requestId: getRequestMeta(context).requestId,
        hasSession: auth.mode === 'admin',
        isAdmin: auth.mode === 'admin',
        hasInternalToken: internalAuth.hasValidToken,
        internalTokenSource: internalAuth.tokenSource,
        mode: auth.mode,
      }
    })
    .get('/config', context => {
      requireInternalToken(context)

      return {
        ok: true,
        requestId: getRequestMeta(context).requestId,
        version: resolveDebugRuntimeVersion(env),
        flags: {
          nodeEnv: env.NODE_ENV,
          privateAccessTokenEnabled: Boolean(env.PRIVATE_ACCESS_TOKEN),
          debugMetricsTokenEnabled: Boolean(env.DEBUG_METRICS_TOKEN),
          demoModeDefault: true,
          syncStatusPersistenceEnabled: env.SYNC_STATUS_PERSISTENCE_ENABLED,
          allowInsecureCookieInProd: env.AUTH_ALLOW_INSECURE_COOKIE_IN_PROD,
          authSessionTtlDays: env.AUTH_SESSION_TTL_DAYS,
          authLoginRateLimitPerMin: env.AUTH_LOGIN_RATE_LIMIT_PER_MIN,
        },
        envPresence: toEnvPresence(env),
      }
    })
    .get('/metrics', async context => {
      requireInternalToken(context)

      const requestId = getRequestMeta(context).requestId

      const todayKey = toDateKey(new Date())
      const syncStatusMetricKeys = SYNC_STATUS_METRIC_COMBINATIONS.map(
        combination =>
          `${SYNC_STATUS_COUNT_METRIC_PREFIX}${combination.status}:${combination.reasonCode}:${todayKey}`
      )
      const redisValues = await redisClient.mGet([
        `${SYNC_COUNT_METRIC_PREFIX}${todayKey}`,
        `${POWENS_CALLS_METRIC_PREFIX}${todayKey}`,
        LAST_SYNC_STARTED_AT_KEY,
        LAST_SYNC_STARTED_CONNECTION_KEY,
        LAST_SYNC_ENDED_AT_KEY,
        LAST_SYNC_ENDED_CONNECTION_KEY,
        LAST_SYNC_RESULT_KEY,
        ...syncStatusMetricKeys,
      ])

      const connections = await db
        .select({
          powensConnectionId: schema.powensConnection.powensConnectionId,
          status: schema.powensConnection.status,
          lastSyncStatus: schema.powensConnection.lastSyncStatus,
          lastSyncReasonCode: schema.powensConnection.lastSyncReasonCode,
          lastSyncAt: schema.powensConnection.lastSyncAt,
          lastSuccessAt: schema.powensConnection.lastSuccessAt,
          lastError: schema.powensConnection.lastError,
        })
        .from(schema.powensConnection)
        .orderBy(desc(schema.powensConnection.updatedAt))

      logApiEvent({
        level: 'info',
        msg: 'debug metrics snapshot generated',
        requestId,
        connectionCount: connections.length,
      })

      const syncStatusCountsToday = SYNC_STATUS_METRIC_COMBINATIONS.reduce<
        Record<string, Record<string, number>>
      >((accumulator, combination, index) => {
        const raw = redisValues[7 + index] ?? null
        const byStatus = accumulator[combination.status] ?? {}
        byStatus[combination.reasonCode] = toCount(raw)
        accumulator[combination.status] = byStatus
        return accumulator
      }, {})

      return {
        requestId,
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
        syncStatusCountsToday,
        connectionStatuses: connections.map(connection => ({
          powensConnectionId: connection.powensConnectionId,
          status: connection.status,
          lastSyncStatus: connection.lastSyncStatus,
          lastSyncReasonCode: connection.lastSyncReasonCode,
          lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
          lastSuccessAt: connection.lastSuccessAt?.toISOString() ?? null,
          lastError: connection.lastError,
        })),
      }
    })
}
