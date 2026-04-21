import { describe, expect, it, vi } from 'vitest'

const { envMock } = vi.hoisted(() => ({
  envMock: {
    VITE_SOCIAL_BENCHMARK_EXPLAINABILITY_ENABLED: 'true',
  },
}))

vi.mock('@/env', () => ({ env: envMock }))

import { buildSocialBenchmarkExplainability } from './social-benchmark-explainability'

const basePosition = {
  positionId: 1,
  positionKey: 'ABC',
  assetId: 1,
  powensAccountId: 'acc_1',
  powensConnectionId: 'conn_1',
  source: 'provider',
  provider: 'powens',
  providerConnectionId: 'pconn_1',
  providerPositionId: 'ppos_1',
  assetName: 'ETF Monde',
  accountName: 'PEA',
  name: 'ETF Monde',
  currency: 'EUR',
  quantity: 10,
  costBasis: 1000,
  costBasisSource: 'provider' as const,
  currentValue: 1300,
  lastKnownValue: 1300,
  openedAt: null,
  closedAt: null,
  valuedAt: '2026-04-21T10:00:00.000Z',
  lastSyncedAt: null,
  enabled: true,
  metadata: null,
}

const baseAsset = {
  assetId: 10,
  type: 'cash' as const,
  origin: 'provider' as const,
  source: 'powens',
  provider: 'powens',
  providerConnectionId: 'pconn_1',
  providerInstitutionName: 'Demo Bank',
  powensConnectionId: 'conn_1',
  powensAccountId: 'acc_cash',
  name: 'Compte courant',
  currency: 'EUR',
  valuation: 900,
  valuationAsOf: '2026-04-21',
  enabled: true,
  metadata: null,
}

describe('social benchmark explainability', () => {
  it('builds deterministic insights in demo mode', () => {
    const model = buildSocialBenchmarkExplainability({
      mode: 'demo',
      positions: [basePosition],
      assets: [baseAsset],
    })

    expect(model.enabled).toBe(true)
    expect(model.insights.length).toBeGreaterThan(0)
    expect(model.traceId.startsWith('bench-exp-')).toBe(true)
    expect(model.generationFailed).toBe(false)
  })

  it('returns fallback insight when positions are unavailable', () => {
    const model = buildSocialBenchmarkExplainability({
      mode: 'admin',
      positions: [],
      assets: [baseAsset],
    })

    expect(model.insights[0]?.fallbackReason).toBe('insufficient_positions')
    expect(model.insights[0]?.confidence).toBe('low')
  })
})
