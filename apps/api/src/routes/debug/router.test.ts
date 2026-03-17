import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createDebugRoutes } from './router'
import type { PowensRoutesDependencies } from '../integrations/powens/types'

const createDebugTestApp = ({
  mode,
  dbExecute,
  redisPing,
  hasInternalToken = false,
}: {
  mode: 'admin' | 'demo'
  dbExecute?: () => Promise<unknown>
  redisPing?: () => Promise<string>
  hasInternalToken?: boolean
}) => {
  const dependencies = {
    db: {
      execute: dbExecute ?? (async () => [{ ok: true }]),
    } as unknown as PowensRoutesDependencies['db'],
    redisClient: {
      ping: redisPing ?? (async () => 'PONG'),
    } as PowensRoutesDependencies['redisClient'],
    env: ({
      NODE_ENV: 'test',
      APP_COMMIT_SHA: null,
      APP_VERSION: null,
      PRIVATE_ACCESS_TOKEN: null,
      DEBUG_METRICS_TOKEN: null,
      DATABASE_URL: 'postgres://test',
      REDIS_URL: 'redis://test',
      AUTH_ADMIN_EMAIL: 'givernaudenzo@gmail.com',
      AUTH_SESSION_SECRET: 'x'.repeat(32),
      AUTH_PASSWORD_HASH: 'pbkdf2$sha256$1$test$test',
      AUTH_PASSWORD_HASH_SOURCE: 'AUTH_PASSWORD_HASH',
      POWENS_CLIENT_ID: 'test-client-id',
      POWENS_CLIENT_SECRET: 'test-client-secret',
      APP_ENCRYPTION_KEY: 'a'.repeat(32),
      AUTH_ALLOW_INSECURE_COOKIE_IN_PROD: false,
      AUTH_SESSION_TTL_DAYS: 30,
      AUTH_LOGIN_RATE_LIMIT_PER_MIN: 5,
    } as unknown) as PowensRoutesDependencies['env'],
  }

  return new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      internalAuth: {
        hasValidToken: hasInternalToken,
        tokenSource: hasInternalToken ? 'header' : null,
      },
      requestMeta: {
        requestId: 'req-test',
        startedAtMs: 0,
      },
    }))
    .use(createDebugRoutes(dependencies))
}

describe('createDebugRoutes', () => {
  it('does not expose /debug/ping', async () => {
    const app = createDebugTestApp({ mode: 'demo' })
    const response = await app.handle(new Request('http://finance-os.local/debug/ping'))

    expect(response.status).toBe(404)
  })

  it('keeps /debug/auth available', async () => {
    const app = createDebugTestApp({ mode: 'admin' })
    const response = await app.handle(new Request('http://finance-os.local/debug/auth'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      ok: true,
      requestId: 'req-test',
      hasSession: true,
      isAdmin: true,
      hasInternalToken: false,
      internalTokenSource: null,
      mode: 'admin',
    })
  })

  it('returns explicit database and redis health checks', async () => {
    const app = createDebugTestApp({ mode: 'admin', hasInternalToken: true })
    const response = await app.handle(new Request('http://finance-os.local/debug/health'))
    const payload = (await response.json()) as Record<string, any>

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.checks).toEqual({
      database: expect.objectContaining({ status: 'ok', latencyMs: expect.any(Number) }),
      redis: expect.objectContaining({ status: 'ok', latencyMs: expect.any(Number) }),
    })
  })

  it('surfaces degraded state when a dependency health check fails', async () => {
    const app = createDebugTestApp({
      mode: 'admin',
      hasInternalToken: true,
      dbExecute: async () => {
        throw new Error('database unavailable')
      },
    })
    const response = await app.handle(new Request('http://finance-os.local/debug/health'))
    const payload = (await response.json()) as Record<string, any>

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(false)
    expect(payload.checks.database).toEqual(
      expect.objectContaining({ status: 'error', details: 'database unavailable' })
    )
    expect(payload.checks.redis).toEqual(expect.objectContaining({ status: 'ok' }))
  })
})
