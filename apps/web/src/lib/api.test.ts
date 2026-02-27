import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { envMock } = vi.hoisted(() => ({
  envMock: {
    VITE_API_BASE_URL: '/api',
    VITE_APP_ORIGIN: 'https://finance-os.enzogivernaud.fr',
    VITE_PRIVATE_ACCESS_TOKEN: undefined as string | undefined,
  },
}))

vi.mock('@/env', () => ({
  env: envMock,
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

  beforeEach(() => {
    process.env.API_INTERNAL_URL = 'http://api:3001'
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
  })

  afterEach(() => {
    if (typeof initialApiInternalUrl === 'undefined') {
      delete process.env.API_INTERNAL_URL
    } else {
      process.env.API_INTERNAL_URL = initialApiInternalUrl
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
})
