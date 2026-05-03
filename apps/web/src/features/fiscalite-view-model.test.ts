import { describe, expect, it } from 'vitest'
import { getDemoDashboardSummary } from './demo-data'
import {
  getDemoExternalInvestmentCashFlows,
  getDemoExternalInvestmentPositions,
  getDemoExternalInvestmentSummary,
  getDemoExternalInvestmentTrades,
} from './external-investments/demo-data'
import { buildFiscalAccountsCsv, buildFiscalEventsCsv, buildFiscalSummaryViewModel } from './fiscalite-view-model'

describe('buildFiscalSummaryViewModel', () => {
  it('maps Binance to a cautious digital asset account review', () => {
    const model = buildFiscalSummaryViewModel({
      year: 2026,
      mode: 'demo',
      summary: getDemoDashboardSummary('90d'),
      externalSummary: getDemoExternalInvestmentSummary(),
      externalPositions: getDemoExternalInvestmentPositions(),
      externalTrades: getDemoExternalInvestmentTrades(),
      externalCashFlows: getDemoExternalInvestmentCashFlows(),
    })

    const binance = model.accounts.find(account => account.provider === 'Binance')

    expect(binance?.formHint).toBe('3916-3916-bis')
    expect(binance?.status).toBe('missing_data')
    expect(binance?.reason).toContain('verifier')
    expect(binance?.missingData).toContain('date d ouverture du compte')
  })

  it('maps IBKR to a cautious foreign broker review', () => {
    const model = buildFiscalSummaryViewModel({
      year: 2026,
      mode: 'demo',
      summary: getDemoDashboardSummary('90d'),
      externalSummary: getDemoExternalInvestmentSummary(),
      externalPositions: getDemoExternalInvestmentPositions(),
      externalTrades: getDemoExternalInvestmentTrades(),
      externalCashFlows: getDemoExternalInvestmentCashFlows(),
    })

    const ibkr = model.accounts.find(account => account.provider === 'IBKR')

    expect(ibkr?.formHint).toBe('3916-3916-bis')
    expect(ibkr?.accountType).toContain('courtier etranger')
    expect(ibkr?.nextAction).toContain('releve annuel IBKR')
  })

  it('keeps PEA treatment conservative and non-definitive', () => {
    const model = buildFiscalSummaryViewModel({
      year: 2026,
      mode: 'demo',
      summary: getDemoDashboardSummary('90d'),
      externalSummary: getDemoExternalInvestmentSummary(),
      externalPositions: getDemoExternalInvestmentPositions(),
      externalTrades: getDemoExternalInvestmentTrades(),
      externalCashFlows: getDemoExternalInvestmentCashFlows(),
    })

    const pea = model.accounts.find(account => account.formHint === 'pea-review')

    expect(pea?.status).toBe('to_check')
    expect(pea?.reason).toContain('verification surtout utile')
    expect(pea?.reason).not.toContain('traitement fiscal final')
  })

  it('surfaces missing data and attached household context', () => {
    const model = buildFiscalSummaryViewModel({
      year: 2026,
      mode: 'demo',
      summary: getDemoDashboardSummary('90d'),
      externalSummary: getDemoExternalInvestmentSummary(),
      externalPositions: getDemoExternalInvestmentPositions(),
      externalTrades: getDemoExternalInvestmentTrades(),
      externalCashFlows: getDemoExternalInvestmentCashFlows(),
    })

    expect(model.householdContext.status).toBe('attached_to_parent_household')
    expect(model.householdContext.description).toContain("ne calcule pas l'impot complet du foyer")
    expect(model.missingData).toContain('prix d acquisition')
    expect(model.missingData).toContain('elements a confirmer avec le foyer fiscal de rattachement')
  })

  it('labels exports as preparatory and avoids official-filing copy', () => {
    const model = buildFiscalSummaryViewModel({
      year: 2026,
      mode: 'demo',
      summary: getDemoDashboardSummary('90d'),
      externalSummary: getDemoExternalInvestmentSummary(),
      externalPositions: getDemoExternalInvestmentPositions(),
      externalTrades: getDemoExternalInvestmentTrades(),
      externalCashFlows: getDemoExternalInvestmentCashFlows(),
    })

    const text = JSON.stringify(model)
    const normalized = text.toLowerCase()
    expect(text).toContain('Document preparatoire a verifier')
    expect(normalized.includes(['declaration', 'automatique'].join(' '))).toBe(false)
    expect(normalized.includes(['montant', 'officiel'].join(' '))).toBe(false)
    expect(normalized.includes(['pret', 'a', 'envoyer', 'aux', 'impots'].join(' '))).toBe(false)
    expect(normalized.includes(['optimisation', 'fiscale'].join(' '))).toBe(false)
    expect(buildFiscalAccountsCsv(model.accounts)).toContain('Document preparatoire a verifier.')
    expect(buildFiscalEventsCsv(model.events)).toContain('Document preparatoire a verifier.')
  })

  it('does not merge deterministic demo external data into an admin dossier', () => {
    const model = buildFiscalSummaryViewModel({
      year: 2026,
      mode: 'admin',
      summary: getDemoDashboardSummary('90d'),
      externalSummary: getDemoExternalInvestmentSummary(),
      externalPositions: getDemoExternalInvestmentPositions(),
      externalTrades: getDemoExternalInvestmentTrades(),
      externalCashFlows: getDemoExternalInvestmentCashFlows(),
    })

    expect(model.accounts).toHaveLength(0)
    expect(model.events).toHaveLength(0)
    expect(model.meta.degraded).toBe(true)
    expect(model.meta.reason).toContain('fixtures demo')
  })
})
