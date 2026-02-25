import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/env', () => ({
  env: {
    VITE_API_BASE_URL: '/api',
    VITE_APP_ORIGIN: 'http://localhost:3000',
    VITE_PRIVATE_ACCESS_TOKEN: undefined,
  },
}))

import { apiFetch, toApiUrl } from './api'

describe('toApiUrl', () => {
  it('uses VITE_APP_ORIGIN for SSR absolute API URL resolution', () => {
    expect(toApiUrl('/auth/me')).toBe('http://localhost:3000/api/auth/me')
  })
})

describe('apiFetch', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
  })

  afterEach(() => {
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
    expect(url).toBe('http://localhost:3000/api/auth/me')
    expect(init.credentials).toBe('include')
  })
})
