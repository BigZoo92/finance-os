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
      categorizationMigration: {
        enabled: true,
        rolloutPercent: 100,
        alertDisagreementRate: 0.1,
        shadowLatencyBudgetMs: 500,
      },
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

  it('fails soft with safe transactions when sync metadata enrichment throws', async () => {
    const useCase = createGetDashboardTransactionsUseCase({
      listTransactions: async () => [
        {
          id: 17,
          bookingDate: '2026-03-22',
          amount: '-18.40',
          currency: 'EUR',
          label: 'BOULANGERIE',
          merchant: 'BOULANGERIE',
          providerCategory: 'Food',
          customCategory: null,
          customSubcategory: null,
          category: 'Courses',
          subcategory: null,
          incomeType: null,
          tags: [],
          powensConnectionId: 'conn-1',
          powensAccountId: 'acc-1',
          accountName: 'Compte courant',
        },
      ],
      listTransactionSyncMetadata: async () => {
        throw new Error('provider timeout')
      },
      now: () => new Date('2026-03-22T09:05:00.000Z'),
      staleAfterMinutes: 30,
      categorizationMigration: {
        enabled: true,
        rolloutPercent: 100,
        alertDisagreementRate: 0.1,
        shadowLatencyBudgetMs: 500,
      },
    })

    const result = await useCase({
      range: '30d',
      limit: 30,
      cursor: undefined,
    })

    expect(result.items).toHaveLength(1)
    expect(result.freshness.syncStatus).toBe('sync-failed-with-safe-data')
    expect(result.freshness.degradedReason).toBe('powens_refresh_failed')
  })

  it('marks freshness as degraded when sync metadata is only partially enriched', async () => {
    const useCase = createGetDashboardTransactionsUseCase({
      listTransactions: async () => [
        {
          id: 31,
          bookingDate: '2026-03-24',
          amount: '-9.90',
          currency: 'EUR',
          label: 'TRANSPORT',
          merchant: 'SNCF',
          providerCategory: 'Transport',
          customCategory: null,
          customSubcategory: null,
          category: 'Transport',
          subcategory: null,
          incomeType: null,
          tags: [],
          powensConnectionId: 'conn-1',
          powensAccountId: 'acc-1',
          accountName: 'Compte courant',
        },
        {
          id: 32,
          bookingDate: '2026-03-23',
          amount: '-35.10',
          currency: 'EUR',
          label: 'RESTAURANT',
          merchant: 'BISTROT',
          providerCategory: 'Food',
          customCategory: null,
          customSubcategory: null,
          category: 'Restaurants',
          subcategory: null,
          incomeType: null,
          tags: [],
          powensConnectionId: 'conn-2',
          powensAccountId: 'acc-2',
          accountName: 'Carte',
        },
      ],
      listTransactionSyncMetadata: async () => [
        {
          powensConnectionId: 'conn-1',
          connectionStatus: 'connected',
          lastSyncStatus: 'OK',
          lastSyncReasonCode: 'SUCCESS',
          lastSyncAt: new Date('2026-03-24T08:00:00.000Z'),
          lastSyncAttemptAt: new Date('2026-03-24T08:00:00.000Z'),
          lastFailedAt: null,
        },
      ],
      now: () => new Date('2026-03-24T08:10:00.000Z'),
      staleAfterMinutes: 30,
      categorizationMigration: {
        enabled: true,
        rolloutPercent: 100,
        alertDisagreementRate: 0.1,
        shadowLatencyBudgetMs: 500,
      },
    })

    const result = await useCase({
      range: '30d',
      limit: 30,
      cursor: undefined,
    })

    expect(result.items).toHaveLength(2)
    expect(result.freshness.syncStatus).toBe('sync-failed-with-safe-data')
    expect(result.freshness.degradedReason).toBe('powens_refresh_failed')
  })

  it('keeps legacy labeling while shadow compare is enabled but rollout is zero', async () => {
    const snapshots: Array<{ disagreements: number; rolloutPercent: number }> = []
    const useCase = createGetDashboardTransactionsUseCase({
      listTransactions: async () => [
        {
          id: 101,
          bookingDate: '2026-03-24',
          amount: '-18.40',
          currency: 'EUR',
          label: 'CARREFOUR',
          merchant: 'CARREFOUR',
          providerCategory: 'Unknown',
          customCategory: null,
          customSubcategory: null,
          category: 'Legacy',
          subcategory: null,
          incomeType: null,
          tags: [],
          powensConnectionId: 'conn-1',
          powensAccountId: 'acc-1',
          accountName: 'Compte courant',
        },
      ],
      listTransactionSyncMetadata: async () => [],
      now: () => new Date('2026-03-24T08:10:00.000Z'),
      staleAfterMinutes: 30,
      categorizationMigration: {
        enabled: true,
        rolloutPercent: 0,
        alertDisagreementRate: 0.1,
        shadowLatencyBudgetMs: 500,
      },
      onCategorizationMigrationEvaluated: snapshot => {
        snapshots.push({
          disagreements: snapshot.disagreements,
          rolloutPercent: snapshot.rolloutPercent,
        })
      },
    })

    const result = await useCase({
      range: '30d',
      limit: 10,
      cursor: undefined,
    })

    expect(result.items[0]?.category).toBe('Legacy')
    expect(result.items[0]?.resolutionSource).toBe('fallback')
    expect(snapshots[0]).toEqual({
      disagreements: 1,
      rolloutPercent: 0,
    })
  })
})
