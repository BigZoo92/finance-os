import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createDebugRoutes } from './router'
import type { PowensRoutesDependencies } from '../integrations/powens/types'

const createDebugTestApp = ({
  mode,
}: {
  mode: 'admin' | 'demo'
}) => {
  const dependencies = {
    db: {} as PowensRoutesDependencies['db'],
    redisClient: {} as PowensRoutesDependencies['redisClient'],
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
        hasValidToken: false,
        tokenSource: null,
      },
      requestMeta: {
        requestId: 'req-test',
        startedAtMs: 0,
      },
    }))
    .use(createDebugRoutes(dependencies))
}

describe('createDebugRoutes /debug/ping', () => {
  it('returns pong in demo mode', async () => {
    const app = createDebugTestApp({ mode: 'demo' })
    const response = await app.handle(new Request('http://finance-os.local/debug/ping'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      ok: true,
      message: 'pong',
      mode: 'demo',
      requestId: 'req-test',
    })
  })

  it('returns pong in admin mode', async () => {
    const app = createDebugTestApp({ mode: 'admin' })
    const response = await app.handle(new Request('http://finance-os.local/debug/ping'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      ok: true,
      message: 'pong',
      mode: 'admin',
      requestId: 'req-test',
    })
  })
})
