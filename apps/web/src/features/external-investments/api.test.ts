import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiFetchMock = vi.fn()

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')

  return {
    ...actual,
    apiFetch: (...args: Parameters<typeof actual.apiFetch>) => apiFetchMock(...args),
  }
})

import { postExternalInvestmentSync } from './api'

describe('external investments API', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  it('sends an explicit manual trigger body for all-provider sync', async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      requestId: 'req-external-sync',
      enqueued: ['ibkr', 'binance'],
    })

    await postExternalInvestmentSync()

    expect(apiFetchMock).toHaveBeenCalledWith('/integrations/external-investments/sync', {
      method: 'POST',
      body: JSON.stringify({ trigger: 'manual' }),
    })
  })

  it('sends an explicit manual trigger body for provider sync', async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      requestId: 'req-external-sync',
      enqueued: ['ibkr'],
    })

    await postExternalInvestmentSync('ibkr')

    expect(apiFetchMock).toHaveBeenCalledWith('/integrations/external-investments/ibkr/sync', {
      method: 'POST',
      body: JSON.stringify({ trigger: 'manual' }),
    })
  })
})
