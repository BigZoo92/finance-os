import { describe, expect, it } from 'bun:test'
import { createGetDashboardTransactionsUseCase } from './create-get-dashboard-transactions-use-case'

describe('createGetDashboardTransactionsUseCase', () => {
  it('applies automatic categorization for unknown transactions and keeps deterministic paging', async () => {
    const useCase = createGetDashboardTransactionsUseCase({
      listTransactions: async () => [
        {
          id: 7,
          bookingDate: '2026-03-20',
          amount: '-45.20',
          currency: 'EUR',
          label: 'CARREFOUR CITY',
          merchant: 'CARREFOUR CITY',
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

    await expect(
      useCase({
        range: '30d',
        limit: 30,
        cursor: undefined,
      })
    ).resolves.toEqual({
      schemaVersion: '2026-04-04',
      range: '30d',
      limit: 30,
      nextCursor: null,
      freshness: {
        strategy: 'snapshot-first',
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
        syncStatus: 'fresh',
        degradedReason: null,
        snapshotAgeSeconds: 600,
        refreshRequested: false,
      },
      items: [
        {
          id: 7,
          bookingDate: '2026-03-20',
          amount: -45.2,
          currency: 'EUR',
          direction: 'expense',
          label: 'CARREFOUR CITY',
          merchant: 'CARREFOUR CITY',
          category: 'Courses',
          subcategory: 'Supermarche',
          incomeType: null,
          tags: [],
          powensConnectionId: 'conn-1',
          powensAccountId: 'acc-1',
          accountName: 'Compte courant',
        },
      ],
    })
  })
})
