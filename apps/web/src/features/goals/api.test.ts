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

import { createFinancialGoal, normalizeFinancialGoalActionError } from './api'

describe('financial goals API', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiFetchMock.mockReset()
  })

  it('propagates a generated x-request-id on create actions', async () => {
    apiRequestMock.mockResolvedValue({
      ok: true,
      data: {
        id: 91,
        name: 'Emergency runway',
        goalType: 'emergency_fund',
        currency: 'EUR',
        targetAmount: 12000,
        currentAmount: 8400,
        targetDate: '2026-09-30',
        note: null,
        progressSnapshots: [],
        archivedAt: null,
        createdAt: '2026-01-05T09:00:00.000Z',
        updatedAt: '2026-03-23T18:00:00.000Z',
      },
      response: new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: {
          'x-request-id': 'goal-create-server-id',
        },
      }),
      url: 'http://api:3001/dashboard/goals',
    })

    await createFinancialGoal({
      name: 'Emergency runway',
      goalType: 'emergency_fund',
      currency: 'EUR',
      targetAmount: 12000,
      currentAmount: 8400,
      targetDate: '2026-09-30',
      note: null,
    })

    expect(apiRequestMock).toHaveBeenCalledTimes(1)
    expect(apiRequestMock.mock.calls[0]?.[0]).toBe('/dashboard/goals')

    const init = apiRequestMock.mock.calls[0]?.[1] as RequestInit
    const headers = new Headers(init.headers)

    expect(init.method).toBe('POST')
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('x-request-id')).toMatch(/^goal-create-/)
  })

  it('normalizes network failures into a retryable safe error', () => {
    const normalized = normalizeFinancialGoalActionError(
      new ApiRequestError({
        message: 'connect ECONNREFUSED',
        status: 'network_error',
        url: 'http://api:3001/dashboard/goals',
        path: '/dashboard/goals',
        requestId: 'req-goals-err',
      })
    )

    expect(normalized).toEqual({
      message: 'connect ECONNREFUSED',
      requestId: 'req-goals-err',
      retryable: true,
      offline: true,
    })
  })
})
