import { randomUUID } from 'node:crypto'
import { cors } from '@elysiajs/cors'
import { createDbClient } from '@finance-os/db'
import { createRedisClient } from '@finance-os/redis'
import { Elysia } from 'elysia'
import { getAuth, getInternalAuth, getRequestMeta } from './auth/context'
import {
  demoAccessDeniedResponse,
  isDemoModeForbiddenError,
  isInternalTokenRequiredError,
  isInternalTokenValid,
  readInternalTokenFromRequest,
} from './auth/guard'
import { createAuthRoutes } from './auth/routes'
import { readSessionFromCookie } from './auth/session'
import { env } from './env'
import { logApiEvent, isApiDebugEnabled, toErrorLogFields } from './observability/logger'
import { createDashboardRoutes } from './routes/dashboard/router'
import { createDebugRoutes } from './routes/debug/router'
import { createPowensRoutes } from './routes/integrations/powens/router'

const { db, sql, close } = createDbClient(env.DATABASE_URL)
const redisClient = createRedisClient(env.REDIS_URL)

const withApiCompatibilityPaths = (paths: string[]) => {
  const expanded = new Set<string>()

  for (const path of paths) {
    expanded.add(path)
    expanded.add(`/api${path}`)
  }

  return expanded
}

const ALWAYS_PUBLIC_PATHS = withApiCompatibilityPaths(['/health', '/db/health'])
const DEV_AUTH_PUBLIC_PATHS = withApiCompatibilityPaths(['/auth/login', '/auth/logout', '/auth/me'])
const DEV_DEBUG_PUBLIC_PATHS = withApiCompatibilityPaths(['/debug/auth'])
const INTERNAL_TOKEN_PROTECTED_PATHS = withApiCompatibilityPaths([
  '/debug/metrics',
  '/debug/health',
  '/debug/auth',
  '/__routes',
])

const shouldBypassPrivateAccessGate = ({
  pathname,
  nodeEnv,
}: {
  pathname: string
  nodeEnv: string
}) => {
  if (ALWAYS_PUBLIC_PATHS.has(pathname)) {
    return true
  }

  if (nodeEnv !== 'production' && DEV_AUTH_PUBLIC_PATHS.has(pathname)) {
    return true
  }

  if (nodeEnv !== 'production' && DEV_DEBUG_PUBLIC_PATHS.has(pathname)) {
    return true
  }

  return !INTERNAL_TOKEN_PROTECTED_PATHS.has(pathname)
}

const resolveRequestId = (request: Request) => {
  const provided = request.headers.get('x-request-id')?.trim()
  return provided && provided.length > 0 ? provided : randomUUID()
}

const canAccessRoutesDebug = (request: Request) => {
  if (env.NODE_ENV !== 'production') {
    return true
  }

  const debugTokenHeader = request.headers.get('x-finance-os-debug-token')?.trim()
  if (env.DEBUG_METRICS_TOKEN && debugTokenHeader === env.DEBUG_METRICS_TOKEN) {
    return true
  }

  const { token } = readInternalTokenFromRequest(request)
  return isInternalTokenValid({
    providedToken: token,
    env,
  })
}

const listRegisteredRoutes = (app: { routes?: unknown[] }) => {
  const routes = app.routes
  if (!Array.isArray(routes)) {
    return []
  }

  const seen = new Set<string>()
  const normalized = routes
    .map(route => {
      const candidate = route as { method?: unknown; path?: unknown }
      const methodValue = candidate.method
      const method =
        typeof methodValue === 'string'
          ? methodValue.toUpperCase()
          : Array.isArray(methodValue)
            ? methodValue.map(value => String(value).toUpperCase()).join(',')
            : 'UNKNOWN'
      const path = typeof candidate.path === 'string' ? candidate.path : '/'
      const key = `${method} ${path}`

      if (seen.has(key)) {
        return null
      }

      seen.add(key)
      return { method, path }
    })
    .filter((route): route is { method: string; path: string } => route !== null)

  return normalized.sort((a, b) => {
    if (a.path === b.path) {
      return a.method.localeCompare(b.method)
    }

    return a.path.localeCompare(b.path)
  })
}

const registerAppRoutes = (app: Elysia<any>) => {
  return app
    .use(
      createAuthRoutes({
        env,
        redisClient: redisClient.client,
      })
    )
    .use(
      createDashboardRoutes({
        db,
      })
    )
    .use(
      createPowensRoutes({
        db,
        redisClient: redisClient.client,
        env,
      })
    )
    .use(
      createDebugRoutes({
        db,
        redisClient: redisClient.client,
        env,
      })
    )
    .get('/health', () => {
      return {
        status: 'ok',
        service: 'api',
        timestamp: new Date().toISOString(),
      }
    })
    .get('/db/health', async () => {
      const result = await sql<{ now: string }[]>`
        select now()::text as now
      `

      return {
        status: 'ok',
        service: 'api',
        database: 'ok',
        databaseTime: result[0]?.now ?? null,
        timestamp: new Date().toISOString(),
      }
    })
}

const toPathname = (request: Request) => {
  return new URL(request.url).pathname
}

const resolveStatusCode = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return 200
}

const resolveUserMode = (context: object) => {
  const auth = getAuth(context)
  const internalAuth = getInternalAuth(context)

  if (auth.mode === 'admin') {
    return 'admin'
  }

  if (internalAuth.hasValidToken) {
    return 'internal'
  }

  return 'demo'
}

const toValidationDetails = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  const rawIssues = (error as { all?: unknown }).all
  if (!Array.isArray(rawIssues)) {
    return undefined
  }

  const details = rawIssues
    .slice(0, 10)
    .map(issue => {
      if (!issue || typeof issue !== 'object') {
        return {
          path: 'unknown',
          message: String(issue),
        }
      }

      const source = issue as {
        path?: string
        schema?: { error?: string }
        summary?: string
        message?: string
      }

      return {
        path: source.path ?? 'unknown',
        message: source.message ?? source.summary ?? source.schema?.error ?? 'Invalid input',
      }
    })

  return details.length > 0 ? details : undefined
}

const buildApiErrorResponse = ({
  status,
  code,
  message,
  requestId,
  details,
}: {
  status: number
  code: string
  message: string
  requestId: string
  details?: unknown
}) => {
  return new Response(
    JSON.stringify({
      ok: false,
      code,
      message,
      requestId,
      ...(details === undefined ? {} : { details }),
    }),
    {
      status,
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
      },
    }
  )
}

await redisClient.connect()

const app = new Elysia()
  .use(
    cors({
      origin: [env.WEB_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      allowedHeaders: [
        'Accept',
        'Content-Type',
        'authorization',
        'x-finance-os-access-token',
        'x-finance-os-debug-token',
        'x-internal-token',
        'x-request-id',
      ],
      exposeHeaders: ['retry-after', 'x-request-id', 'x-robots-tag'],
    })
  )
  .derive(({ request, set }) => {
    const requestId = resolveRequestId(request)
    set.headers['x-request-id'] = requestId

    const session = readSessionFromCookie({
      cookieHeader: request.headers.get('cookie'),
      secret: env.AUTH_SESSION_SECRET,
      ttlDays: env.AUTH_SESSION_TTL_DAYS,
    })

    const { token, source } = readInternalTokenFromRequest(request)
    const hasValidToken = isInternalTokenValid({
      providedToken: token,
      env,
    })

    return {
      requestMeta: {
        requestId,
        startedAtMs: Date.now(),
      },
      auth: { mode: session?.admin === true ? 'admin' : 'demo' } as const,
      internalAuth: {
        hasValidToken,
        tokenSource: source,
      } as const,
    }
  })
  .onBeforeHandle(context => {
    if (!env.PRIVATE_ACCESS_TOKEN) {
      return
    }

    if (context.request.method === 'OPTIONS') {
      return
    }

    const pathname = toPathname(context.request)
    if (
      shouldBypassPrivateAccessGate({
        pathname,
        nodeEnv: env.NODE_ENV,
      })
    ) {
      return
    }

    if (context.internalAuth.hasValidToken) {
      return
    }

    context.set.status = 401
    const requestId = getRequestMeta(context).requestId
    logApiEvent({
      level: 'warn',
      msg: 'api request denied by internal token gate',
      route: pathname,
      method: context.request.method,
      status: 401,
      correlationId: requestId,
      errName: 'InternalTokenRequiredError',
      errMessage: 'Internal token required',
    })

    return {
      ok: false,
      code: 'INTERNAL_TOKEN_REQUIRED',
      message: 'Internal token required',
      requestId,
    }
  })
  .onAfterHandle(context => {
    const requestId = getRequestMeta(context).requestId
    const startedAtMs = getRequestMeta(context).startedAtMs
    const durationMs = startedAtMs > 0 ? Date.now() - startedAtMs : null
    const status = resolveStatusCode(context.set.status)
    const userMode = resolveUserMode(context)
    const route = toPathname(context.request)
    const method = context.request.method
    context.set.headers['x-robots-tag'] = 'noindex, nofollow, noarchive'
    context.set.headers['x-request-id'] = requestId

    logApiEvent({
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      msg: 'api request completed',
      route,
      method,
      status,
      durationMs,
      userMode,
      correlationId: requestId,
    })
  })
  .use(registerAppRoutes(new Elysia()))
  .use(registerAppRoutes(new Elysia({ prefix: '/api' })))
  .get('/__routes', ({ request, set }) => {
    if (!canAccessRoutesDebug(request)) {
      set.status = 403
      return {
        status: 'error',
        message: 'Route debug endpoint requires x-finance-os-debug-token or internal token',
      }
    }

    const routes = listRegisteredRoutes(app)
    return {
      count: routes.length,
      routes,
    }
  })
  .get('/api/__routes', ({ request, set }) => {
    if (!canAccessRoutesDebug(request)) {
      set.status = 403
      return {
        status: 'error',
        message: 'Route debug endpoint requires x-finance-os-debug-token or internal token',
      }
    }

    const routes = listRegisteredRoutes(app)
    return {
      count: routes.length,
      routes,
    }
  })
  .get('/debug/routes', ({ request, set }) => {
    if (!canAccessRoutesDebug(request)) {
      set.status = 403
      return {
        status: 'error',
        message: 'Route debug endpoint requires x-finance-os-debug-token or internal token',
      }
    }

    const routes = listRegisteredRoutes(app)
    return {
      count: routes.length,
      routes,
    }
  })
  .get('/api/debug/routes', ({ request, set }) => {
    if (!canAccessRoutesDebug(request)) {
      set.status = 403
      return {
        status: 'error',
        message: 'Route debug endpoint requires x-finance-os-debug-token or internal token',
      }
    }

    const routes = listRegisteredRoutes(app)
    return {
      count: routes.length,
      routes,
    }
  })
  .onError(context => {
    const requestId = getRequestMeta(context).requestId ?? resolveRequestId(context.request)
    const startedAtMs = getRequestMeta(context).startedAtMs
    const durationMs = startedAtMs > 0 ? Date.now() - startedAtMs : null
    const userMode = resolveUserMode(context)
    context.set.headers['x-request-id'] = requestId

    let status = 500
    let responseCode = 'INTERNAL_ERROR'
    let message = 'Internal server error'
    let details: unknown = undefined

    if (isDemoModeForbiddenError(context.error)) {
      status = 403
      responseCode = context.error.code
      message = demoAccessDeniedResponse.message
    } else if (isInternalTokenRequiredError(context.error)) {
      status = 401
      responseCode = context.error.code
      message = context.error.message
    } else if (context.code === 'VALIDATION' || context.code === 'PARSE') {
      status = 400
      responseCode = 'INVALID_INPUT'
      message = 'Invalid request payload'
      details = toValidationDetails(context.error)
    } else if (context.code === 'NOT_FOUND') {
      status = 404
      responseCode = 'ROUTE_NOT_FOUND'
      message = 'Route not found'
    }

    const includeStack = isApiDebugEnabled()
    const errorFields = toErrorLogFields({
      error: context.error,
      includeStack,
    })

    logApiEvent({
      level: status >= 500 ? 'error' : 'warn',
      msg: 'api request failed',
      route: toPathname(context.request),
      method: context.request.method,
      status,
      durationMs,
      userMode,
      correlationId: requestId,
      ...errorFields,
    })

    return buildApiErrorResponse({
      status,
      code: responseCode,
      message,
      requestId,
      details,
    })
  })

app.listen({
  hostname: env.API_HOST,
  port: env.API_PORT,
})

logApiEvent({
  level: 'info',
  msg: 'api listening',
  host: env.API_HOST,
  port: env.API_PORT,
})

const shutdown = async (signal: string) => {
  logApiEvent({
    level: 'info',
    msg: 'api shutdown signal received',
    signal,
  })
  await Promise.allSettled([close(), redisClient.close()])
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
