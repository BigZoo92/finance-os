import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getGlobalStartContextMock = vi.fn<() => unknown>()
const toApiUrlMock = vi.fn<(path: string, options?: { requestOrigin?: string }) => string>()
const logSsrErrorMock = vi.fn<(payload: unknown) => void>()

vi.mock('@tanstack/react-start', () => ({
  getGlobalStartContext: () => getGlobalStartContextMock(),
}))

vi.mock('@/env', () => ({
  env: {
    VITE_PRIVATE_ACCESS_TOKEN: undefined,
  },
}))

vi.mock('@/lib/api', () => ({
  toApiUrl: (path: string, options?: { requestOrigin?: string }) => toApiUrlMock(path, options),
}))

vi.mock('@/lib/ssr-logger', () => ({
  logSsrError: (payload: unknown) => logSsrErrorMock(payload),
}))

import { fetchAuthMeFromSsr } from './auth-ssr'

describe('fetchAuthMeFromSsr', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    getGlobalStartContextMock.mockReset()
    toApiUrlMock.mockReset()
    logSsrErrorMock.mockReset()
    toApiUrlMock.mockReturnValue('http://api:3001/auth/me')
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when no SSR request context is available', async () => {
    getGlobalStartContextMock.mockReturnValue(undefined)

    const result = await fetchAuthMeFromSsr()

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards request cookie and request origin to /auth/me', async () => {
    getGlobalStartContextMock.mockReturnValue({
      requestOrigin: 'http://127.0.0.1:3000',
      requestCookieHeader: 'finance_os_session=session-token',
    })

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          mode: 'admin',
          user: {
            email: 'givernaudenzo@gmail.com',
            displayName: 'BigZoo',
          },
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }
      )
    )

    const result = await fetchAuthMeFromSsr()

    expect(result).toEqual({
      mode: 'admin',
      user: {
        email: 'givernaudenzo@gmail.com',
        displayName: 'BigZoo',
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(toApiUrlMock).toHaveBeenCalledWith('/auth/me', {
      requestOrigin: 'http://127.0.0.1:3000',
    })
    expect(logSsrErrorMock).not.toHaveBeenCalled()

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://api:3001/auth/me')
    expect(init.credentials).toBe('include')

    const headers = new Headers(init.headers)
    expect(headers.get('cookie')).toBe('finance_os_session=session-token')
  })

  it('returns demo fallback when auth endpoint returns 404', async () => {
    getGlobalStartContextMock.mockReturnValue({
      requestOrigin: 'http://127.0.0.1:3000',
      requestPath: '/',
      requestCookieHeader: null,
    })

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Route GET:/auth/me not found' }), {
        status: 404,
        headers: {
          'content-type': 'application/json',
        },
      })
    )

    const result = await fetchAuthMeFromSsr()

    expect(result).toEqual({
      mode: 'demo',
      user: null,
    })
    expect(logSsrErrorMock).not.toHaveBeenCalled()
  })

  it('returns auth_unavailable fallback and logs when auth endpoint returns 5xx', async () => {
    getGlobalStartContextMock.mockReturnValue({
      requestOrigin: 'http://127.0.0.1:3000',
      requestPath: '/',
      requestCookieHeader: null,
    })

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'upstream crashed' }), {
        status: 503,
        headers: {
          'content-type': 'application/json',
        },
      })
    )

    const result = await fetchAuthMeFromSsr()

    expect(result).toEqual({
      mode: 'demo',
      user: null,
      error: 'auth_unavailable',
    })
    expect(logSsrErrorMock).toHaveBeenCalledTimes(1)
  })

  it('returns cached auth result for the same SSR request context', async () => {
    const requestContext = {
      requestOrigin: 'http://127.0.0.1:3000',
      requestPath: '/',
      requestCookieHeader: null,
    }
    getGlobalStartContextMock.mockReturnValue(requestContext)

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          mode: 'admin',
          user: {
            email: 'givernaudenzo@gmail.com',
            displayName: 'BigZoo',
          },
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }
      )
    )

    const first = await fetchAuthMeFromSsr()
    const second = await fetchAuthMeFromSsr()

    expect(first).toEqual(second)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
