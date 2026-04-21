import { describe, expect, it } from 'vitest'
import { getDemoDashboardSummary } from './demo-data'
import { adaptDailySurfaceViewModel } from './dashboard-view-model-adapter'

describe('adaptDailySurfaceViewModel', () => {
  it('returns deterministic demo output regardless of incoming summary payload', () => {
    const output = adaptDailySurfaceViewModel({
      mode: 'demo',
      range: '30d',
      summary: undefined,
    })

    const fixture = getDemoDashboardSummary('30d')

    expect(output.adapter).toBe('demoAdapter')
    expect(output.totals).toEqual(fixture.totals)
    expect(output.topExpenseGroups).toEqual(fixture.topExpenseGroups)
  })

  it('keeps admin-only summary fields from runtime payload', () => {
    const fixture = getDemoDashboardSummary('7d')
    const firstConnection = fixture.connections[0]
    if (!firstConnection) {
      throw new Error('demo fixture must include at least one connection')
    }
    const summary = {
      ...fixture,
      connections: [
        {
          ...firstConnection,
          providerInstitutionId: 'institution-admin-only',
        },
      ],
    }

    const output = adaptDailySurfaceViewModel({
      mode: 'admin',
      range: '7d',
      summary,
    })

    expect(output.adapter).toBe('adminAdapter')
    expect(output.connections[0]?.providerInstitutionId).toBe('institution-admin-only')
  })
})
