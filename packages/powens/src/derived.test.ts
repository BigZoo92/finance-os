import { describe, expect, it } from 'bun:test'
import { derivePowensTransactionFields, parsePowensTransactionAmount } from './derived'

describe('parsePowensTransactionAmount', () => {
  it('parses the legacy amount field', () => {
    expect(parsePowensTransactionAmount({ amount: '-12.34' })).toBe('-12.34')
  })

  it('parses the Powens value field when amount is absent', () => {
    expect(parsePowensTransactionAmount({ value: -20.5 })).toBe('-20.50')
  })

  it('keeps Powens transactions normalizable when only value is present', () => {
    expect(
      derivePowensTransactionFields({
        id: 907,
        id_account: 5,
        date: '2026-02-20',
        rdate: '2026-02-20',
        value: -20.5,
        wording: 'Openai *chatgpt Subscr',
      })
    ).toMatchObject({
      bookingDate: '2026-02-20',
      amount: '-20.50',
      label: 'Openai *chatgpt Subscr',
      category: 'Unknown',
      merchant: 'Openai *chatgpt Subscr',
    })
  })
})
