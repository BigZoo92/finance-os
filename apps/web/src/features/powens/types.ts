export type PowensConnectionStatus = {
  id: number
  source: string
  provider: string
  powensConnectionId: string
  providerConnectionId: string
  providerInstitutionId: string | null
  providerInstitutionName: string | null
  status: 'connected' | 'syncing' | 'error' | 'reconnect_required'
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
  action: 'connect_url' | 'manual_sync' | 'callback'
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
