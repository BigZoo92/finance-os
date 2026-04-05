import { describe, expect, it } from 'bun:test'
import { applyTransactionAutoCategorization } from './transaction-auto-categorization'

describe('applyTransactionAutoCategorization', () => {
  it('uses manual override as first precedence', () => {
    const result = applyTransactionAutoCategorization({
      label: 'NETFLIX.COM 03/2026',
      merchant: 'Netflix',
      amount: -15.99,
      powensAccountId: 'acc-1',
      accountName: 'Compte courant',
      providerCategory: 'Unknown',
      customCategory: 'Manuel',
      customSubcategory: 'Perso',
      category: 'Manuel',
      subcategory: 'Perso',
      incomeType: null,
    })

    expect(result.resolutionSource).toBe('manual_override')
    expect(result.category).toBe('Manuel')
  })

  it('uses merchant rules before mcc and counterparty', () => {
    const result = applyTransactionAutoCategorization({
      label: 'SPOTIFY ABONNEMENT',
      merchant: 'Spotify',
      amount: -12.5,
      powensAccountId: 'acc-2',
      accountName: 'Compte checking principal',
      providerCategory: 'Unknown',
      customCategory: null,
      customSubcategory: null,
      category: null,
      subcategory: null,
      incomeType: null,
    })

    expect(result).toMatchObject({
      category: 'Abonnements',
      subcategory: 'Streaming',
      resolutionSource: 'merchant_rules',
      resolutionRuleId: 'merchant-streaming',
    })
  })

  it('uses provider category in mcc precedence when no rule matches', () => {
    const result = applyTransactionAutoCategorization({
      label: 'Paiement CB',
      merchant: 'Commercant local',
      amount: -20,
      powensAccountId: 'acc-3',
      accountName: 'Compte courant',
      providerCategory: 'Restaurants',
      customCategory: null,
      customSubcategory: null,
      category: 'Restaurants',
      subcategory: null,
      incomeType: null,
    })

    expect(result.resolutionSource).toBe('mcc')
    expect(result.category).toBe('Restaurants')
  })

  it('falls back deterministically when nothing else matches', () => {
    const result = applyTransactionAutoCategorization({
      label: 'Paiement carte artisan local',
      merchant: 'Artisan',
      amount: -18.45,
      powensAccountId: 'acc-4',
      accountName: 'Compte courant',
      providerCategory: 'Unknown',
      customCategory: null,
      customSubcategory: null,
      category: 'Unknown',
      subcategory: null,
      incomeType: null,
    })

    expect(result.resolutionSource).toBe('fallback')
    expect(result.resolutionTrace.at(-1)?.source).toBe('fallback')
  })
})
