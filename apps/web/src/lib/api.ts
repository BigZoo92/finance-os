import { env } from '@/env'

type ApiUrlOptions = {
  requestOrigin?: string
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

export const apiFetch = async <TResponse>(path: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers)

  headers.set('Accept', 'application/json')
  if (env.VITE_PRIVATE_ACCESS_TOKEN) {
    headers.set('x-finance-os-access-token', env.VITE_PRIVATE_ACCESS_TOKEN)
  }

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(toApiUrl(path), {
    credentials: 'include',
    ...init,
    headers,
  })

  if (!response.ok) {
    let message = `HTTP ${response.status}`

    try {
      const payload = (await response.json()) as { message?: string }
      if (typeof payload.message === 'string' && payload.message.length > 0) {
        message = payload.message
      }
    } catch {
      // Keep generic HTTP message when body is not JSON.
    }

    throw new Error(message)
  }

  return (await response.json()) as TResponse
}
