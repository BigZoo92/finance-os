import { apiFetch } from '@/lib/api'
import type { PowensStatusResponse } from './types'

export const fetchPowensStatus = () => {
  return apiFetch<PowensStatusResponse>('/integrations/powens/status')
}

export const fetchPowensConnectUrl = () => {
  return apiFetch<{ url: string }>('/integrations/powens/connect-url')
}

export const postPowensCallback = (payload: { connectionId: string; code: string }) => {
  return apiFetch<{ ok: boolean }>('/integrations/powens/callback', {
    method: 'POST',
    body: JSON.stringify({
      connection_id: payload.connectionId,
      code: payload.code,
    }),
  })
}

export const postPowensSync = (payload?: { connectionId?: string }) => {
  const init: RequestInit = {
    method: 'POST',
  }

  if (payload?.connectionId) {
    init.body = JSON.stringify({
      connectionId: payload.connectionId,
    })
  }

  return apiFetch<{ ok: boolean }>('/integrations/powens/sync', {
    ...init,
  })
}
