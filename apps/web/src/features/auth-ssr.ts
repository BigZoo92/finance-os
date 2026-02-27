import { getGlobalStartContext } from '@tanstack/react-start'
import { env } from '@/env'
import { toApiUrl } from '@/lib/api'
import type { AuthMeResponse } from './auth-types'

type RequestAuthContext = {
  requestOrigin?: string
  requestCookieHeader?: string | null
}

const getRequestAuthContext = () => {
  const requestContext = getGlobalStartContext() as RequestAuthContext | undefined

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

  const headers = new Headers({
    Accept: 'application/json',
  })

  if (env.VITE_PRIVATE_ACCESS_TOKEN) {
    headers.set('x-finance-os-access-token', env.VITE_PRIVATE_ACCESS_TOKEN)
  }

  if (requestContext.requestCookieHeader) {
    headers.set('Cookie', requestContext.requestCookieHeader)
  }

  const response = await fetch(resolveAuthMeSsrUrl(requestContext.requestOrigin), {
    method: 'GET',
    credentials: 'include',
    headers,
  })

  if (!response.ok) {
    throw new Error(await toApiErrorMessage(response))
  }

  return (await response.json()) as AuthMeResponse
}
