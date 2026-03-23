import { describe, expect, it } from 'bun:test'
import { createGetDashboardSummaryUseCase } from './create-get-dashboard-summary-use-case'

describe('createGetDashboardSummaryUseCase', () => {
  it('uses normalized balance/category fields instead of provider raw payloads', async () => {
    const getSummary = createGetDashboardSummaryUseCase({
      listAccountsWithConnections: async () => [
        {
          powensAccountId: 'acc-1',
          powensConnectionId: 'conn-1',
          source: 'banking',
          provider: 'powens',
          providerConnectionId: 'conn-1',
          providerInstitutionId: 'bank-1',
          providerInstitutionName: 'Bank 1',
          accountName: 'Main account',
          accountCurrency: 'EUR',
          accountType: 'checking',
          enabled: true,
          accountBalance: '42.50',
          connectionStatus: 'connected',
          lastSyncAttemptAt: null,
          lastSyncAt: null,
          lastSuccessAt: null,
          lastFailedAt: null,
          lastError: null,
          syncMetadata: null,
        },
      ],
      getFlowTotals: async () => ({
        income: '100.00',
        expenses: '25.40',
      }),
      listTopExpenseGroups: async () => [
        {
          category: 'Unknown',
          merchant: 'Coffee Shop Downtown',
          total: '25.40',
          count: 2,
        },
      ],
    })

    await expect(getSummary('30d')).resolves.toEqual({
      range: '30d',
      totals: {
        balance: 42.5,
        incomes: 100,
        expenses: 25.4,
      },
      connections: [
        {
          powensConnectionId: 'conn-1',
          source: 'banking',
          provider: 'powens',
          providerConnectionId: 'conn-1',
          providerInstitutionId: 'bank-1',
          providerInstitutionName: 'Bank 1',
          status: 'connected',
          lastSyncAttemptAt: null,
          lastSyncAt: null,
          lastSuccessAt: null,
          lastFailedAt: null,
          lastError: null,
          syncMetadata: null,
          balance: 42.5,
          accountCount: 1,
        },
      ],
      accounts: [
        {
          powensAccountId: 'acc-1',
          powensConnectionId: 'conn-1',
          name: 'Main account',
          currency: 'EUR',
          type: 'checking',
          enabled: true,
          balance: 42.5,
        },
      ],
      topExpenseGroups: [
        {
          label: 'Unknown - Coffee Shop Downtown',
          category: 'Unknown',
          merchant: 'Coffee Shop Downtown',
          total: 25.4,
          count: 2,
        },
      ],
    })
  })
})
