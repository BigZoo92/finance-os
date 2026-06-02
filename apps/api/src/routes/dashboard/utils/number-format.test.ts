import { describe, expect, it } from 'bun:test'
import {
  formatNullableNumber,
  formatNumberOrDefault,
  roundFiniteNumber,
  safeToFixed,
  toFiniteNumberOrNull,
} from './number-format'

describe('dashboard number formatting helpers', () => {
  it('formats finite numbers and numeric strings', () => {
    expect(safeToFixed(12.3456, 2)).toBe('12.35')
    expect(formatNullableNumber('7.5', 3)).toBe('7.500')
    expect(toFiniteNumberOrNull('42')).toBe(42)
  })

  it('fails soft for missing or non-finite values', () => {
    for (const value of [undefined, null, Number.NaN, Infinity, -Infinity, 'not-a-number']) {
      expect(safeToFixed(value, 2)).toBeNull()
      expect(formatNullableNumber(value, 4)).toBeNull()
    }
  })

  it('uses an explicit default for required numeric persistence fields', () => {
    expect(formatNumberOrDefault({ value: undefined, digits: 4, fallback: 0 })).toBe('0.0000')
    expect(formatNumberOrDefault({ value: Number.NaN, digits: 2, fallback: 1.25 })).toBe('1.25')
    expect(roundFiniteNumber({ value: Infinity, digits: 3, fallback: 0 })).toBe(0)
  })
})
