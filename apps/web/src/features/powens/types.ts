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
}

export type PowensSyncRun = {
  id: string
  requestId: string | null
  connectionId: string
  startedAt: string
  endedAt: string | null
  result: 'running' | 'success' | 'error' | 'reconnect_required'
}

export type PowensSyncRunsResponse = {
  runs: PowensSyncRun[]
}
