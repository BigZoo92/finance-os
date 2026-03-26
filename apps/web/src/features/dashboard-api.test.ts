import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError } from '@/lib/api'

const apiRequestMock = vi.fn()
const apiFetchMock = vi.fn()

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')

  return {
    ...actual,
    apiRequest: (...args: Parameters<typeof actual.apiRequest>) => apiRequestMock(...args),
    apiFetch: (...args: Parameters<typeof actual.apiFetch>) => apiFetchMock(...args),
  }
})

import {
  normalizeDashboardDerivedRecomputeActionError,
  postDashboardDerivedRecompute,
} from './dashboard-api'
import { getDemoDashboardDerivedRecomputeStatus } from './demo-data'
import { dashboardDerivedRecomputeStatusQueryOptionsWithMode } from './dashboard-query-options'

describe('dashboard derived recompute API', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiFetchMock.mockReset()
  })

  it('propagates a generated x-request-id on recompute actions', async () => {
    apiRequestMock.mockResolvedValue({
      ok: true,
      data: getDemoDashboardDerivedRecomputeStatus(),
      response: new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'x-request-id': 'derived-recompute-server-id',
        },
      }),
      url: 'http://api:3001/dashboard/derived-recompute',
    })

    await postDashboardDerivedRecompute()

    expect(apiRequestMock).toHaveBeenCalledTimes(1)
    expect(apiRequestMock.mock.calls[0]?.[0]).toBe('/dashboard/derived-recompute')

    const init = apiRequestMock.mock.calls[0]?.[1] as RequestInit
    const headers = new Headers(init.headers)

    expect(init.method).toBe('POST')
    expect(headers.get('x-request-id')).toMatch(/^derived-recompute-/)
  })

  it('normalizes retryable safe errors for recompute failures', () => {
    const normalized = normalizeDashboardDerivedRecomputeActionError(
      new ApiRequestError({
        message: 'Derived recompute failed. Snapshot remains unchanged.',
        status: 500,
        code: 'DERIVED_RECOMPUTE_FAILED',
        url: 'http://api:3001/dashboard/derived-recompute',
        path: '/dashboard/derived-recompute',
        requestId: 'req-derived-web-err',
      })
    )

    expect(normalized).toEqual({
      message: 'Derived recompute failed. Snapshot remains unchanged.',
      code: 'DERIVED_RECOMPUTE_FAILED',
      requestId: 'req-derived-web-err',
      retryable: true,
      offline: false,
    })
  })

  it('skips the recompute status API call entirely in demo mode', () => {
    const queryOptions = dashboardDerivedRecomputeStatusQueryOptionsWithMode({
      mode: 'demo',
    })
    const queryFn = queryOptions.queryFn as () => ReturnType<
      typeof getDemoDashboardDerivedRecomputeStatus
    >

    expect(queryFn()).toEqual(getDemoDashboardDerivedRecomputeStatus())
    expect(apiFetchMock).not.toHaveBeenCalled()
  })
})
