import { describe, expect, it } from 'bun:test'
import { createRefreshJobRegistry } from './refresh-registry'
import type { DashboardRouteRuntime } from '../dashboard/types'

const enabledConfig = {
  externalInvestmentsEnabled: true,
  ibkrFlexEnabled: true,
  binanceSpotEnabled: true,
  newsEnabled: true,
  marketsEnabled: true,
  advisorEnabled: true,
  socialEnabled: false,
}

const createRuntime = (
  overrides?: Partial<DashboardRouteRuntime['useCases']>
): DashboardRouteRuntime =>
  ({
    repositories: {},
    useCases: {
      requestTransactionsBackgroundRefresh: async () => true,
      runDerivedRecompute: async () => ({
        featureEnabled: true,
        state: 'completed',
        currentSnapshot: null,
        latestRun: null,
      }),
      triggerExternalInvestmentProviderSync: async () => undefined,
      generateExternalInvestmentContextBundle: async () => ({ generatedAt: '2026-05-03T00:00:00.000Z' }),
      ingestNews: async () => ({ inserted: 1, updated: 0, skipped: 0 }),
      getNewsContextBundle: async () => ({
        generatedAt: '2026-05-03T00:00:00.000Z',
        range: '7d',
        topSignals: [
          {
            title: 'Crypto volatility rises',
            summary: 'Risk signal for crypto exposure.',
            affectedEntities: ['BTC'],
            affectedSectors: ['crypto'],
            confidence: 0.7,
            score: 6,
            sources: [],
          },
        ],
        stale: false,
        degraded: false,
      }),
      refreshMarkets: async () => ({
        providerResults: [],
        quoteCount: 1,
        macroObservationCount: 1,
        signalCount: 1,
      }),
      runAdvisorDaily: async () => ({
        run: {
          id: 'advisor-run-1',
          status: 'completed',
          fallbackReason: null,
        },
      }),
      ...overrides,
    },
  }) as unknown as DashboardRouteRuntime

describe('createRefreshJobRegistry', () => {
  it('declares extensible jobs and dependency order for the daily plan', () => {
    const registry = createRefreshJobRegistry({
      runtime: createRuntime(),
      config: enabledConfig,
    })

    const jobs = registry.getJobs()
    expect(jobs.map(job => job.id)).toContain('powens')
    expect(jobs.map(job => job.id)).toContain('binance-crypto')
    expect(jobs.map(job => job.id)).toContain('news-crypto')
    expect(jobs.find(job => job.id === 'advisor-context')?.dependencies).toEqual([
      'transactions-categorization',
      'news-finance',
      'market-data',
      'external-investments',
    ])

    const plan = registry.getExecutionPlan().map(job => job.id)
    expect(plan.indexOf('powens')).toBeLessThan(plan.indexOf('transactions-categorization'))
    expect(plan.indexOf('news-finance')).toBeLessThan(plan.indexOf('news-crypto'))
    expect(plan.indexOf('external-investments')).toBeLessThan(plan.indexOf('advisor-context'))
  })

  it('continues fail-soft and redacts provider errors on individual jobs', async () => {
    const registry = createRefreshJobRegistry({
      runtime: createRuntime({
        triggerExternalInvestmentProviderSync: async () => {
          throw new Error('provider failed token=super-secret&code=powens-code')
        },
      }),
      config: enabledConfig,
    })

    const result = await registry.runJob({
      jobId: 'ibkr',
      requestId: 'req-refresh-test',
      triggerSource: 'manual-individual',
    })

    expect(result.status).toBe('partial')
    expect(result.message).toContain('token=[redacted]')
    expect(result.message).toContain('code=[redacted]')
    expect(result.message).not.toContain('super-secret')
    expect(result.message).not.toContain('powens-code')
  })

  it('reports crypto news signals in the advisor news bundle metadata', async () => {
    const registry = createRefreshJobRegistry({
      runtime: createRuntime(),
      config: enabledConfig,
    })

    const result = await registry.runJob({
      jobId: 'news-crypto',
      requestId: 'req-refresh-test',
      triggerSource: 'manual-individual',
    })

    expect(result.status).toBe('success')
    expect(result.details).toMatchObject({
      cryptoSignalCount: 1,
    })
  })

  it('does not read admin status sources in demo mode', async () => {
    let latestCalls = 0
    const registry = createRefreshJobRegistry({
      runtime: createRuntime({
        getLatestAdvisorManualOperation: async () => {
          latestCalls += 1
          return null
        },
      }),
      config: enabledConfig,
    })

    const status = await registry.getStatus({
      requestId: 'req-refresh-test',
      mode: 'demo',
    })

    expect(status.mode).toBe('demo')
    expect(status.latestRun).toBeNull()
    expect(latestCalls).toBe(0)
  })
})
