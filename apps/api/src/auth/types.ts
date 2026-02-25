import type { getApiEnv } from '@finance-os/env'
import type { createRedisClient } from '@finance-os/redis'

export type ApiEnv = ReturnType<typeof getApiEnv>
export type RedisClient = ReturnType<typeof createRedisClient>['client']

export type AuthMode = 'admin' | 'demo'

export interface AuthState {
  mode: AuthMode
}

export interface AuthSessionPayload {
  admin: true
  iat: number
}

export interface AuthRoutesDependencies {
  env: ApiEnv
  redisClient: RedisClient
}
