import { describe, expect, it } from 'vitest'
import { getDemoDashboardDerivedRecomputeStatus, getDemoPowensStatus } from './demo-data'
import { getDemoExternalInvestmentStatus } from './external-investments/demo-data'
import { createHealthViewModel } from './health-view-model'
import { getDemoValuationStatus, getDemoValuationUnresolved } from './valuation/demo-data'

const getHealthyValuation = () => {
  const valuation = getDemoValuationStatus()
  const latestRun = valuation.latestRun
  const coverage = latestRun?.coverage
  if (!latestRun || !coverage) throw new Error('Demo valuation coverage is required')
  return {
    ...valuation,
    latestRun: {
      ...latestRun,
      coverage: { ...coverage, coveragePercent: 100, unknownValueCount: 0 },
    },
  }
}

const input = () => ({
  powens: { ...getDemoPowensStatus(), connections: getDemoPowensStatus().connections.slice(0, 1) },
  external: {
    ...getDemoExternalInvestmentStatus(),
    health: getDemoExternalInvestmentStatus().health.map(item => ({
      ...item,
      status: 'healthy' as const,
    })),
  },
  derived: getDemoDashboardDerivedRecomputeStatus(),
  valuation: getHealthyValuation(),
  unresolved: { totalItems: 6, items: [] },
  xHealth: {
    ok: true,
    mode: 'admin' as const,
    source: 'db' as const,
    enabled: true,
    configured: true,
    tokenPresent: true,
    lastDailyRunStartedAt: '2026-09-01T10:00:00.000Z',
    requestId: 'private',
  },
})

describe('createHealthViewModel', () => {
  it('keeps the healthy state quiet', () => {
    const model = createHealthViewModel(input())
    expect(model.state).toBe('healthy')
    expect(model.headline).toBe('Tout fonctionne')
  })

  it('surfaces a provider problem and routes it to Integrations', () => {
    const values = input()
    const connection = values.powens.connections[0]
    if (!connection) throw new Error('Demo Powens connection is required')
    values.powens.connections[0] = {
      ...connection,
      status: 'reconnect_required',
    }
    const model = createHealthViewModel(values)
    expect(model.state).toBe('degraded')
    expect(model.problems[0]).toMatchObject({ destination: '/integrations' })
  })

  it('keeps an unknown timestamp unknown', () => {
    const values = input()
    const model = createHealthViewModel({
      ...values,
      xHealth: { ...values.xHealth, lastDailyRunStartedAt: null },
    })
    expect(model.freshness.find(item => item.id === 'social')?.asOf).toBeNull()
  })

  it('exposes valuation coverage and unresolved assets without technical identifiers', () => {
    const model = createHealthViewModel({
      ...input(),
      valuation: getDemoValuationStatus(),
      unresolved: getDemoValuationUnresolved(),
    })
    expect(model.valuation.coveragePercent).toBe(83.33)
    expect(model.valuation.resolvedItems).toBe(5)
    expect(model.valuation.unresolvedItems).toBe(1)
    expect(model.problems).toContainEqual(
      expect.objectContaining({ id: 'valuation-unresolved', destination: null })
    )
  })
})
