import type { createDbClient } from '@finance-os/db'
import type { getApiEnv } from '@finance-os/env'
import type { PowensAccount, PowensTokenResponse, PowensTransaction } from '@finance-os/powens'
import type { createRedisClient } from '@finance-os/redis'
import type { DiagnosticsServiceResponse } from './domain/diagnostics'

export type ApiDb = ReturnType<typeof createDbClient>['db']
export type RedisClient = ReturnType<typeof createRedisClient>['client']
export type ApiEnv = ReturnType<typeof getApiEnv>

export type PowensPersistedSyncStatus = 'OK' | 'KO'
export type PowensPersistedSyncReasonCode =
  | 'SUCCESS'
  | 'PARTIAL_IMPORT'
  | 'SYNC_FAILED'
  | 'RECONNECT_REQUIRED'

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
  source: string
  provider: string
  powensConnectionId: string
  providerConnectionId: string
  providerInstitutionId: string | null
  providerInstitutionName: string | null
  status: 'connected' | 'syncing' | 'error' | 'reconnect_required'
  lastSyncStatus: PowensPersistedSyncStatus | null
  lastSyncReasonCode: PowensPersistedSyncReasonCode | null
  lastSyncAttemptAt: Date | null
  lastSyncAt: Date | null
  lastSuccessAt: Date | null
  lastFailedAt: Date | null
  lastError: string | null
  syncMetadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

export interface PowensConnectionDisconnectResult {
  disconnected: boolean
  connectionId: string
}

export interface PowensSyncRunView {
  id: string
  requestId: string | null
  connectionId: string
  startedAt: string
  endedAt: string | null
  result: 'running' | 'success' | 'error' | 'reconnect_required'
  errorMessage?: string
  errorFingerprint?: string
}

export interface PowensConnectionRepository {
  upsertConnectedConnection: (params: {
    connectionId: string
    encryptedAccessToken: string
    now: Date
  }) => Promise<void>
  disconnectConnection: (params: {
    connectionId: string
    now: Date
    reason: string
  }) => Promise<PowensConnectionDisconnectResult>
  listConnectionStatuses: () => Promise<PowensConnectionStatusView[]>
  listSyncRuns: (limit?: number) => Promise<PowensSyncRunView[]>
}

export interface PowensJobQueueRepository {
  enqueueConnectionSync: (params: {
    connectionId: string
    requestId?: string
    fullResync?: boolean
  }) => Promise<void>
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
  isExternalIntegrationsSafeModeEnabled: () => boolean
}

export interface PowensUseCases {
  handleCallback: (input: {
    connectionId: string
    encodedCode: string
    requestId?: string
  }) => Promise<void>
  requestSync: (
    connectionId?: string,
    options?: { requestId?: string; fullResync?: boolean }
  ) => Promise<void>
  listStatuses: () => Promise<PowensConnectionStatusView[]>
  listSyncRuns: (limit?: number) => Promise<PowensSyncRunView[]>
  getSyncBacklogCount: () => Promise<number>
  disconnectConnection: (connectionId: string) => Promise<PowensConnectionDisconnectResult>
}

export type PowensAdminAuditAction =
  | 'connect_url'
  | 'manual_sync'
  | 'callback'
  | 'disconnect_connection'
export type PowensAdminAuditResult = 'allowed' | 'blocked' | 'failed'

export interface PowensAdminAuditEvent {
  id: string
  action: PowensAdminAuditAction
  result: PowensAdminAuditResult
  actorMode: 'admin' | 'state'
  at: string
  requestId: string
  details?: string
  connectionId?: string
}

export interface PowensLatestCallbackView {
  receivedAt: string
  status: PowensAdminAuditResult
  actorMode: 'admin' | 'state'
  requestId: string
  connectionId?: string
  details?: string
}

export interface PowensAdminAuditService {
  recordEvent: (event: PowensAdminAuditEvent) => Promise<void>
  listRecentEvents: (limit?: number) => Promise<PowensAdminAuditEvent[]>
  getLatestCallback: () => Promise<PowensLatestCallbackView | null>
}

export interface PowensRouteRuntime {
  services: {
    client: PowensClient
    connectUrl: PowensConnectUrlService
    adminAudit: PowensAdminAuditService
    diagnostics: {
      run: (context: {
        requestId: string
        mode: 'demo' | 'admin'
      }) => Promise<DiagnosticsServiceResponse>
    }
  }
  repositories: {
    connection: PowensConnectionRepository
    jobs: PowensJobQueueRepository
    syncGuard: PowensSyncGuardRepository
  }
  useCases: PowensUseCases
}
