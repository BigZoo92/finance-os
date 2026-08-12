import { describe, expect, it } from 'vitest'
import { getDemoDashboardSummary } from '../demo-data'
import {
  getDemoExternalInvestmentBundle,
  getDemoExternalInvestmentPositions,
} from '../external-investments/demo-data'
import { buildInvestmentsViewModel } from './view-model'

describe('investments view model', () => {
  it('does not fabricate P&L when the current value is unavailable', () => {
    const summary = getDemoDashboardSummary('30d')
    const position = summary.positions[0]
    if (!position) throw new Error('Demo position is required')
    summary.positions[0] = {
      ...position,
      currentValue: null,
      lastKnownValue: null,
      costBasis: 1_000,
    }
    const model = buildInvestmentsViewModel({
      summary,
      externalPositions: [],
      externalBundle: null,
    })
    expect(model.positions.find(row => row.id === 'internal-1')?.pnlAmount).toBeNull()
  })

  it('keeps P&L unavailable when cost basis is missing', () => {
    const positions = getDemoExternalInvestmentPositions().items
    const position = positions[0]
    if (!position) throw new Error('Demo position is required')
    positions[0] = { ...position, costBasis: null }
    const model = buildInvestmentsViewModel({
      summary: undefined,
      externalPositions: positions,
      externalBundle: getDemoExternalInvestmentBundle(),
    })
    expect(model.positions[0]?.pnlAmount).toBeNull()
  })

  it('does not compare a cost basis in another currency', () => {
    const positions = getDemoExternalInvestmentPositions().items
    const position = positions[0]
    if (!position) throw new Error('Demo position is required')
    positions[0] = { ...position, costBasisCurrency: 'USD' }
    const model = buildInvestmentsViewModel({
      summary: undefined,
      externalPositions: positions,
      externalBundle: getDemoExternalInvestmentBundle(),
    })
    expect(model.positions[0]?.pnlAmount).toBeNull()
  })

  it('preserves a genuine zero value and zero P&L', () => {
    const summary = getDemoDashboardSummary('30d')
    const position = summary.positions[0]
    if (!position) throw new Error('Demo position is required')
    summary.positions = [
      { ...position, currentValue: 0, lastKnownValue: null, valueBase: 0, costBasis: 0 },
    ]
    const model = buildInvestmentsViewModel({
      summary,
      externalPositions: [],
      externalBundle: null,
    })
    expect(model.positions[0]?.value).toBe(0)
    expect(model.positions[0]?.pnlAmount).toBe(0)
  })
})
