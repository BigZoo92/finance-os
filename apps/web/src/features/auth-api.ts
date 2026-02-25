import { apiFetch } from '@/lib/api'
import type { AuthMeResponse } from './auth-types'

export const fetchAuthMe = () => {
  return apiFetch<AuthMeResponse>('/auth/me')
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
