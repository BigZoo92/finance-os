import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock, getDemoDashboardNewsMock, MockApiRequestError } = vi.hoisted(() => {
  class HoistedApiRequestError extends Error {
    status: number | 'network_error'
    code?: string
    requestId?: string

    constructor({
      message,
      status,
      code,
      requestId,
    }: {
      message: string
      status: number | 'network_error'
      code?: string
      requestId?: string
    }) {
      super(message)
      this.name = 'ApiRequestError'
      this.status = status
      if (code !== undefined) {
        this.code = code
      }
      if (requestId !== undefined) {
        this.requestId = requestId
      }
    }
  }

  return {
    apiFetchMock: vi.fn(),
    getDemoDashboardNewsMock: vi.fn(),
    MockApiRequestError: HoistedApiRequestError,
  }
})

vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  apiRequest: vi.fn(),
  ApiRequestError: MockApiRequestError,
}))

vi.mock('./demo-data', () => ({
  getDemoDashboardNews: () => getDemoDashboardNewsMock(),
  getDemoDashboardSummary: vi.fn(),
  getDemoDashboardTransactions: vi.fn(),
}))

import {
  fetchDashboardAdvisorKnowledgeAnswer,
  fetchDashboardNews,
  putDashboardInvestmentStrategy,
} from './dashboard-api'
import type { DashboardInvestmentStrategyUpdateInput } from './dashboard-types'

describe('fetchDashboardNews', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    getDemoDashboardNewsMock.mockReset()
  })

  it('forwards rich filter params to the cache-only news endpoint', async () => {
    apiFetchMock.mockResolvedValue({ source: 'cache', items: [] })

    await fetchDashboardNews({
      topic: 'macro',
      source: 'ECB',
      sourceType: 'central_bank',
      domain: 'macroeconomy',
      eventType: 'policy_decision',
      minSeverity: 60,
      region: 'europe',
      ticker: 'MSFT',
      sector: 'Cloud software',
      direction: 'risk',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-09T00:00:00.000Z',
      limit: 24,
    })

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/dashboard/news?topic=macro&source=ECB&sourceType=central_bank&domain=macroeconomy&eventType=policy_decision&minSeverity=60&region=europe&ticker=MSFT&sector=Cloud+software&direction=risk&from=2026-04-01T00%3A00%3A00.000Z&to=2026-04-09T00%3A00%3A00.000Z&limit=24'
    )
  })

  it('falls back to deterministic demo data on API failure', async () => {
    const demoPayload = { source: 'demo_fixture', items: [{ id: 'demo-news' }] }
    getDemoDashboardNewsMock.mockReturnValue(demoPayload)
    apiFetchMock.mockRejectedValue(
      new MockApiRequestError({
        message: 'provider unavailable',
        status: 503,
      })
    )

    const result = await fetchDashboardNews({
      topic: 'macro',
    })

    expect(result).toBe(demoPayload)
    expect(getDemoDashboardNewsMock).toHaveBeenCalledTimes(1)
  })
})

describe('fetchDashboardAdvisorKnowledgeAnswer', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  it('encodes the question on the knowledge answer endpoint', async () => {
    apiFetchMock.mockResolvedValue({ status: 'answered' })

    await fetchDashboardAdvisorKnowledgeAnswer(
      'Pourquoi diversifier un portefeuille actions ?'
    )

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/dashboard/advisor/knowledge-answer?question=Pourquoi+diversifier+un+portefeuille+actions+%3F'
    )
  })
})

describe('putDashboardInvestmentStrategy', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  it('sends the supported profile fields as JSON to the strategy endpoint', async () => {
    const response = { requestId: 'request-1' }
    const input: DashboardInvestmentStrategyUpdateInput = {
      description: 'Construire un portefeuille diversifié.',
      horizonYears: 12,
      riskProfile: 'balanced',
      monthlyContributionTarget: 750,
      rebalanceThresholdPct: 8,
    }
    apiFetchMock.mockResolvedValue(response)

    const result = await putDashboardInvestmentStrategy(input)

    expect(result).toBe(response)
    expect(apiFetchMock).toHaveBeenCalledWith('/dashboard/advisor/investment-strategy', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  })

  it('preserves an explicit null and omits absent optional fields', async () => {
    const input: DashboardInvestmentStrategyUpdateInput = {
      monthlyContributionTarget: null,
    }
    apiFetchMock.mockResolvedValue({ requestId: 'request-2' })

    await putDashboardInvestmentStrategy(input)

    const request = apiFetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toEqual({ monthlyContributionTarget: null })
    expect(JSON.parse(String(request.body))).not.toHaveProperty('description')
  })
})
