import { describe, expect, it } from 'bun:test'
import { createGetDashboardTransactionsUseCase } from './create-get-dashboard-transactions-use-case'

describe('createGetDashboardTransactionsUseCase', () => {
  it('applies explicit precedence categorization and keeps deterministic paging', async () => {
    const useCase = createGetDashboardTransactionsUseCase({
      listTransactions: async () => [
        {
          id: 7,
          bookingDate: '2026-03-20',
          amount: '-45.20',
          currency: 'EUR',
          label: 'CARREFOUR CITY',
          merchant: 'CARREFOUR CITY',
          providerCategory: 'Unknown',
          customCategory: null,
          customSubcategory: null,
          category: 'Unknown',
          subcategory: null,
          incomeType: null,
          tags: [],
          powensConnectionId: 'conn-1',
          powensAccountId: 'acc-1',
          accountName: 'Compte courant',
        },
      ],
      listTransactionSyncMetadata: async () => [
        {
          powensConnectionId: 'conn-1',
          connectionStatus: 'connected',
          lastSyncStatus: 'OK',
          lastSyncReasonCode: 'SUCCESS',
          lastSyncAt: new Date('2026-03-20T10:00:00.000Z'),
          lastSyncAttemptAt: new Date('2026-03-20T10:00:00.000Z'),
          lastFailedAt: null,
        },
      ],
      now: () => new Date('2026-03-20T10:10:00.000Z'),
      staleAfterMinutes: 30,
    })

    const result = await useCase({
      range: '30d',
      limit: 30,
      cursor: undefined,
    })

    expect(result.items[0]?.category).toBe('Courses')
    expect(result.items[0]?.resolutionSource).toBe('merchant_rules')
    expect(result.items[0]?.resolutionRuleId).toBe('merchant-groceries')
    expect(result.items[0]?.resolutionTrace).toEqual([
      {
        source: 'manual_override',
        rank: 1,
        matched: false,
        reason: 'no_manual_override',
        category: null,
        subcategory: null,
        ruleId: null,
      },
      {
        source: 'merchant_rules',
        rank: 2,
        matched: true,
        reason: 'matched_merchant_rule',
        category: 'Courses',
        subcategory: 'Supermarche',
        ruleId: 'merchant-groceries',
      },
    ])
    expect(result.freshness.syncStatus).toBe('fresh')
  })
})
