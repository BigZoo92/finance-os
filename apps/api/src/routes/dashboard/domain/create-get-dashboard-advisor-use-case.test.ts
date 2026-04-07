import { afterEach, describe, expect, it } from 'bun:test'
import { createGetDashboardAdvisorUseCase } from './create-get-dashboard-advisor-use-case'
import type { DashboardSummaryResponse } from '../types'

const summaryFixture: DashboardSummaryResponse = {
  range: '30d',
  totals: { balance: 1000, incomes: 2000, expenses: 800 },
  connections: [],
  accounts: [],
  assets: [],
  positions: [],
  dailyWealthSnapshots: [],
  topExpenseGroups: [],
}

afterEach(() => {
  delete process.env.AI_ADVISOR_ENABLED
  delete process.env.AI_ADVISOR_ADMIN_ONLY
  delete process.env.AI_ADVISOR_FORCE_LOCAL_ONLY
})

describe('createGetDashboardAdvisorUseCase', () => {
  it('keeps demo mode deterministic and local', async () => {
    const useCase = createGetDashboardAdvisorUseCase({
      getSummary: async () => summaryFixture,
    })

    const result = await useCase({ mode: 'demo', range: '30d' })

    expect(result.plan.source).toBe('local')
    expect(result.plan.summarySource).toBe('mock')
    expect(result.plan.fallback).toBe(false)
  })

  it('routes admin to provider by default', async () => {
    const useCase = createGetDashboardAdvisorUseCase({
      getSummary: async () => summaryFixture,
    })

    const result = await useCase({ mode: 'admin', range: '30d' })

    expect(result.plan.source).toBe('provider')
    expect(result.plan.summarySource).toBe('provider')
    expect(result.plan.fallback).toBe(false)
  })

  it('routes admin to deterministic local path when force-local flag is enabled', async () => {
    process.env.AI_ADVISOR_FORCE_LOCAL_ONLY = '1'
    const useCase = createGetDashboardAdvisorUseCase({
      getSummary: async () => summaryFixture,
    })

    const result = await useCase({ mode: 'admin', range: '30d' })

    expect(result.plan.source).toBe('local')
    expect(result.plan.fallback).toBe(true)
    expect(result.plan.fallbackReason).toBe('force_local_only')
    expect(result.plan.summarySource).toBe('mock')
  })

  it('falls back to local path when provider summary throws', async () => {
    const useCase = createGetDashboardAdvisorUseCase({
      getSummary: async () => {
        throw new Error('provider failure')
      },
    })

    const result = await useCase({ mode: 'admin', range: '30d' })

    expect(result.plan.source).toBe('local')
    expect(result.plan.fallback).toBe(true)
    expect(result.plan.fallbackReason).toBe('provider_unavailable')
    expect(result.plan.summarySource).toBe('mock')
  })
})
