import { getGlobalStartContext } from '@tanstack/react-start'
import { AUTH_UNAVAILABLE_RESPONSE, DEMO_AUTH_RESPONSE } from '@/features/demo-data'
import { apiRequest } from '@/lib/api'
import { logSsrError } from '@/lib/ssr-logger'
import type { AuthMeResponse } from './auth-types'

type RequestAuthContext = {
  requestOrigin?: string
  requestPath?: string
}

const getRequestAuthContext = () => {
  if (typeof window !== 'undefined') {
    return null
  }

  let requestContext: RequestAuthContext | undefined
  try {
    requestContext = getGlobalStartContext() as RequestAuthContext | undefined
  } catch {
    return null
  }

  if (!requestContext?.requestOrigin) {
    return null
  }

  return requestContext
}

export const fetchAuthMeFromSsr = async (): Promise<AuthMeResponse | null> => {
  const requestContext = getRequestAuthContext()
  if (!requestContext) {
    return null
  }

  const requestPath = requestContext.requestPath ?? '/unknown'
  const result = await apiRequest<AuthMeResponse>('/auth/me')

  if (result.ok) {
    return result.data
  }

  if (result.error.status === 401 || result.error.status === 403 || result.error.status === 404) {
    return DEMO_AUTH_RESPONSE
  }

  logSsrError({
    source: 'request',
    route: requestPath,
    error: new Error(
      `Auth SSR unavailable (${String(result.error.status)}): ${result.error.message} [requestId=${result.error.requestId ?? 'n/a'}]`
    ),
  })

  return AUTH_UNAVAILABLE_RESPONSE
}
