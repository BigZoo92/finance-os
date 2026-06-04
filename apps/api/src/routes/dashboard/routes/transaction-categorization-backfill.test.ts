import { describe, expect, it } from 'bun:test'
import type { UserCategorizationRule } from '../domain/transaction-auto-categorization'
import type { ApiDb } from '../types'
import { __testing } from './transaction-categorization-backfill'

type TxRow = {
  id: number
  powensAccountId: string
  bookingDate: string
  amount: string
  label: string
  category: string | null
  customCategory: string | null
  customSubcategory: string | null
  customIncomeType: string | null
  merchant: string | null
  customMerchant: string | null
}

const tx = (overrides: Partial<TxRow> & Pick<TxRow, 'id'>): TxRow => ({
  powensAccountId: 'acc-1',
  bookingDate: '2026-06-01',
  amount: '-12.00',
  label: 'ZZQMERCHANT ACHAT',
  category: 'Unknown',
  customCategory: null,
  customSubcategory: null,
  customIncomeType: null,
  merchant: 'zzqmerchant',
  customMerchant: null,
  ...overrides,
})

const rule = (overrides: Partial<UserCategorizationRule> & Pick<UserCategorizationRule, 'id'>): UserCategorizationRule => ({
  enabled: true,
  priority: 100,
  matcherType: 'merchant_contains',
  matcherValue: 'zzqmerchant',
  category: 'Custom Category',
  ...overrides,
})

// Fake db: dry-run backfill only reads transactions (no update path).
const createFakeDb = (rows: TxRow[]): ApiDb =>
  ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => rows.map(row => ({ ...row })),
          }),
        }),
      }),
    }),
  }) as unknown as ApiDb

describe('transaction categorization backfill (user rules)', () => {
  it('applies an enabled user rule during backfill', async () => {
    const result = await __testing.runBackfill({
      db: createFakeDb([tx({ id: 1 })]),
      body: { dryRun: true },
      userRules: [rule({ id: 'r1', category: 'Restaurants & cafés' })],
    })

    expect(result.counts.changed).toBe(1)
    expect(result.sampleChanges[0]?.to).toBe('Restaurants & cafés')
    expect(result.sampleChanges[0]?.ruleId).toBe('r1')
  })

  it('ignores a disabled user rule', async () => {
    const result = await __testing.runBackfill({
      db: createFakeDb([tx({ id: 1, category: 'Unknown' })]),
      body: { dryRun: true },
      userRules: [rule({ id: 'r1', enabled: false, priority: 999, category: 'WRONG' })],
    })

    // Disabled rule must not change the category; nothing else matches.
    expect(result.counts.changed).toBe(0)
    expect(result.sampleChanges).toHaveLength(0)
  })

  it('respects rule priority when two rules match', async () => {
    const result = await __testing.runBackfill({
      db: createFakeDb([tx({ id: 1 })]),
      body: { dryRun: true },
      userRules: [
        rule({ id: 'low', priority: 10, category: 'Low priority' }),
        rule({ id: 'high', priority: 900, category: 'High priority' }),
      ],
    })

    expect(result.sampleChanges[0]?.to).toBe('High priority')
    expect(result.sampleChanges[0]?.ruleId).toBe('high')
  })

  it('never writes in dry-run mode (default)', async () => {
    const result = await __testing.runBackfill({
      db: createFakeDb([tx({ id: 1 })]),
      body: {},
      userRules: [rule({ id: 'r1' })],
    })
    expect(result.dryRun).toBe(true)
  })
})
