import { describe, expect, it } from 'bun:test'
import {
  dashboardAnalyticsResponseSchema,
  dashboardGoalsResponseSchema,
  dashboardMarketsOverviewResponseSchema,
  dashboardSummaryResponseSchema,
  dashboardTransactionsResponseSchema,
  valuationStatusResponseSchema,
  valuationUnresolvedResponseSchema,
} from '@finance-os/api-contract'
import { mapSummaryToAnalyticsContract } from '../routes/dashboard/domain/analytics-contract'
import { getDashboardMarketsFixture } from '../routes/dashboard/domain/market-fixture-pack'
import { getDashboardAnalyticsMockTransactions } from './dashboardAnalytics.mock'
import { getDashboardGoalsMock } from './dashboardGoals.mock'
import { getDashboardSummaryMock } from './dashboardSummary.mock'
import {
  getDashboardValuationStatusMock,
  getDashboardValuationUnresolvedMock,
} from './dashboardValuation.mock'
import { getDashboardTransactionsMock } from './transactions.mock'

describe('API demo fixtures match the shared contract', () => {
  it('dashboard summary for every range', () => {
    for (const range of ['7d', '30d', '90d'] as const) {
      const fixture = getDashboardSummaryMock(range)

      expect(dashboardSummaryResponseSchema.parse(fixture)).toEqual(fixture)
    }
  })

  it('dashboard transactions', () => {
    const fixture = getDashboardTransactionsMock({ range: '90d', limit: 100, cursor: undefined })

    expect(dashboardTransactionsResponseSchema.parse(fixture)).toEqual(fixture)
  })

  it('dashboard analytics derived from the demo summary', () => {
    const fixture = mapSummaryToAnalyticsContract({
      summary: getDashboardSummaryMock('30d'),
      source: 'demoAdapter',
      transactions: getDashboardAnalyticsMockTransactions('30d'),
    })

    expect(dashboardAnalyticsResponseSchema.parse(fixture)).toEqual(fixture)
  })

  it('goals', () => {
    const fixture = getDashboardGoalsMock()

    expect(dashboardGoalsResponseSchema.parse(fixture)).toEqual(fixture)
  })

  it('markets overview', () => {
    const fixture = getDashboardMarketsFixture('demo-request')

    expect(dashboardMarketsOverviewResponseSchema.parse(fixture)).toEqual(fixture)
  })

  it('valuation status and unresolved items', () => {
    const status = getDashboardValuationStatusMock()
    const unresolved = getDashboardValuationUnresolvedMock()

    expect(valuationStatusResponseSchema.parse(status)).toEqual(status)
    expect(valuationUnresolvedResponseSchema.parse(unresolved)).toEqual(unresolved)
  })
})
