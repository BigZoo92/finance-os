import { createDbClient } from '@finance-os/db'
import { createRedisClient } from '@finance-os/redis'
import { env } from './env'

const dbClient = createDbClient(env.DATABASE_URL)
const redisClient = createRedisClient(env.REDIS_URL)

let heartbeatTimer: ReturnType<typeof setInterval> | null = null

const pingDatabase = async () => {
  const result = await dbClient.sql<{ now: string }[]>`
    select now()::text as now
  `

  return result[0]?.now ?? null
}

const start = async () => {
  await redisClient.connect()

  const [databaseTime, redisPong] = await Promise.all([pingDatabase(), redisClient.ping()])

  console.log('[worker] started')
  console.log('[worker] database: ok')
  console.log('[worker] redis:', redisPong)
  console.log('[worker] databaseTime:', databaseTime)
  console.log('[worker] heartbeat every', env.WORKER_HEARTBEAT_MS, 'ms')

  heartbeatTimer = setInterval(async () => {
    try {
      const [dbNow, pong] = await Promise.all([pingDatabase(), redisClient.ping()])

      console.log('[worker] heartbeat ok - db:', dbNow, '- redis:', pong)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[worker] heartbeat failed:', message)
    }
  }, env.WORKER_HEARTBEAT_MS)
}

const shutdown = async (signal: string) => {
  console.log(`[worker] received ${signal}, shutting down...`)

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }

  await Promise.allSettled([dbClient.close(), redisClient.close()])
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

void start().catch(async error => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  console.error('[worker] fatal error:\n', message)
  await Promise.allSettled([dbClient.close(), redisClient.close()])
  process.exit(1)
})
