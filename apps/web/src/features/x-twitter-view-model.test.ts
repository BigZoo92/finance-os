import { describe, expect, it } from 'vitest'
import {
  capReasonLabel,
  formatCount,
  formatUsd,
  resolveBudgetTone,
  verificationStatusLabel,
} from './x-twitter-view-model'
import type { XHealthResponse } from './x-twitter-api'

const baseHealth: XHealthResponse = {
  ok: true,
  mode: 'admin',
  source: 'db',
  enabled: true,
  configured: true,
  tokenPresent: true,
  budgetStatus: 'healthy',
  requestId: 'req-1',
}

describe('resolveBudgetTone', () => {
  it('returns ok for healthy', () => {
    expect(resolveBudgetTone(baseHealth)).toBe('ok')
  })
  it('returns warn for monthly_low', () => {
    expect(resolveBudgetTone({ ...baseHealth, budgetStatus: 'monthly_low' })).toBe('warn')
  })
  it('returns danger for exhausted', () => {
    expect(resolveBudgetTone({ ...baseHealth, budgetStatus: 'daily_exhausted' })).toBe('danger')
    expect(resolveBudgetTone({ ...baseHealth, budgetStatus: 'monthly_exhausted' })).toBe('danger')
  })
  it('returns unknown when health is missing or ok=false', () => {
    expect(resolveBudgetTone(undefined)).toBe('unknown')
    expect(resolveBudgetTone({ ...baseHealth, ok: false })).toBe('unknown')
  })
})

describe('formatters', () => {
  it('formats USD with $ prefix and 2 decimals', () => {
    expect(formatUsd(0.5)).toBe('$0.50')
    expect(formatUsd(undefined)).toBe('—')
    expect(formatUsd(null)).toBe('—')
  })
  it('formats counts with locale separators', () => {
    const value = formatCount(1500000)
    expect(value.length).toBeGreaterThan(0)
    expect(formatCount(null)).toBe('—')
  })
})

describe('label helpers', () => {
  it('produces user-friendly verification status labels', () => {
    expect(verificationStatusLabel('verified')).toBe('Vérifié')
    expect(verificationStatusLabel('unverified_payment_required')).toContain('402')
    expect(verificationStatusLabel('unverified_rate_limited')).toContain('429')
  })
  it('maps cap reasons to French labels', () => {
    expect(capReasonLabel('complete')).toBe('Complet')
    expect(capReasonLabel('capped_by_budget')).toBe('Budget atteint')
    expect(capReasonLabel('capped_by_author_limit')).toContain('auteur')
  })
})
