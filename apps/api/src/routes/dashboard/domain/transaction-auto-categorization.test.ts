import { describe, expect, it } from 'bun:test'
import { applyTransactionAutoCategorization } from './transaction-auto-categorization'

describe('applyTransactionAutoCategorization', () => {
  it('applies a deterministic label+amount rule when category is unknown', () => {
    const result = applyTransactionAutoCategorization({
      label: 'NETFLIX.COM 03/2026',
      amount: -15.99,
      powensAccountId: 'acc-1',
      accountName: 'Compte courant',
      category: 'Unknown',
      subcategory: null,
      incomeType: null,
    })

    expect(result).toEqual({
      category: 'Abonnements',
      subcategory: 'Streaming',
      incomeType: null,
      autoCategorizationRuleId: 'subscriptions-streaming',
    })
  })

  it('uses account+amount constraints and wins on priority when multiple rules match', () => {
    const result = applyTransactionAutoCategorization({
      label: 'Cotisation frais mensuels',
      amount: -12.5,
      powensAccountId: 'acc-2',
      accountName: 'Compte checking principal',
      category: null,
      subcategory: null,
      incomeType: null,
    })

    expect(result).toEqual({
      category: 'Frais bancaires',
      subcategory: null,
      incomeType: null,
      autoCategorizationRuleId: 'bank-fees-checking-account',
    })
  })

  it('keeps explicit manual/provider category untouched', () => {
    const result = applyTransactionAutoCategorization({
      label: 'UBER TRIP',
      amount: -20,
      powensAccountId: 'acc-3',
      accountName: 'Compte courant',
      category: 'Restaurants',
      subcategory: 'Delivery',
      incomeType: null,
    })

    expect(result).toEqual({
      category: 'Restaurants',
      subcategory: 'Delivery',
      incomeType: null,
      autoCategorizationRuleId: null,
    })
  })
})
