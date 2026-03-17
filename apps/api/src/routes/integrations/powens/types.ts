import type { createDbClient } from '@finance-os/db'
import type { getApiEnv } from '@finance-os/env'
import type { PowensAccount, PowensTokenResponse, PowensTransaction } from '@finance-os/powens'
import type { createRedisClient } from '@finance-os/redis'

export type ApiDb = ReturnType<typeof createDbClient>['db']
export type RedisClient = ReturnType<typeof createRedisClient>['client']
export type ApiEnv = ReturnType<typeof getApiEnv>

export interface PowensRoutesDependencies {
  db: ApiDb
  redisClient: RedisClient
  env: ApiEnv
}

export type PowensClient = {
  exchangeCodeForToken: (code: string) => Promise<PowensTokenResponse>
  listConnectionAccounts: (connectionId: string, accessToken: string) => Promise<PowensAccount[]>
  listAccountTransactions: (params: {
    accountId: string
    accessToken: string
    minDate: string
    maxDate: string
    limit?: number
  }) => Promise<PowensTransaction[]>
}

export interface PowensConnectionStatusView {
  id: number
  powensConnectionId: string
  status: 'connected' | 'syncing' | 'error' | 'reconnect_required'
  lastSyncAt: Date | null
  lastSuccessAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PowensSyncRunView {
  id: string
  requestId: string | null
  connectionId: string
  startedAt: string
  endedAt: string | null
  result: 'running' | 'success' | 'error' | 'reconnect_required'
}

export interface PowensConnectionRepository {
  upsertConnectedConnection: (params: {
    connectionId: string
    encryptedAccessToken: string
    now: Date
  }) => Promise<void>
  listConnectionStatuses: () => Promise<PowensConnectionStatusView[]>
  listSyncRuns: (limit?: number) => Promise<PowensSyncRunView[]>
}

export interface PowensJobQueueRepository {
  enqueueConnectionSync: (params: { connectionId: string; requestId?: string }) => Promise<void>
  enqueueAllConnectionsSync: (params?: { requestId?: string }) => Promise<void>
  getSyncBacklogCount: () => Promise<number>
}

export interface PowensSyncGuardRepository {
  acquireManualSyncSlot: () => Promise<{
    allowed: boolean
    retryAfterSeconds: number
  }>
}

export interface PowensConnectUrlService {
  getConnectUrl: () => string
  isCallbackStateValid: (state: string | undefined) => boolean
}

export interface PowensUseCases {
  handleCallback: (input: { connectionId: string; encodedCode: string; requestId?: string }) => Promise<void>
  requestSync: (connectionId?: string, options?: { requestId?: string }) => Promise<void>
  listStatuses: () => Promise<PowensConnectionStatusView[]>
  listSyncRuns: (limit?: number) => Promise<PowensSyncRunView[]>
  getSyncBacklogCount: () => Promise<number>
}

export interface PowensRouteRuntime {
  services: {
    client: PowensClient
    connectUrl: PowensConnectUrlService
  }
  repositories: {
    connection: PowensConnectionRepository
    jobs: PowensJobQueueRepository
    syncGuard: PowensSyncGuardRepository
  }
  useCases: PowensUseCases
}
