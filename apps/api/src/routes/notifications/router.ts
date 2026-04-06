import { Elysia } from 'elysia'
import { createPushNotificationsRoute } from './routes/push'
import type { ApiEnv, RedisClient } from './types'

export const createNotificationsRoutes = ({
  redis,
  env,
}: {
  redis: RedisClient
  env: ApiEnv
}) => {
  return new Elysia({ prefix: '/notifications' }).use(
    createPushNotificationsRoute({
      redis,
      env,
    })
  )
}
