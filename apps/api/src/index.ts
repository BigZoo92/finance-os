import { randomUUID } from 'node:crypto'
import { cors } from '@elysiajs/cors'
import { createDbClient } from '@finance-os/db'
import { resolveRuntimeVersion } from '@finance-os/prelude'
import { createRedisClient } from '@finance-os/redis'
import { Elysia } from 'elysia'
import { getAuth, getInternalAuth, getRequestMeta } from './auth/context'
import { deriveAuth } from './auth/derive'
import {
  isDemoModeForbiddenError,
  isInternalTokenRequiredError,
  isInternalTokenValid,
  readInternalTokenFromRequest,
} from './auth/guard'
import { createAuthRoutes } from './auth/routes'
import { env } from './env'
import { logApiEvent, isApiDebugEnabled, toErrorLogFields } from './observability/logger'
import { createDashboardRoutes } from './routes/dashboard/router'
import { createDebugRoutes } from './routes/debug/router'
import { registerSystemRoutes } from './routes/system'
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
  '/debug/config',
  '/__routes',
])

const NO_STORE_EXACT_PATHS = new Set([
  '/auth/login',
  '/auth/logout',
  '/auth/me',
  '/dashboard/derived-recompute',
  '/integrations/powens/callback',
  '/debug/health',
  '/debug/auth',
  '/debug/metrics',
  '/debug/config',
  '/__routes',
  '/debug/routes',
  '/version',
])

const NO_STORE_PREFIX_PATHS = ['/auth/', '/integrations/powens/', '/debug/']

const normalizeCompatibilityPath = (pathname: string) => {
  if (pathname === '/api') {
    return '/'
  }

  if (pathname.startsWith('/api/')) {
    return pathname.slice(4)
  }

  return pathname
}

const shouldSetNoStore = (pathname: string) => {
  const normalizedPath = normalizeCompatibilityPath(pathname)
  if (NO_STORE_EXACT_PATHS.has(normalizedPath)) {
    return true
  }

  return NO_STORE_PREFIX_PATHS.some(prefix => normalizedPath.startsWith(prefix))
}

const getRuntimeVersion = () =>
  resolveRuntimeVersion({
    service: 'api',
    nodeEnv: env.NODE_ENV,
    gitSha: process.env.GIT_SHA,
    gitTag: process.env.GIT_TAG,
    buildTime: process.env.BUILD_TIME,
    appCommitSha: env.APP_COMMIT_SHA,
    appVersion: env.APP_VERSION,
  })

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

type RouteSignature = {
  method: 'GET' | 'POST'
  path: string
}

const REQUIRED_PRODUCTION_ROUTE_SIGNATURES: RouteSignature[] = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: '/version' },
  { method: 'GET', path: '/api/version' },
  { method: 'GET', path: '/auth/me' },
  { method: 'GET', path: '/api/auth/me' },
  { method: 'POST', path: '/integrations/powens/callback' },
  { method: 'POST', path: '/api/integrations/powens/callback' },
]

const hasRouteSignature = ({
  routes,
  signature,
}: {
  routes: Array<{ method: string; path: string }>
  signature: RouteSignature
}) => {
  return routes.some(route => {
    if (route.path !== signature.path) {
      return false
    }

    const methods = route.method
      .split(',')
      .map(value => value.trim().toUpperCase())
      .filter(value => value.length > 0)

    return methods.includes(signature.method)
  })
}

const assertRequiredProductionRoutes = ({
  routes,
}: {
  routes: Array<{ method: string; path: string }>
}) => {
  const missing = REQUIRED_PRODUCTION_ROUTE_SIGNATURES.filter(
    signature => !hasRouteSignature({ routes, signature })
  )

  if (missing.length === 0) {
    return
  }

  const missingRoutes = missing.map(signature => `${signature.method} ${signature.path}`)
  logApiEvent({
    level: 'error',
    msg: 'api startup missing required routes',
    missingRoutes,
  })

  throw new Error(`Missing required API routes: ${missingRoutes.join(', ')}`)
}

const registerAppRoutes = (app: Elysia<any>) => {
  const withFeatureRoutes = app
    .use(
      createAuthRoutes({
        env,
        redisClient: redisClient.client,
      })
    )
    .use(
      createDashboardRoutes({
        db,
        featureEnabled: env.DERIVED_RECOMPUTE_ENABLED,
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

  const withSystemRoutes = registerSystemRoutes(withFeatureRoutes, env)

  return withSystemRoutes.get('/db/health', async () => {
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

  const details = rawIssues.slice(0, 10).map(issue => {
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
        'cache-control': 'no-store',
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
  .use(deriveAuth({ env }))
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

    if (getInternalAuth(context).hasValidToken) {
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
      requestId,
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
    if (shouldSetNoStore(route)) {
      context.set.headers['cache-control'] = 'no-store'
    }

    logApiEvent({
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      msg: 'api request completed',
      route,
      method,
      status,
      durationMs,
      userMode,
      requestId,
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

    set.headers['cache-control'] = 'no-store'
    const routes = listRegisteredRoutes(app)
    return {
      count: routes.length,
      version: getRuntimeVersion(),
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

    set.headers['cache-control'] = 'no-store'
    const routes = listRegisteredRoutes(app)
    return {
      count: routes.length,
      version: getRuntimeVersion(),
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

    set.headers['cache-control'] = 'no-store'
    const routes = listRegisteredRoutes(app)
    return {
      count: routes.length,
      version: getRuntimeVersion(),
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

    set.headers['cache-control'] = 'no-store'
    const routes = listRegisteredRoutes(app)
    return {
      count: routes.length,
      version: getRuntimeVersion(),
      routes,
    }
  })
  .onError(context => {
    const requestId = getRequestMeta(context).requestId ?? resolveRequestId(context.request)
    const startedAtMs = getRequestMeta(context).startedAtMs
    const durationMs = startedAtMs > 0 ? Date.now() - startedAtMs : null
    const userMode = resolveUserMode(context)
    const route = toPathname(context.request)
    context.set.headers['x-request-id'] = requestId
    if (shouldSetNoStore(route)) {
      context.set.headers['cache-control'] = 'no-store'
    }

    let status = 500
    let responseCode = 'INTERNAL_ERROR'
    let message = 'Internal server error'
    let details: unknown = undefined

    if (isDemoModeForbiddenError(context.error)) {
      status = 403
      responseCode = context.error.code
      message = context.error.message
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

    const includeStack = status >= 500 || isApiDebugEnabled()
    const errorFields = toErrorLogFields({
      error: context.error,
      includeStack,
    })

    logApiEvent({
      level: status >= 500 ? 'error' : 'warn',
      msg: 'api request failed',
      route,
      method: context.request.method,
      status,
      durationMs,
      userMode,
      requestId,
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

const registeredRoutes = listRegisteredRoutes(app)
if (env.NODE_ENV === 'production') {
  assertRequiredProductionRoutes({
    routes: registeredRoutes,
  })
}

logApiEvent({
  level: 'info',
  msg: 'api routes mounted',
  routeCount: registeredRoutes.length,
  hasAuthMe: hasRouteSignature({
    routes: registeredRoutes,
    signature: {
      method: 'GET',
      path: '/auth/me',
    },
  }),
  hasApiAuthMe: hasRouteSignature({
    routes: registeredRoutes,
    signature: {
      method: 'GET',
      path: '/api/auth/me',
    },
  }),
  hasPowensCallback: hasRouteSignature({
    routes: registeredRoutes,
    signature: {
      method: 'POST',
      path: '/integrations/powens/callback',
    },
  }),
  hasApiPowensCallback: hasRouteSignature({
    routes: registeredRoutes,
    signature: {
      method: 'POST',
      path: '/api/integrations/powens/callback',
    },
  }),
  hasVersion: hasRouteSignature({
    routes: registeredRoutes,
    signature: {
      method: 'GET',
      path: '/version',
    },
  }),
  hasApiVersion: hasRouteSignature({
    routes: registeredRoutes,
    signature: {
      method: 'GET',
      path: '/api/version',
    },
  }),
  runtimeVersion: getRuntimeVersion(),
  externalIntegrationsSafeMode: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
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
  externalIntegrationsSafeMode: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
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
