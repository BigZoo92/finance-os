import { env } from '@/env'

const FALLBACK_API_BASE_URL = 'http://127.0.0.1:3001'

export const getApiBaseUrl = () => env.VITE_API_BASE_URL ?? FALLBACK_API_BASE_URL

const toAbsolutePathPrefix = (value: string) => {
  const normalized = value.startsWith('/') ? value : `/${value}`
  return normalized.endsWith('/') && normalized.length > 1 ? normalized.slice(0, -1) : normalized
}

export const toApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const baseUrl = getApiBaseUrl()

  if (baseUrl.startsWith('/')) {
    return `${toAbsolutePathPrefix(baseUrl)}${normalizedPath}`
  }

  return new URL(normalizedPath, `${baseUrl.replace(/\/+$/, '')}/`).toString()
}

export const apiFetch = async <TResponse>(path: string, init?: RequestInit) => {
  const response = await fetch(toApiUrl(path), {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(env.VITE_PRIVATE_ACCESS_TOKEN
        ? {
            'x-finance-os-access-token': env.VITE_PRIVATE_ACCESS_TOKEN,
          }
        : {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
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
