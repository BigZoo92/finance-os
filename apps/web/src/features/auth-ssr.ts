import { getGlobalStartContext } from '@tanstack/react-start'
import { env } from '@/env'
import { AUTH_UNAVAILABLE_RESPONSE, DEMO_AUTH_RESPONSE } from '@/features/demo-data'
import { toApiUrl } from '@/lib/api'
import { logSsrApiCall, logSsrError } from '@/lib/ssr-logger'
import type { AuthMeResponse } from './auth-types'

type RequestAuthContext = {
  requestOrigin?: string
  requestPath?: string
  requestCookieHeader?: string | null
}

const authMeSsrRequestCache = new WeakMap<object, Promise<AuthMeResponse>>()

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

const resolveAuthMeSsrUrl = (requestOrigin: string) => {
  return toApiUrl('/auth/me', { requestOrigin })
}

const toApiErrorMessage = async (response: Response) => {
  let message = `HTTP ${response.status}`

  try {
    const payload = (await response.json()) as { message?: string }
    if (typeof payload.message === 'string' && payload.message.length > 0) {
      message = payload.message
    }
  } catch {
    // Keep generic HTTP message when body is not JSON.
  }

  return message
}

export const fetchAuthMeFromSsr = async (): Promise<AuthMeResponse | null> => {
  const requestContext = getRequestAuthContext()
  if (!requestContext) {
    return null
  }

  const cached = authMeSsrRequestCache.get(requestContext)
  if (cached) {
    return cached
  }

  const headers = new Headers({
    Accept: 'application/json',
  })

  if (env.VITE_PRIVATE_ACCESS_TOKEN) {
    headers.set('x-finance-os-access-token', env.VITE_PRIVATE_ACCESS_TOKEN)
  }

  if (requestContext.requestCookieHeader) {
    headers.set('Cookie', requestContext.requestCookieHeader)
  }

  const authPromise = (async (): Promise<AuthMeResponse> => {
    const requestPath = requestContext.requestPath ?? '/unknown'
    const authUrl = resolveAuthMeSsrUrl(requestContext.requestOrigin)

    try {
      const response = await fetch(authUrl, {
        method: 'GET',
        credentials: 'include',
        headers,
      })

      logSsrApiCall({
        method: 'GET',
        path: '/auth/me',
        url: authUrl,
        status: response.status,
      })

      if (response.ok) {
        return (await response.json()) as AuthMeResponse
      }

      if (response.status === 401 || response.status === 404) {
        return DEMO_AUTH_RESPONSE
      }

      const message = await toApiErrorMessage(response)

      logSsrError({
        source: 'request',
        route: requestPath,
        error: new Error(`Auth SSR unavailable (${response.status}): ${message}`),
      })

      return AUTH_UNAVAILABLE_RESPONSE
    } catch (error) {
      logSsrApiCall({
        method: 'GET',
        path: '/auth/me',
        url: authUrl,
        status: 'network_error',
      })

      logSsrError({
        source: 'request',
        route: requestPath,
        error,
      })

      return AUTH_UNAVAILABLE_RESPONSE
    }
  })()

  authMeSsrRequestCache.set(requestContext, authPromise)
  return authPromise
}
