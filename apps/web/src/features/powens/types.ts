export type PowensConnectionStatus = {
  id: number
  powensConnectionId: string
  status: 'connected' | 'syncing' | 'error' | 'reconnect_required'
  lastSyncAt: string | null
  lastSuccessAt: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export type PowensStatusResponse = {
  connections: PowensConnectionStatus[]
  fallback?: 'safe_mode'
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
