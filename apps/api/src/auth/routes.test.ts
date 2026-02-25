import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { AUTH_SESSION_COOKIE_NAME } from './session'
import { createAuthRoutes } from './routes'
import type { AuthRoutesDependencies } from './types'

const createAuthTestEnv = (
  overrides?: Partial<AuthRoutesDependencies['env']>
) =>
  ({
    NODE_ENV: 'test',
    AUTH_ADMIN_EMAIL: 'givernaudenzo@gmail.com',
    AUTH_LOGIN_RATE_LIMIT_PER_MIN: 5,
    AUTH_PASSWORD_HASH: '$argon2id$v=19$m=65536,t=2,p=1$test$test',
    AUTH_ALLOW_INSECURE_COOKIE_IN_PROD: false,
    AUTH_SESSION_SECRET: 'x'.repeat(32),
    AUTH_SESSION_TTL_DAYS: 30,
    ...overrides,
  }) as unknown as AuthRoutesDependencies['env']

const createRedisClientMock = () => {
  const attemptsByKey = new Map<string, number>()
  const ttlByKey = new Map<string, number>()

  return {
    async incr(key: string) {
      const nextValue = (attemptsByKey.get(key) ?? 0) + 1
      attemptsByKey.set(key, nextValue)
      return nextValue
    },
    async expire(key: string, seconds: number) {
      ttlByKey.set(key, seconds)
      return 1
    },
    async ttl(key: string) {
      return ttlByKey.get(key) ?? 60
    },
  } as unknown as AuthRoutesDependencies['redisClient']
}

const createAuthTestApp = ({
  mode,
  verifyPassword,
  envOverrides,
}: {
  mode: 'admin' | 'demo'
  verifyPassword?: AuthRoutesDependencies['verifyPassword']
  envOverrides?: Partial<AuthRoutesDependencies['env']>
}) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      requestMeta: {
        requestId: 'req-test',
        startedAtMs: 0,
      },
    }))
    .use(
      createAuthRoutes({
        env: createAuthTestEnv(envOverrides),
        redisClient: createRedisClientMock(),
        ...(verifyPassword ? { verifyPassword } : {}),
      })
    )

describe('createAuthRoutes /auth/me', () => {
  it('returns demo payload when session is not admin', async () => {
    const app = createAuthTestApp({
      mode: 'demo',
    })
    const response = await app.handle(new Request('http://finance-os.local/auth/me'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(payload).toEqual({
      mode: 'demo',
      requestId: 'req-test',
      user: null,
    })
  })

  it('returns admin user payload when session is admin', async () => {
    const app = createAuthTestApp({
      mode: 'admin',
    })
    const response = await app.handle(new Request('http://finance-os.local/auth/me'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      mode: 'admin',
      requestId: 'req-test',
      user: {
        email: 'givernaudenzo@gmail.com',
        displayName: 'BigZoo',
      },
    })
  })

  it('sets a signed session cookie on successful login', async () => {
    const app = createAuthTestApp({
      mode: 'demo',
      verifyPassword: async password => password === 'valid-password',
    })

    const response = await app.handle(
      new Request('http://finance-os.local/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-real-ip': '127.0.0.1',
        },
        body: JSON.stringify({
          email: 'givernaudenzo@gmail.com',
          password: 'valid-password',
        }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      ok: true,
      requestId: 'req-test',
    })

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toContain(`${AUTH_SESSION_COOKIE_NAME}=`)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
    expect(setCookie).toContain('Path=/')
  })

  it('rejects invalid credentials on login', async () => {
    const app = createAuthTestApp({
      mode: 'demo',
      verifyPassword: async () => false,
    })

    const response = await app.handle(
      new Request('http://finance-os.local/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-real-ip': '127.0.0.1',
        },
        body: JSON.stringify({
          email: 'givernaudenzo@gmail.com',
          password: 'wrong-password',
        }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({
      ok: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials',
      requestId: 'req-test',
    })
  })

  it('adds Secure to the session cookie in production by default', async () => {
    const app = createAuthTestApp({
      mode: 'demo',
      verifyPassword: async password => password === 'valid-password',
      envOverrides: {
        NODE_ENV: 'production',
      } as Partial<AuthRoutesDependencies['env']>,
    })

    const response = await app.handle(
      new Request('http://finance-os.local/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-real-ip': '127.0.0.1',
        },
        body: JSON.stringify({
          email: 'givernaudenzo@gmail.com',
          password: 'valid-password',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('Secure')
  })

  it('can omit Secure in production when local debug override is enabled', async () => {
    const app = createAuthTestApp({
      mode: 'demo',
      verifyPassword: async password => password === 'valid-password',
      envOverrides: {
        NODE_ENV: 'production',
        AUTH_ALLOW_INSECURE_COOKIE_IN_PROD: true,
      } as Partial<AuthRoutesDependencies['env']>,
    })

    const response = await app.handle(
      new Request('http://finance-os.local/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-real-ip': '127.0.0.1',
        },
        body: JSON.stringify({
          email: 'givernaudenzo@gmail.com',
          password: 'valid-password',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).not.toContain('Secure')
  })

  it('clears session cookie on logout', async () => {
    const app = createAuthTestApp({
      mode: 'admin',
    })

    const response = await app.handle(
      new Request('http://finance-os.local/auth/logout', {
        method: 'POST',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      ok: true,
      requestId: 'req-test',
    })

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toContain(`${AUTH_SESSION_COOKIE_NAME}=`)
    expect(setCookie).toContain('Max-Age=0')
  })
})
