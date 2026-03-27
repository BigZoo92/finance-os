import { describe, expect, it } from 'bun:test'
import { resolveAssetTypeFromPowensAccountType } from './powens-account-type'

describe('resolveAssetTypeFromPowensAccountType', () => {
  it('returns investment for investment-like string account types', () => {
    expect(resolveAssetTypeFromPowensAccountType('PEA Titres')).toBe('investment')
    expect(resolveAssetTypeFromPowensAccountType('assurance vie')).toBe('investment')
  })

  it('returns investment for structured account types with id/name hints', () => {
    expect(resolveAssetTypeFromPowensAccountType({ id: 'market', name: 'Brokerage account' })).toBe(
      'investment'
    )
  })

  it('defaults to cash for non-investment or unknown types', () => {
    expect(resolveAssetTypeFromPowensAccountType('checking')).toBe('cash')
    expect(resolveAssetTypeFromPowensAccountType({ id: 'checking', name: 'Compte courant' })).toBe(
      'cash'
    )
    expect(resolveAssetTypeFromPowensAccountType(null)).toBe('cash')
  })
})
