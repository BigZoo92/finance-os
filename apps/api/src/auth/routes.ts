import { Elysia } from 'elysia'
import { getAuth, getRequestMeta } from './context'
import { normalizeEmail, verifyPasswordHash } from './password'
import { consumeRateLimitSlot } from './rate-limit'
import { authLoginBodySchema } from './schemas'
import { createSessionToken, serializeSessionCookie, serializeSessionCookieClear } from './session'
import type { AuthRoutesDependencies } from './types'

const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials'
const RATE_LIMIT_MESSAGE = 'Too many login attempts'
const RATE_LIMIT_WINDOW_SECONDS = 60
const NO_STORE_CACHE_CONTROL = 'no-store'
const BIGZOO_DISPLAY_NAME = 'BigZoo'

const resolveClientIp = (request: Request) => {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwardedFor) {
    return forwardedFor
  }

  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) {
    return realIp
  }

  return 'unknown'
}

const isSecureCookieEnvironment = (nodeEnv: string) => nodeEnv === 'production'

const setNoStoreResponse = (context: { set: { headers: Record<string, unknown> } }) => {
  context.set.headers['cache-control'] = NO_STORE_CACHE_CONTROL
}

export const createAuthRoutes = ({ env, redisClient, verifyPassword }: AuthRoutesDependencies) => {
  const normalizedAdminEmail = normalizeEmail(env.AUTH_ADMIN_EMAIL)
  const secureCookie = isSecureCookieEnvironment(env.NODE_ENV)

  return new Elysia({ prefix: '/auth' })
    .post(
      '/login',
      async context => {
        setNoStoreResponse(context)
        const requestId = getRequestMeta(context).requestId

        const normalizedEmail = normalizeEmail(context.body.email)
        const rateLimit = await consumeRateLimitSlot({
          redisClient,
          key: `auth:login:${resolveClientIp(context.request)}`,
          limit: env.AUTH_LOGIN_RATE_LIMIT_PER_MIN,
          windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
        })

        if (!rateLimit.allowed) {
          context.set.status = 429
          context.set.headers['retry-after'] = String(rateLimit.retryAfterSeconds)
          return {
            ok: false,
            code: 'RATE_LIMITED' as const,
            message: RATE_LIMIT_MESSAGE,
            requestId,
          }
        }

        const passwordMatches = await verifyPasswordHash({
          password: context.body.password,
          passwordHash: env.AUTH_PASSWORD_HASH,
          ...(verifyPassword ? { verifyPassword } : {}),
        })

        const credentialsValid = normalizedEmail === normalizedAdminEmail && passwordMatches

        if (!credentialsValid) {
          context.set.status = 401
          return {
            ok: false,
            code: 'INVALID_CREDENTIALS' as const,
            message: INVALID_CREDENTIALS_MESSAGE,
            requestId,
          }
        }

        const token = createSessionToken({
          secret: env.AUTH_SESSION_SECRET,
          issuedAtSeconds: Math.floor(Date.now() / 1000),
        })

        const sc = serializeSessionCookie({
          token,
          ttlDays: env.AUTH_SESSION_TTL_DAYS,
          secure: secureCookie,
        })

        const prev = context.set.headers['set-cookie']
        context.set.headers['set-cookie'] = prev
          ? Array.isArray(prev)
            ? [...prev, sc]
            : [prev, sc]
          : sc

        return {
          ok: true as const,
          requestId,
        }
      },
      {
        body: authLoginBodySchema,
      }
    )
    .post('/logout', context => {
      setNoStoreResponse(context)
      const requestId = getRequestMeta(context).requestId
      context.set.headers['set-cookie'] = serializeSessionCookieClear({
        secure: secureCookie,
      })

      return {
        ok: true as const,
        requestId,
      }
    })
    .get('/me', context => {
      setNoStoreResponse(context)
      const auth = getAuth(context)
      const requestId = getRequestMeta(context).requestId

      if (auth.mode === 'admin') {
        return {
          mode: 'admin' as const,
          requestId,
          user: {
            email: env.AUTH_ADMIN_EMAIL,
            displayName: BIGZOO_DISPLAY_NAME,
          },
        }
      }

      return {
        mode: 'demo' as const,
        requestId,
        user: null,
      }
    })
}
