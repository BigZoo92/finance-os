import { apiFetch, ApiRequestError } from '@/lib/api'
import { getDemoPowensStatus } from '../demo-data'
import type { PowensStatusResponse } from './types'

export const fetchPowensStatus = async () => {
  try {
    return await apiFetch<PowensStatusResponse>('/integrations/powens/status')
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (
        error.status === 'network_error' ||
        error.status === 401 ||
        error.status === 404 ||
        error.status >= 500
      ) {
        return getDemoPowensStatus()
      }
    }

    return getDemoPowensStatus()
  }
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
