import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getGlobalStartContextMock = vi.fn<() => unknown>()
const apiRequestMock = vi.fn()
const logSsrErrorMock = vi.fn<(payload: unknown) => void>()

vi.mock('@tanstack/react-start', () => ({
  getGlobalStartContext: () => getGlobalStartContextMock(),
}))

vi.mock('@/lib/api', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}))

vi.mock('@/lib/ssr-logger', () => ({
  logSsrError: (payload: unknown) => logSsrErrorMock(payload),
}))

import { fetchAuthMeFromSsr } from './auth-ssr'

describe('fetchAuthMeFromSsr', () => {
  beforeEach(() => {
    getGlobalStartContextMock.mockReset()
    apiRequestMock.mockReset()
    logSsrErrorMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no SSR request context is available', async () => {
    getGlobalStartContextMock.mockReturnValue(undefined)

    const result = await fetchAuthMeFromSsr()

    expect(result).toBeNull()
    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('returns auth payload when /auth/me succeeds', async () => {
    getGlobalStartContextMock.mockReturnValue({
      requestOrigin: 'http://127.0.0.1:3000',
      requestPath: '/',
    })

    apiRequestMock.mockResolvedValue({
      ok: true,
      data: {
        mode: 'admin',
        user: {
          email: 'givernaudenzo@gmail.com',
          displayName: 'BigZoo',
        },
      },
    })

    const result = await fetchAuthMeFromSsr()

    expect(result).toEqual({
      mode: 'admin',
      user: {
        email: 'givernaudenzo@gmail.com',
        displayName: 'BigZoo',
      },
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/auth/me')
  })

  it('returns demo fallback when /auth/me returns 404', async () => {
    getGlobalStartContextMock.mockReturnValue({
      requestOrigin: 'http://127.0.0.1:3000',
      requestPath: '/',
    })

    apiRequestMock.mockResolvedValue({
      ok: false,
      error: {
        status: 404,
        message: 'Route not found',
      },
    })

    const result = await fetchAuthMeFromSsr()

    expect(result).toEqual({
      mode: 'demo',
      user: null,
    })
    expect(logSsrErrorMock).not.toHaveBeenCalled()
  })

  it('returns auth_unavailable fallback and logs for server errors', async () => {
    getGlobalStartContextMock.mockReturnValue({
      requestOrigin: 'http://127.0.0.1:3000',
      requestPath: '/',
    })

    apiRequestMock.mockResolvedValue({
      ok: false,
      error: {
        status: 503,
        message: 'upstream crashed',
        requestId: 'req-503',
      },
    })

    const result = await fetchAuthMeFromSsr()

    expect(result).toEqual({
      mode: 'demo',
      user: null,
      error: 'auth_unavailable',
    })
    expect(logSsrErrorMock).toHaveBeenCalledTimes(1)
  })

  it('does not cache auth result across calls in SSR request context', async () => {
    const requestContext = {
      requestOrigin: 'http://127.0.0.1:3000',
      requestPath: '/',
    }
    getGlobalStartContextMock.mockReturnValue(requestContext)

    apiRequestMock.mockResolvedValue({
      ok: true,
      data: {
        mode: 'admin',
        user: {
          email: 'givernaudenzo@gmail.com',
          displayName: 'BigZoo',
        },
      },
    })

    const first = await fetchAuthMeFromSsr()
    const second = await fetchAuthMeFromSsr()

    expect(first).toEqual(second)
    expect(apiRequestMock).toHaveBeenCalledTimes(2)
  })
})
