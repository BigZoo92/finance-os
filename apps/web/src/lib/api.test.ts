import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { envMock, getGlobalStartContextMock } = vi.hoisted(() => ({
  envMock: {
    VITE_API_BASE_URL: '/api',
    VITE_APP_ORIGIN: 'https://finance-os.enzogivernaud.fr',
  },
  getGlobalStartContextMock: vi.fn<() => unknown>(),
}))

vi.mock('@/env', () => ({
  env: envMock,
}))

vi.mock('@tanstack/react-start', () => ({
  getGlobalStartContext: () => getGlobalStartContextMock(),
}))

import { apiFetch, toApiUrl } from './api'

describe('toApiUrl', () => {
  const initialApiInternalUrl = process.env.API_INTERNAL_URL
  const initialAppOrigin = process.env.VITE_APP_ORIGIN

  afterEach(() => {
    if (typeof initialApiInternalUrl === 'undefined') {
      delete process.env.API_INTERNAL_URL
    } else {
      process.env.API_INTERNAL_URL = initialApiInternalUrl
    }

    if (typeof initialAppOrigin === 'undefined') {
      delete process.env.VITE_APP_ORIGIN
    } else {
      process.env.VITE_APP_ORIGIN = initialAppOrigin
    }

    vi.unstubAllGlobals()
  })

  it('uses browser relative API base when window is available', () => {
    vi.stubGlobal('window', {} as Window & typeof globalThis)

    expect(toApiUrl('/auth/me')).toBe('/api/auth/me')
  })

  it('uses API_INTERNAL_URL in SSR when defined', () => {
    process.env.API_INTERNAL_URL = 'http://api:3001'
    delete process.env.VITE_APP_ORIGIN

    expect(toApiUrl('/auth/me')).toBe('http://api:3001/auth/me')
  })

  it('falls back to VITE_APP_ORIGIN + VITE_API_BASE_URL in SSR', () => {
    delete process.env.API_INTERNAL_URL
    process.env.VITE_APP_ORIGIN = 'https://finance-os.enzogivernaud.fr'

    expect(toApiUrl('/auth/me')).toBe('https://finance-os.enzogivernaud.fr/api/auth/me')
  })
})

describe('apiFetch', () => {
  const fetchMock = vi.fn<typeof fetch>()
  const initialApiInternalUrl = process.env.API_INTERNAL_URL
  const initialPrivateAccessToken = process.env.PRIVATE_ACCESS_TOKEN

  beforeEach(() => {
    process.env.API_INTERNAL_URL = 'http://api:3001'
    delete process.env.PRIVATE_ACCESS_TOKEN
    fetchMock.mockReset()
    getGlobalStartContextMock.mockReset()
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
  })

  afterEach(() => {
    if (typeof initialApiInternalUrl === 'undefined') {
      delete process.env.API_INTERNAL_URL
    } else {
      process.env.API_INTERNAL_URL = initialApiInternalUrl
    }

    if (typeof initialPrivateAccessToken === 'undefined') {
      delete process.env.PRIVATE_ACCESS_TOKEN
    } else {
      process.env.PRIVATE_ACCESS_TOKEN = initialPrivateAccessToken
    }

    vi.unstubAllGlobals()
  })

  it('uses resolved API URL with credentials included', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ mode: 'admin' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    )

    await apiFetch<{ mode: string }>('/auth/me')

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://api:3001/auth/me')
    expect(init.credentials).toBe('include')
  })

  it('forwards SSR cookie, request id and internal token headers on server requests', async () => {
    process.env.PRIVATE_ACCESS_TOKEN = 'test-private-access-token'
    getGlobalStartContextMock.mockReturnValue({
      requestOrigin: 'http://127.0.0.1:3000',
      requestCookieHeader: 'finance_os_session=session-token',
      requestId: 'req-test-1',
    })

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ mode: 'admin' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    )

    await apiFetch<{ mode: string }>('/auth/me')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(init.headers)
    expect(headers.get('cookie')).toBe('finance_os_session=session-token')
    expect(headers.get('x-request-id')).toBe('req-test-1')
    expect(headers.get('x-internal-token')).toBe('test-private-access-token')
  })

  it('retries with /api prefix on SSR when first call returns 404', async () => {
    getGlobalStartContextMock.mockReturnValue({
      requestOrigin: 'http://127.0.0.1:3000',
      requestCookieHeader: 'finance_os_session=session-token',
      requestId: 'req-test-404',
    })

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'ROUTE_NOT_FOUND', message: 'Route not found' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ mode: 'admin' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )

    await apiFetch<{ mode: string }>('/auth/me')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api:3001/auth/me')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://api:3001/api/auth/me')
  })
})
