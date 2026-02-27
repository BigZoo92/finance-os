import { getGlobalStartContext } from '@tanstack/react-start'
import { env } from '@/env'
import { logSsrApiCall } from '@/lib/ssr-logger'

type ApiUrlOptions = {
  requestOrigin?: string
}

type SsrRequestContext = {
  requestOrigin?: string
  requestCookieHeader?: string | null
  requestId?: string
}

type ApiRequestErrorStatus = number | 'network_error'

type ApiRequestResult<TResponse> =
  | {
      ok: true
      data: TResponse
      response: Response
      url: string
    }
  | {
      ok: false
      error: ApiRequestError
      response?: Response
      url: string
    }

type ApiErrorPayload = {
  message?: string
  code?: string
  requestId?: string
  details?: unknown
}

export class ApiRequestError extends Error {
  readonly status: ApiRequestErrorStatus
  readonly url: string
  readonly path: string
  readonly code?: string
  readonly requestId?: string
  readonly details?: unknown

  constructor({
    message,
    status,
    url,
    path,
    code,
    requestId,
    details,
  }: {
    message: string
    status: ApiRequestErrorStatus
    url: string
    path: string
    code?: string
    requestId?: string
    details?: unknown
  }) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.url = url
    this.path = path
    this.code = code
    this.requestId = requestId
    this.details = details
  }
}

const toOptionalEnv = (value: string | undefined) => {
  if (!value) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const readServerRuntimeEnv = (key: string) => {
  if (typeof process === 'undefined') {
    return undefined
  }

  return toOptionalEnv(process.env?.[key])
}

const getSsrRequestContext = (): SsrRequestContext | null => {
  if (typeof window !== 'undefined') {
    return null
  }

  try {
    return (getGlobalStartContext() as SsrRequestContext | undefined) ?? null
  } catch {
    return null
  }
}

const getClientApiBaseUrl = () => env.VITE_API_BASE_URL ?? '/api'

export const getApiBaseUrl = (options?: ApiUrlOptions) => {
  const clientBaseUrl = getClientApiBaseUrl()
  if (typeof window !== 'undefined') {
    return clientBaseUrl
  }

  const internalApiUrl = readServerRuntimeEnv('API_INTERNAL_URL')
  if (internalApiUrl) {
    return internalApiUrl
  }

  if (!clientBaseUrl.startsWith('/')) {
    return clientBaseUrl
  }

  const appOrigin =
    readServerRuntimeEnv('VITE_APP_ORIGIN') ??
    toOptionalEnv(env.VITE_APP_ORIGIN) ??
    toOptionalEnv(options?.requestOrigin)

  if (!appOrigin) {
    throw new Error(
      'Unable to resolve server API URL: set API_INTERNAL_URL or VITE_APP_ORIGIN for SSR runtime.'
    )
  }

  return new URL(toAbsolutePathPrefix(clientBaseUrl), `${appOrigin.replace(/\/+$/, '')}/`).toString()
}

const toAbsolutePathPrefix = (value: string) => {
  const normalized = value.startsWith('/') ? value : `/${value}`
  return normalized.endsWith('/') && normalized.length > 1 ? normalized.slice(0, -1) : normalized
}

//CODEX DON'T TOUCH THIS FUNCTION
export const toApiUrl = (path: string, options?: ApiUrlOptions) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const baseUrl = getApiBaseUrl(options)

  if (baseUrl.startsWith('/')) {
    return `${toAbsolutePathPrefix(baseUrl)}${normalizedPath}`
  }

  const normalizedRelativePath = normalizedPath.replace(/^\/+/, '')
  return new URL(normalizedRelativePath, `${baseUrl.replace(/\/+$/, '')}/`).toString()
}

const toApiErrorPayload = async (response: Response): Promise<ApiErrorPayload> => {
  try {
    const payload = (await response.json()) as ApiErrorPayload
    return payload
  } catch {
    return {}
  }
}

const resolveMethod = (init?: RequestInit) => {
  return (init?.method ?? 'GET').toUpperCase()
}

const resolveServerInternalToken = () => {
  return readServerRuntimeEnv('PRIVATE_ACCESS_TOKEN') ?? readServerRuntimeEnv('API_INTERNAL_TOKEN')
}

const createRequestHeaders = ({
  init,
  requestContext,
}: {
  init?: RequestInit
  requestContext: SsrRequestContext | null
}) => {
  const headers = new Headers(init?.headers)

  headers.set('Accept', 'application/json')

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (!requestContext) {
    return headers
  }

  if (requestContext.requestCookieHeader && !headers.has('Cookie')) {
    headers.set('Cookie', requestContext.requestCookieHeader)
  }

  if (requestContext.requestId && !headers.has('x-request-id')) {
    headers.set('x-request-id', requestContext.requestId)
  }

  const internalToken = resolveServerInternalToken()
  if (internalToken) {
    headers.set('x-internal-token', internalToken)
  }

  return headers
}

export const apiRequest = async <TResponse>(
  path: string,
  init?: RequestInit
): Promise<ApiRequestResult<TResponse>> => {
  const requestContext = getSsrRequestContext()
  const url = toApiUrl(path, { requestOrigin: requestContext?.requestOrigin })
  const method = resolveMethod(init)
  const headers = createRequestHeaders({
    init,
    requestContext,
  })

  let response: Response
  try {
    response = await fetch(url, {
      credentials: 'include',
      ...init,
      headers,
    })
  } catch (error) {
    const apiError = new ApiRequestError({
      message: error instanceof Error ? error.message : 'Network request failed',
      status: 'network_error',
      url,
      path,
      requestId: requestContext?.requestId,
    })

    logSsrApiCall({
      method,
      path,
      url,
      status: 'network_error',
      requestId: requestContext?.requestId,
      code: apiError.code,
    })

    return {
      ok: false,
      error: apiError,
      url,
    }
  }

  if (!response.ok) {
    const payload = await toApiErrorPayload(response)
    const message =
      typeof payload.message === 'string' && payload.message.length > 0
        ? payload.message
        : `HTTP ${response.status}`
    const apiError = new ApiRequestError({
      message,
      status: response.status,
      url,
      path,
      code: payload.code,
      requestId: payload.requestId ?? requestContext?.requestId,
      details: payload.details,
    })

    logSsrApiCall({
      method,
      path,
      url,
      status: response.status,
      requestId: apiError.requestId,
      code: apiError.code,
    })

    return {
      ok: false,
      error: apiError,
      response,
      url,
    }
  }

  logSsrApiCall({
    method,
    path,
    url,
    status: response.status,
    requestId: response.headers.get('x-request-id') ?? requestContext?.requestId,
  })

  try {
    return {
      ok: true,
      data: (await response.json()) as TResponse,
      response,
      url,
    }
  } catch {
    const apiError = new ApiRequestError({
      message: `Invalid JSON response from ${url}`,
      status: response.status,
      url,
      path,
      requestId: response.headers.get('x-request-id') ?? requestContext?.requestId,
    })

    return {
      ok: false,
      error: apiError,
      response,
      url,
    }
  }
}

export const apiFetch = async <TResponse>(path: string, init?: RequestInit) => {
  const result = await apiRequest<TResponse>(path, init)
  if (!result.ok) {
    throw result.error
  }

  return result.data
}
