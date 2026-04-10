import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock, getDemoMarketsOverviewMock, MockApiRequestError } = vi.hoisted(() => {
  class HoistedApiRequestError extends Error {
    status: number | 'network_error'

    constructor({
      message,
      status,
    }: {
      message: string
      status: number | 'network_error'
    }) {
      super(message)
      this.name = 'ApiRequestError'
      this.status = status
    }
  }

  return {
    apiFetchMock: vi.fn(),
    getDemoMarketsOverviewMock: vi.fn(),
    MockApiRequestError: HoistedApiRequestError,
  }
})

vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiRequestError: MockApiRequestError,
}))

vi.mock('./demo-data', () => ({
  getDemoMarketsOverview: () => getDemoMarketsOverviewMock(),
}))

import { fetchMarketsOverview, postMarketsRefresh } from './api'

describe('markets api', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    getDemoMarketsOverviewMock.mockReset()
  })

  it('falls back to deterministic demo data on API failure', async () => {
    const demoPayload = {
      source: 'demo_fixture',
      watchlist: { items: [{ instrumentId: 'spy-us' }], groups: [] },
      panorama: { items: [{ instrumentId: 'spy-us' }] },
      macro: { items: [{ seriesId: 'FEDFUNDS' }] },
    }

    getDemoMarketsOverviewMock.mockReturnValue(demoPayload)
    apiFetchMock.mockRejectedValue(
      new MockApiRequestError({
        message: 'provider unavailable',
        status: 503,
      })
    )

    const result = await fetchMarketsOverview()

    expect(result).toBe(demoPayload)
    expect(getDemoMarketsOverviewMock).toHaveBeenCalledTimes(1)
  })

  it('posts the manual refresh trigger to the refresh endpoint', async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      requestId: 'req-markets-refresh',
    })

    await postMarketsRefresh()

    expect(apiFetchMock).toHaveBeenCalledWith('/dashboard/markets/refresh', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        trigger: 'manual',
      }),
    })
  })
})
