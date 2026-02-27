import { cors } from '@elysiajs/cors'
import { createDbClient } from '@finance-os/db'
import { createRedisClient } from '@finance-os/redis'
import { Elysia } from 'elysia'
import { demoAccessDeniedResponse, isAdminRequiredError } from './auth/guard'
import { createAuthRoutes } from './auth/routes'
import { readSessionFromCookie } from './auth/session'
import { env } from './env'
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

  return nodeEnv !== 'production' && DEV_AUTH_PUBLIC_PATHS.has(pathname)
}

const canAccessRoutesDebug = (request: Request) => {
  if (env.NODE_ENV !== 'production') {
    return true
  }

  if (!env.PRIVATE_ACCESS_TOKEN) {
    return false
  }

  const provided = request.headers.get('x-finance-os-access-token')
  return provided === env.PRIVATE_ACCESS_TOKEN
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

await redisClient.connect()

const app = new Elysia()
  .use(
    cors({
      origin: [env.WEB_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      allowedHeaders: [
        'Accept',
        'Content-Type',
        'x-finance-os-access-token',
        'x-finance-os-debug-token',
      ],
      exposeHeaders: ['retry-after', 'x-robots-tag'],
    })
  )
  .derive(({ request }) => {
    const session = readSessionFromCookie({
      cookieHeader: request.headers.get('cookie'),
      secret: env.AUTH_SESSION_SECRET,
      ttlDays: env.AUTH_SESSION_TTL_DAYS,
    })

    return {
      auth: { mode: session?.admin === true ? 'admin' : 'demo' } as const,
    }
  })
  .onBeforeHandle(({ request, set }) => {
    if (!env.PRIVATE_ACCESS_TOKEN) {
      return
    }

    if (request.method === 'OPTIONS') {
      return
    }

    const pathname = new URL(request.url).pathname
    if (
      shouldBypassPrivateAccessGate({
        pathname,
        nodeEnv: env.NODE_ENV,
      })
    ) {
      return
    }

    const provided = request.headers.get('x-finance-os-access-token')
    if (provided === env.PRIVATE_ACCESS_TOKEN) {
      return
    }

    set.status = 401
    return {
      status: 'error',
      message: 'Unauthorized',
    }
  })
  .onAfterHandle(({ set }) => {
    set.headers['x-robots-tag'] = 'noindex, nofollow, noarchive'
  })
  .use(registerAppRoutes(new Elysia()))
  .use(registerAppRoutes(new Elysia({ prefix: '/api' })))
  .get('/__routes', ({ request, set }) => {
    if (!canAccessRoutesDebug(request)) {
      set.status = 403
      return {
        status: 'error',
        message: 'Route debug endpoint is disabled in production without PRIVATE_ACCESS_TOKEN',
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
        message: 'Route debug endpoint is disabled in production without PRIVATE_ACCESS_TOKEN',
      }
    }

    const routes = listRegisteredRoutes(app)
    return {
      count: routes.length,
      routes,
    }
  })
  .onError(({ code, error }) => {
    if (isAdminRequiredError(error)) {
      return new Response(JSON.stringify(demoAccessDeniedResponse), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    }

    const status = code === 'VALIDATION' ? 400 : 500
    const message =
      status === 500
        ? 'Internal server error'
        : error instanceof Error
          ? error.message
          : String(error)

    return new Response(
      JSON.stringify({
        status: 'error',
        code,
        message,
      }),
      {
        status,
        headers: { 'content-type': 'application/json' },
      }
    )
  })

app.listen({
  hostname: env.API_HOST,
  port: env.API_PORT,
})

console.log(`[api] listening on http://${env.API_HOST}:${env.API_PORT}`)

const shutdown = async (signal: string) => {
  console.log(`[api] received ${signal}, shutting down...`)
  await Promise.allSettled([close(), redisClient.close()])
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
