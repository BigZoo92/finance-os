export type PowensPersistedSyncStatus = 'OK' | 'KO'

export type PowensPersistedSyncReasonCode =
  | 'SUCCESS'
  | 'PARTIAL_IMPORT'
  | 'SYNC_FAILED'
  | 'RECONNECT_REQUIRED'

export type PowensConnectionStatus = {
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
  lastSyncAttemptAt: string | null
  lastSyncAt: string | null
  lastSuccessAt: string | null
  lastFailedAt: string | null
  lastError: string | null
  syncMetadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export type PowensLatestCallback = {
  receivedAt: string
  status: 'allowed' | 'blocked' | 'failed'
  actorMode: 'admin' | 'state'
  requestId: string
  connectionId?: string
  details?: string
}

export type PowensStatusResponse = {
  connections: PowensConnectionStatus[]
  safeModeActive: boolean
  syncStatusPersistenceEnabled: boolean
  fallback?: 'safe_mode'
  lastCallback: PowensLatestCallback | null
}

export type PowensSyncRun = {
  id: string
  requestId: string | null
  connectionId: string
  startedAt: string
  endedAt: string | null
  result: 'running' | 'success' | 'error' | 'reconnect_required'
  errorMessage?: string
  errorFingerprint?: string
}

export type PowensSyncRunsResponse = {
  runs: PowensSyncRun[]
}

export type PowensSyncBacklogResponse = {
  syncBacklogCount: number
}

export type PowensAdminAuditEvent = {
  id: string
  action: 'connect_url' | 'manual_sync' | 'callback' | 'disconnect_connection'
  result: 'allowed' | 'blocked' | 'failed'
  actorMode: 'admin' | 'state'
  at: string
  requestId: string
  details?: string
  connectionId?: string
}

export type PowensAuditTrailResponse = {
  events: PowensAdminAuditEvent[]
  requestId: string
}

export type PowensDiagnosticsResponse = {
  enabled: boolean
  mode: 'demo' | 'admin'
  provider: 'mock' | 'powens'
  outcome: 'ok' | 'degraded' | 'timeout' | 'auth_error' | 'provider_error'
  guidance: string
  issueType?: 'timeout' | 'auth' | 'provider'
  retryable: boolean
  lastCheckedAt: string
}

export type PowensDisconnectResponse = {
  ok: true
  requestId: string
  connectionId: string
  disconnected: boolean
}
