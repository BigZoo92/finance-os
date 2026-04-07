import { describe, expect, it } from 'bun:test'
import type { DashboardSummaryResponse } from '../types'
import { buildAdvisorFinancialContext } from './build-advisor-financial-context'

describe('buildAdvisorFinancialContext', () => {
  it('builds a concise server context from dashboard summary', () => {
    const summary: DashboardSummaryResponse = {
      range: '30d',
      totals: { balance: 12345.678, incomes: 2500, expenses: 1800 },
      connections: [],
      accounts: [],
      assets: [
        {
          assetId: 1,
          type: 'cash',
          origin: 'provider',
          source: 'banking',
          provider: 'powens',
          providerConnectionId: 'conn_1',
          providerInstitutionName: 'Bank',
          powensConnectionId: 'powens_conn_1',
          powensAccountId: 'powens_acc_1',
          name: 'Checking',
          currency: 'EUR',
          valuation: 5100.551,
          valuationAsOf: '2026-04-07T00:00:00.000Z',
          enabled: true,
          metadata: null,
        },
        {
          assetId: 2,
          type: 'investment',
          origin: 'provider',
          source: 'banking',
          provider: 'powens',
          providerConnectionId: 'conn_1',
          providerInstitutionName: 'Bank',
          powensConnectionId: 'powens_conn_1',
          powensAccountId: 'powens_acc_2',
          name: 'ETF',
          currency: 'EUR',
          valuation: 2400.337,
          valuationAsOf: '2026-04-07T00:00:00.000Z',
          enabled: true,
          metadata: null,
        },
      ],
      positions: [],
      dailyWealthSnapshots: [],
      topExpenseGroups: [
        {
          label: 'Housing',
          category: 'Housing',
          merchant: 'Rent',
          total: 920.444,
          count: 2,
        },
      ],
    }

    expect(buildAdvisorFinancialContext(summary)).toEqual({
      range: '30d',
      totals: {
        balance: 12345.68,
        incomes: 2500,
        expenses: 1800,
        netCashflow: 700,
        spendRatio: 0.72,
      },
      patrimoine: {
        totalAssets: 7500.89,
        investmentAssets: 2400.34,
        cashAssets: 5100.55,
      },
      focus: {
        topExpenseLabel: 'Housing',
        topExpenseAmount: 920.44,
        topExpenseCount: 2,
      },
    })
  })
})
