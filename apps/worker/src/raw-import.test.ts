import { describe, expect, it } from 'bun:test'
import {
  buildProviderRawImportRow,
  deriveAccountBalance,
  deriveTransactionCategory,
  deriveTransactionLabel,
  deriveTransactionMerchant,
  deriveTransactionProviderObjectAt,
  sanitizeProviderPayload,
} from './raw-import'

describe('raw import helpers', () => {
  it('removes sensitive provider fields recursively', () => {
    expect(
      sanitizeProviderPayload({
        access_token: 'top-secret',
        nested: {
          refresh_token: 'still-secret',
          safe: 'value',
        },
        items: [{ code: 'hidden', label: 'visible' }],
      })
    ).toEqual({
      nested: {
        safe: 'value',
      },
      items: [{ label: 'visible' }],
    })
  })

  it('builds raw import rows with sanitized payloads and fallback ids', () => {
    const importedAt = new Date('2026-03-23T00:00:00.000Z')
    const row = buildProviderRawImportRow({
      source: 'banking',
      provider: 'powens',
      providerConnectionId: 'conn-1',
      objectType: 'transaction',
      importStatus: 'failed',
      payload: {
        code: 'secret-code',
        wording: 'Coffee shop',
      },
      importedAt,
      lastSeenAt: importedAt,
    })

    expect(row.externalObjectId).toMatch(/^sha256:/)
    expect(row.payload).toEqual({ wording: 'Coffee shop' })
    expect(row.requestId).toBeUndefined()
  })

  it('derives normalized business fields without reading raw JSON later', () => {
    expect(
      deriveAccountBalance({
        current_balance: { value: '123.45' },
      })
    ).toBe('123.45')
    expect(
      deriveTransactionCategory({
        category_name: 'Food',
      })
    ).toBe('Food')
    expect(
      deriveTransactionLabel({
        label: '  Café\u00a0Central  ',
      })
    ).toBe('Café Central')
    expect(
      deriveTransactionMerchant(
        {
          original_wording: 'PAIEMENT PAR CARTE  Cafe Central  ',
        },
        'Fallback label'
      )
    ).toBe('Cafe Central')
    expect(
      deriveTransactionProviderObjectAt({
        date: '2026-03-22',
      })?.toISOString()
    ).toBe('2026-03-22T00:00:00.000Z')
  })

  it('falls back to canonical defaults when label and merchant cannot be normalized', () => {
    expect(deriveTransactionLabel({ raw: ' \n\t ' })).toBe('Transaction')
    expect(deriveTransactionMerchant({}, 'Fallback label')).toBe('Fallback label')
  })
})
