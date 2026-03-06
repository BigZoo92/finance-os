import { schema } from '@finance-os/db'
import { desc } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { getAuth, getInternalAuth, getRequestMeta } from '../../auth/context'
import { requireInternalToken } from '../../auth/guard'
import { logApiEvent } from '../../observability/logger'
import type { PowensRoutesDependencies } from '../integrations/powens/types'

const SYNC_COUNT_METRIC_PREFIX = 'powens:metrics:sync:count:'
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

const resolveCommitSha = (env: PowensRoutesDependencies['env']) => {
  return env.APP_COMMIT_SHA ?? null
}

const resolveVersion = (env: PowensRoutesDependencies['env']) => {
  return env.APP_VERSION ?? null
}

const toOptionalEnv = (value: string | undefined | null) => {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

const resolveRuntimeVersion = (env: PowensRoutesDependencies['env']) => {
  return {
    GIT_SHA: toOptionalEnv(process.env.GIT_SHA) ?? toOptionalEnv(env.APP_COMMIT_SHA),
    GIT_TAG: toOptionalEnv(process.env.GIT_TAG) ?? toOptionalEnv(env.APP_VERSION),
    BUILD_TIME: toOptionalEnv(process.env.BUILD_TIME),
    NODE_ENV: env.NODE_ENV,
  }
}

const toEnvPresence = (env: PowensRoutesDependencies['env']) => {
  return Object.fromEntries(
    DEBUG_ENV_PRESENCE_KEYS.map(key => {
      return [key, Boolean(env[key])]
    })
  )
}

export const createDebugRoutes = ({ db, redisClient, env }: PowensRoutesDependencies) => {
  const ensureDebugAuthAccess = (context: Parameters<typeof requireInternalToken>[0]) => {
    if (env.NODE_ENV !== 'production') {
      return
    }

    requireInternalToken(context)
  }

  return new Elysia({ prefix: '/debug' })
    .get('/ping', context => {
      ensureDebugAuthAccess(context)

      return {
        ok: true,
        message: 'pong',
        mode: getAuth(context).mode,
        requestId: getRequestMeta(context).requestId,
      }
    })
    .get('/health', context => {
      requireInternalToken(context)

      return {
        ok: true,
        requestId: getRequestMeta(context).requestId,
        version: resolveVersion(env),
        commitSha: resolveCommitSha(env),
        runtimeVersion: resolveRuntimeVersion(env),
        environment: env.NODE_ENV,
        envPresence: toEnvPresence(env),
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
        version: resolveRuntimeVersion(env),
        flags: {
          nodeEnv: env.NODE_ENV,
          privateAccessTokenEnabled: Boolean(env.PRIVATE_ACCESS_TOKEN),
          debugMetricsTokenEnabled: Boolean(env.DEBUG_METRICS_TOKEN),
          demoModeDefault: true,
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

      logApiEvent({
        level: 'info',
        msg: 'debug metrics snapshot generated',
        requestId,
        connectionCount: connections.length,
      })

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
