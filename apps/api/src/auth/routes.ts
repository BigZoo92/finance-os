import { Elysia } from 'elysia'
import { getAuth } from './context'
import { consumeRateLimitSlot } from './rate-limit'
import { authLoginBodySchema } from './schemas'
import { createSessionToken, serializeSessionCookie, serializeSessionCookieClear } from './session'
import type { AuthRoutesDependencies } from './types'

const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials'
const RATE_LIMIT_MESSAGE = 'Too many login attempts'
const RATE_LIMIT_WINDOW_SECONDS = 60
const NO_STORE_CACHE_CONTROL = 'no-store'

const normalizeEmail = (value: string) => value.trim().toLowerCase()

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

export const createAuthRoutes = ({ env, redisClient }: AuthRoutesDependencies) => {
  const normalizedAdminEmail = normalizeEmail(env.AUTH_ADMIN_EMAIL)
  const secureCookie = isSecureCookieEnvironment(env.NODE_ENV)

  return new Elysia({ prefix: '/auth' })
    .post(
      '/login',
      async context => {
        setNoStoreResponse(context)

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
            message: RATE_LIMIT_MESSAGE,
          }
        }

        const passwordMatches = await Bun.password.verify(
          context.body.password,
          env.AUTH_PASSWORD_HASH
        )
        const credentialsValid = normalizedEmail === normalizedAdminEmail && passwordMatches

        if (!credentialsValid) {
          context.set.status = 401
          return {
            ok: false,
            message: INVALID_CREDENTIALS_MESSAGE,
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

        return { ok: true }
      },
      {
        body: authLoginBodySchema,
      }
    )
    .post('/logout', context => {
      setNoStoreResponse(context)
      context.set.headers['set-cookie'] = serializeSessionCookieClear({
        secure: secureCookie,
      })

      return { ok: true }
    })
    .get('/me', context => {
      setNoStoreResponse(context)
      return {
        mode: getAuth(context).mode,
      }
    })
}
