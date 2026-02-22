import { cors } from '@elysiajs/cors'
import { createDbClient } from '@finance-os/db'
import { createRedisClient } from '@finance-os/redis'
import { Elysia } from 'elysia'
import { env } from './env'
import { createDebugRoutes } from './routes/debug/router'
import { createDashboardRoutes } from './routes/dashboard/router'
import { createPowensRoutes } from './routes/integrations/powens/router'

const { db, sql, close } = createDbClient(env.DATABASE_URL)
const redisClient = createRedisClient(env.REDIS_URL)
const PUBLIC_PATHS = new Set(['/health', '/db/health'])

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
  .onBeforeHandle(({ request, set }) => {
    if (!env.PRIVATE_ACCESS_TOKEN) {
      return
    }

    if (request.method === 'OPTIONS') {
      return
    }

    const pathname = new URL(request.url).pathname
    if (PUBLIC_PATHS.has(pathname)) {
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
  .onError(({ code, error }) => {
    const message = error instanceof Error ? error.message : String(error)

    return new Response(
      JSON.stringify({
        status: 'error',
        code,
        message,
      }),
      {
        status: 500,
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
