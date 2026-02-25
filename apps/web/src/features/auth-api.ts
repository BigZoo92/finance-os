import { apiFetch, ApiRequestError } from '@/lib/api'
import { AUTH_UNAVAILABLE_RESPONSE, DEMO_AUTH_RESPONSE } from './demo-data'
import type { AuthMeResponse } from './auth-types'

export const fetchAuthMe = async () => {
  try {
    return await apiFetch<AuthMeResponse>('/auth/me')
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        return DEMO_AUTH_RESPONSE
      }

      return AUTH_UNAVAILABLE_RESPONSE
    }

    return AUTH_UNAVAILABLE_RESPONSE
  }
}

export const postAuthLogin = (payload: { email: string; password: string }) => {
  return apiFetch<{ ok: boolean }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const postAuthLogout = () => {
  return apiFetch<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
  })
}
