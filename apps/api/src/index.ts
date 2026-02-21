import { cors } from '@elysiajs/cors'
import { createDbClient } from '@finance-os/db'
import { Elysia } from 'elysia'
import { env } from './env'

const { sql, close } = createDbClient(env.DATABASE_URL)

const app = new Elysia()
  .use(
    cors({
      origin: [env.WEB_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
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
    return new Response(
      JSON.stringify({
        status: 'error',
        code,
        message: error,
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
  await close()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
