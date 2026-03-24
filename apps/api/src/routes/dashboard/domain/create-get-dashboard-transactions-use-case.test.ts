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
          category: 'Unknown',
          subcategory: null,
          incomeType: null,
          tags: [],
          powensConnectionId: 'conn-1',
          powensAccountId: 'acc-1',
          accountName: 'Compte courant',
        },
      ],
    })

    await expect(
      useCase({
        range: '30d',
        limit: 30,
        cursor: undefined,
      })
    ).resolves.toEqual({
      range: '30d',
      limit: 30,
      nextCursor: null,
      items: [
        {
          id: 7,
          bookingDate: '2026-03-20',
          amount: -45.2,
          currency: 'EUR',
          direction: 'expense',
          label: 'CARREFOUR CITY',
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
