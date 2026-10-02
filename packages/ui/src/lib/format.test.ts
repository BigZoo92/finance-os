import { describe, expect, it } from 'vitest'
import {
  assessFreshness,
  formatAge,
  formatAmount,
  formatPercent,
  UNAVAILABLE_LABEL,
} from './format'

/** Normalize locale spaces and minus signs for stable assertions. */
const norm = (value: string | null) =>
  value === null ? null : value.replace(/[\u00A0\u202F\u2009\u2007]/g, ' ').replace(/−/g, '-')

describe('formatAmount — financial honesty', () => {
  it('never converts null to zero', () => {
    expect(formatAmount(null)).toBeNull()
  })

  it('never converts undefined to zero', () => {
    expect(formatAmount(undefined)).toBeNull()
  })

  it('never converts NaN to zero', () => {
    expect(formatAmount(Number.NaN)).toBeNull()
  })

  it('keeps a real zero as a real zero', () => {
    expect(norm(formatAmount(0))).toBe('0,00 €')
  })

  it('formats positive EUR amounts in French conventions', () => {
    expect(norm(formatAmount(67070.44))).toBe('67 070,44 €')
  })

  it('formats negative amounts', () => {
    expect(norm(formatAmount(-1234.5))).toBe('-1 234,50 €')
  })

  it('supports an explicit sign for variations', () => {
    expect(norm(formatAmount(2310, { signDisplay: 'exceptZero' }))).toBe('+2 310,00 €')
    expect(norm(formatAmount(0, { signDisplay: 'exceptZero' }))).toBe('0,00 €')
  })

  it('supports non-EUR currencies', () => {
    expect(norm(formatAmount(100, { currency: 'USD' }))).toContain('$')
  })

  it('does not infer EUR when the currency is unknown', () => {
    const formatted = norm(formatAmount(1500, { currency: null }))
    expect(formatted).toBe('1 500,00')
    expect(formatted).not.toContain('€')
  })

  it('falls back to the raw code for invalid currencies instead of mislabelling as EUR', () => {
    expect(norm(formatAmount(10, { currency: 'NOPE_' }))).toBe('10,00 NOPE_')
  })

  it('supports zero-decimal product decisions', () => {
    expect(norm(formatAmount(4870.44, { decimals: 0 }))).toBe('4 870 €')
  })

  it('supports compact notation', () => {
    expect(norm(formatAmount(67070, { compact: true }))).toContain('k')
  })
})

describe('formatPercent — financial honesty', () => {
  it('never converts null to zero percent', () => {
    expect(formatPercent(null)).toBeNull()
  })

  it('never converts undefined to zero percent', () => {
    expect(formatPercent(undefined)).toBeNull()
  })

  it('never converts NaN to zero percent', () => {
    expect(formatPercent(Number.NaN)).toBeNull()
  })

  it('keeps a real zero visible without a fake sign', () => {
    expect(norm(formatPercent(0))).toBe('0,00 %')
  })

  it('signs positive variations', () => {
    expect(norm(formatPercent(8.51))).toBe('+8,51 %')
  })

  it('signs negative variations', () => {
    expect(norm(formatPercent(-3.2))).toBe('-3,20 %')
  })

  it('supports unsigned rendering', () => {
    expect(norm(formatPercent(66.3, { decimals: 1, signed: false }))).toBe('66,3 %')
  })
})

describe('assessFreshness — unknown is never fresh', () => {
  const now = new Date('2026-08-12T16:00:00Z')

  it('treats null as unknown', () => {
    expect(assessFreshness(null, { now })).toEqual({ state: 'unknown', label: UNAVAILABLE_LABEL })
  })

  it('treats invalid dates as unknown', () => {
    expect(assessFreshness('not-a-date', { now })).toEqual({
      state: 'unknown',
      label: UNAVAILABLE_LABEL,
    })
  })

  it('marks recent data as fresh', () => {
    expect(assessFreshness('2026-08-12T15:52:00Z', { now, staleAfterMinutes: 60 })).toEqual({
      state: 'fresh',
      label: 'À jour',
    })
  })

  it('marks old data as stale with its age', () => {
    const result = assessFreshness('2026-08-12T12:00:00Z', { now, staleAfterMinutes: 60 })
    expect(result.state).toBe('stale')
    expect(result.label).toBe('Ancien (4 h)')
  })
})

describe('formatAge', () => {
  it('renders minutes, hours and days', () => {
    expect(formatAge(8)).toBe('8 min')
    expect(formatAge(240)).toBe('4 h')
    expect(formatAge(3 * 24 * 60)).toBe('3 j')
  })
})
