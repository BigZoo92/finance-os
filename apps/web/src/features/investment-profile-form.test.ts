import { describe, expect, it } from 'vitest'
import {
  buildInvestmentStrategyUpdateInput,
  createInvestmentProfileFormDraft,
  toHumanInvestmentProfileDescription,
  validateInvestmentProfileFormDraft,
} from './investment-profile-form'

describe('buildInvestmentStrategyUpdateInput', () => {
  it('builds the supported profile fields with numeric values', () => {
    expect(
      buildInvestmentStrategyUpdateInput({
        description: 'Construire un portefeuille diversifié.',
        horizonYears: '12',
        riskProfile: 'growth',
        monthlyContributionTarget: '750.50',
        rebalanceThresholdPct: '7.5',
      })
    ).toEqual({
      ok: true,
      input: {
        description: 'Construire un portefeuille diversifié.',
        horizonYears: 12,
        riskProfile: 'growth',
        monthlyContributionTarget: 750.5,
        rebalanceThresholdPct: 7.5,
      },
    })
  })

  it('omits absent fields and converts an empty monthly contribution to null', () => {
    expect(buildInvestmentStrategyUpdateInput({ riskProfile: 'balanced' })).toEqual({
      ok: true,
      input: { riskProfile: 'balanced' },
    })
    expect(buildInvestmentStrategyUpdateInput({ monthlyContributionTarget: '  ' })).toEqual({
      ok: true,
      input: { monthlyContributionTarget: null },
    })
  })

  it('accepts the inclusive numeric and description boundaries', () => {
    expect(
      buildInvestmentStrategyUpdateInput({
        description: 'x'.repeat(2000),
        horizonYears: '80',
        monthlyContributionTarget: '1000000',
        rebalanceThresholdPct: '50',
      }).ok
    ).toBe(true)
    expect(
      buildInvestmentStrategyUpdateInput({
        description: 'x',
        horizonYears: '1',
        monthlyContributionTarget: '0',
        rebalanceThresholdPct: '1',
      }).ok
    ).toBe(true)
  })
})

describe('validateInvestmentProfileFormDraft', () => {
  it.each([
    [{ description: '' }, 'description'],
    [{ description: 'x'.repeat(2001) }, 'description'],
    [{ horizonYears: '0' }, 'horizonYears'],
    [{ horizonYears: '81' }, 'horizonYears'],
    [{ riskProfile: 'unknown' }, 'riskProfile'],
    [{ monthlyContributionTarget: '-0.01' }, 'monthlyContributionTarget'],
    [{ monthlyContributionTarget: '1000000.01' }, 'monthlyContributionTarget'],
    [{ rebalanceThresholdPct: '0.99' }, 'rebalanceThresholdPct'],
    [{ rebalanceThresholdPct: '50.01' }, 'rebalanceThresholdPct'],
  ])('rejects an out-of-contract draft %#', (draft, field) => {
    expect(validateInvestmentProfileFormDraft(draft)).toHaveProperty(field)
  })
})

describe('investment profile presentation', () => {
  it('keeps technical strategy metadata and forbidden punctuation out of the Drawer', () => {
    expect(
      toHumanInvestmentProfileDescription(
        'Stratégie démo déterministe 60 / 30 / 10 — sans DB ni provider; interne.'
      )
    ).toBe('Profil d’investissement personnalisé.')

    expect(
      createInvestmentProfileFormDraft({
        id: 1,
        name: 'Profil principal',
        version: '1',
        status: 'active',
        description: 'Profil équilibré — priorité long terme;',
        horizonYears: 12,
        riskProfile: 'balanced',
        baseCurrency: 'EUR',
        monthlyContributionTarget: 500,
        rebalanceThresholdPct: 5,
        reviewFrequency: 'monthly',
        noAutoTrade: true,
        humanValidationRequired: true,
        createdAt: '2026-08-12T08:00:00.000Z',
        updatedAt: '2026-08-12T08:00:00.000Z',
      }).description
    ).toBe('Profil équilibré, priorité long terme')
  })

  it('omits an untouched presentation-safe description instead of rewriting server metadata', () => {
    const sourceDescription = 'Stratégie démo déterministe, sans DB ni provider.'

    expect(
      buildInvestmentStrategyUpdateInput(
        {
          description: toHumanInvestmentProfileDescription(sourceDescription),
          horizonYears: '15',
        },
        { sourceDescription }
      )
    ).toEqual({ ok: true, input: { horizonYears: 15 } })
  })
})
