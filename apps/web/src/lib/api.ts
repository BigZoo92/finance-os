import { env } from '@/env'
import { logSsrApiCall } from '@/lib/ssr-logger'

type ApiUrlOptions = {
  requestOrigin?: string
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

export class ApiRequestError extends Error {
  readonly status: ApiRequestErrorStatus
  readonly url: string
  readonly path: string

  constructor({
    message,
    status,
    url,
    path,
  }: {
    message: string
    status: ApiRequestErrorStatus
    url: string
    path: string
  }) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.url = url
    this.path = path
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

const logApiCall = ({
  method,
  path,
  url,
  status,
}: {
  method: string
  path: string
  url: string
  status: ApiRequestErrorStatus
}) => {
  if (typeof window !== 'undefined') {
    return
  }

  logSsrApiCall({
    method,
    path,
    url,
    status,
  })
}

const resolveMethod = (init?: RequestInit) => {
  return (init?.method ?? 'GET').toUpperCase()
}

const createRequestHeaders = (init?: RequestInit) => {
  const headers = new Headers(init?.headers)

  headers.set('Accept', 'application/json')
  if (env.VITE_PRIVATE_ACCESS_TOKEN) {
    headers.set('x-finance-os-access-token', env.VITE_PRIVATE_ACCESS_TOKEN)
  }

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return headers
}

export const apiRequest = async <TResponse>(path: string, init?: RequestInit): Promise<ApiRequestResult<TResponse>> => {
  const url = toApiUrl(path)
  const method = resolveMethod(init)
  const headers = createRequestHeaders(init)

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
    })

    logApiCall({
      method,
      path,
      url,
      status: 'network_error',
    })

    return {
      ok: false,
      error: apiError,
      url,
    }
  }

  logApiCall({
    method,
    path,
    url,
    status: response.status,
  })

  if (!response.ok) {
    const message = await toApiErrorMessage(response)
    const apiError = new ApiRequestError({
      message,
      status: response.status,
      url,
      path,
    })

    return {
      ok: false,
      error: apiError,
      response,
      url,
    }
  }

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
