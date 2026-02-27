import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createAuthRoutes } from './routes'
import type { AuthRoutesDependencies } from './types'

const createAuthTestEnv = () =>
  ({
    NODE_ENV: 'test',
    AUTH_ADMIN_EMAIL: 'givernaudenzo@gmail.com',
    AUTH_LOGIN_RATE_LIMIT_PER_MIN: 5,
    AUTH_PASSWORD_HASH: '$argon2id$v=19$m=65536,t=2,p=1$test$test',
    AUTH_SESSION_SECRET: 'x'.repeat(32),
    AUTH_SESSION_TTL_DAYS: 30,
  }) as unknown as AuthRoutesDependencies['env']

const createAuthTestApp = (mode: 'admin' | 'demo') =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
    }))
    .use(
      createAuthRoutes({
        env: createAuthTestEnv(),
        redisClient: {} as AuthRoutesDependencies['redisClient'],
      })
    )

describe('createAuthRoutes /auth/me', () => {
  it('returns demo mode with user null when session is not admin', async () => {
    const app = createAuthTestApp('demo')
    const response = await app.handle(new Request('http://finance-os.local/auth/me'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(payload).toEqual({
      mode: 'demo',
      requestId: 'unknown',
      user: null,
    })
  })

  it('returns admin user payload when session is admin', async () => {
    const app = createAuthTestApp('admin')
    const response = await app.handle(new Request('http://finance-os.local/auth/me'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      mode: 'admin',
      requestId: 'unknown',
      user: {
        email: 'givernaudenzo@gmail.com',
        displayName: 'BigZoo',
      },
    })
  })
})
