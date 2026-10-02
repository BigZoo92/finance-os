import {
  dashboardSummaryResponseSchema,
  dashboardTransactionsResponseSchema,
} from '@finance-os/api-contract/dashboard'
import { dashboardGoalsResponseSchema } from '@finance-os/api-contract/goals'
import { dashboardMarketsOverviewResponseSchema } from '@finance-os/api-contract/markets'
import {
  valuationStatusResponseSchema,
  valuationUnresolvedResponseSchema,
} from '@finance-os/api-contract/valuation'
import { describe, expect, it } from 'vitest'
import { getDemoDashboardSummary, getDemoDashboardTransactions } from './demo-data'
import { getDemoFinancialGoals } from './goals/demo-data'
import { getDemoMarketsOverview } from './markets/demo-data'
import { getDemoValuationStatus, getDemoValuationUnresolved } from './valuation/demo-data'

describe('web demo fixtures match the shared contract', () => {
  it('dashboard summary for every range', () => {
    for (const range of ['7d', '30d', '90d'] as const) {
      const fixture = getDemoDashboardSummary(range)

      expect(dashboardSummaryResponseSchema.parse(fixture)).toEqual(fixture)
    }
  })

  it('keeps an unvalued demo position unknown instead of 0', () => {
    const fixture = getDemoDashboardSummary('30d')
    const unvalued = fixture.positions.find(position => position.currentValue === null)
    const parsed = dashboardSummaryResponseSchema.parse(fixture)
    const parsedPosition = parsed.positions.find(
      position => position.positionId === unvalued?.positionId
    )

    expect(unvalued).toBeDefined()
    expect(parsedPosition?.currentValue).toBeNull()
    expect(parsedPosition?.valueBase).toBeNull()
    expect(parsedPosition?.valuationStatus).toBe('unresolved')
  })

  it('dashboard transactions', () => {
    const fixture = getDemoDashboardTransactions({ range: '90d', limit: 100 })

    expect(dashboardTransactionsResponseSchema.parse(fixture)).toEqual(fixture)
  })

  it('goals', () => {
    const fixture = getDemoFinancialGoals()

    expect(dashboardGoalsResponseSchema.parse(fixture)).toEqual(fixture)
  })

  it('markets overview', () => {
    const fixture = getDemoMarketsOverview()

    expect(dashboardMarketsOverviewResponseSchema.parse(fixture)).toEqual(fixture)
  })

  it('valuation status and unresolved items', () => {
    const status = getDemoValuationStatus()
    const unresolved = getDemoValuationUnresolved()

    expect(valuationStatusResponseSchema.parse(status)).toEqual(status)
    expect(valuationUnresolvedResponseSchema.parse(unresolved)).toEqual(unresolved)
  })
})
