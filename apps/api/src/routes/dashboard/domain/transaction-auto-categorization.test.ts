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

  // ── Expanded rule set (FR retail / utilities / transport) ──────────────
  const baseInput = {
    powensAccountId: 'acc-x',
    accountName: 'Compte courant',
    providerCategory: 'Unknown',
    customCategory: null,
    customSubcategory: null,
    category: null,
    subcategory: null,
    incomeType: null,
  } as const

  it('classifies a Lime ride as Transport / Mobilite partagee', () => {
    const result = applyTransactionAutoCategorization({
      ...baseInput,
      label: 'LIME PARIS',
      merchant: 'Lime',
      amount: -4.2,
    })
    expect(result.category).toBe('Transport')
    expect(result.subcategory).toBe('Mobilite partagee')
    expect(result.resolutionSource).toBe('merchant_rules')
  })

  it('classifies a crêperie / restaurant under Restaurant / Sorties', () => {
    const result = applyTransactionAutoCategorization({
      ...baseInput,
      label: 'CB CREPERIE DES LILAS',
      merchant: 'Creperie des Lilas',
      amount: -28.5,
    })
    expect(result.category).toBe('Restaurant')
    expect(result.subcategory).toBe('Sorties')
  })

  it('classifies a Carrefour grocery purchase under Courses / Supermarche', () => {
    const result = applyTransactionAutoCategorization({
      ...baseInput,
      label: 'CARREFOUR EXPRESS 17',
      merchant: 'Carrefour Express',
      amount: -42.13,
    })
    expect(result.category).toBe('Courses')
    expect(result.subcategory).toBe('Supermarche')
  })

  it('classifies an EDF energy bill under Logement / Energie et eau', () => {
    const result = applyTransactionAutoCategorization({
      ...baseInput,
      label: 'EDF FACTURE ELECTRICITE',
      merchant: 'EDF',
      amount: -98,
    })
    expect(result.category).toBe('Logement')
    expect(result.subcategory).toBe('Energie et eau')
  })

  it('classifies a Doctolib payment under Sante', () => {
    const result = applyTransactionAutoCategorization({
      ...baseInput,
      label: 'DOCTOLIB CONSULT',
      merchant: 'Doctolib',
      amount: -45,
    })
    expect(result.category).toBe('Sante')
  })

  it('classifies a rent transfer via Foncia under Logement / Loyer', () => {
    const result = applyTransactionAutoCategorization({
      ...baseInput,
      label: 'VIREMENT LOYER FONCIA',
      merchant: 'Foncia',
      amount: -1100,
    })
    expect(result.category).toBe('Logement')
    expect(result.subcategory).toBe('Loyer')
  })

  it('classifies a tax payment to DGFIP under Impots et taxes', () => {
    const result = applyTransactionAutoCategorization({
      ...baseInput,
      label: 'DGFIP IMPOT REVENU',
      merchant: 'DGFIP',
      amount: -350,
    })
    expect(result.category).toBe('Impots et taxes')
  })

  it('classifies a refund as income / Remboursement', () => {
    const result = applyTransactionAutoCategorization({
      ...baseInput,
      label: 'REMBOURSEMENT FRAIS',
      merchant: 'Mutuelle X',
      amount: 42,
    })
    expect(result.category).toBe('Revenus')
    expect(result.subcategory).toBe('Remboursement')
    expect(result.incomeType).toBe('exceptional')
  })

  it('keeps SumUp transactions out of "Unknown" by surfacing the grocery rule with low priority', () => {
    const result = applyTransactionAutoCategorization({
      ...baseInput,
      label: 'CB SUMUP BOULANGER',
      merchant: 'SUMUP * boulangerie',
      amount: -8.5,
    })
    // The restaurant/boulangerie rule has higher priority — it should win.
    expect(['Restaurant', 'Courses']).toContain(result.category ?? '')
    expect(result.resolutionSource).toBe('merchant_rules')
  })

  it('classifies AI / dev tool subscriptions under Abonnements / Logiciels', () => {
    const result = applyTransactionAutoCategorization({
      ...baseInput,
      label: 'OPENAI API',
      merchant: 'OpenAI',
      amount: -20,
    })
    expect(result.category).toBe('Abonnements')
    expect(result.subcategory).toBe('Logiciels')
  })
})
