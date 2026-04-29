import { describe, expect, it } from 'bun:test'
import {
  collectNormalizedIbans,
  dedupePowensAccountRows,
  normalizePowensIban,
} from './powens-account-dedupe'

describe('powens account dedupe helpers', () => {
  it('keeps the latest provider row when the same account appears twice in one sync', () => {
    const rows = dedupePowensAccountRows([
      {
        providerConnectionId: 'conn-1',
        powensAccountId: 'acc-1',
        balance: '10.00',
      },
      {
        providerConnectionId: 'conn-1',
        powensAccountId: 'acc-1',
        balance: '12.00',
      },
      {
        providerConnectionId: 'conn-1',
        powensAccountId: 'acc-2',
        balance: '1.00',
      },
    ])

    expect(rows).toEqual([
      {
        providerConnectionId: 'conn-1',
        powensAccountId: 'acc-1',
        balance: '12.00',
      },
      {
        providerConnectionId: 'conn-1',
        powensAccountId: 'acc-2',
        balance: '1.00',
      },
    ])
  })

  it('normalizes IBANs for deterministic duplicate-account matching', () => {
    expect(normalizePowensIban(' fr76 3000 6000 0112 3456 7890 189 ')).toBe(
      'FR7630006000011234567890189'
    )

    expect(
      collectNormalizedIbans([{ iban: 'FR76 3000' }, { iban: 'fr763000' }, { iban: null }])
    ).toEqual(new Set(['FR763000']))
  })
})
