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
