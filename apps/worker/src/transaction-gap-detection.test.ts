import { describe, expect, it } from 'bun:test'
import { detectTransactionGaps } from './transaction-gap-detection'

describe('detectTransactionGaps', () => {
  it('returns empty when there are fewer than two valid dates', () => {
    expect(
      detectTransactionGaps({
        accountId: 'acc_1',
        bookingDates: ['invalid-date'],
        thresholdDays: 30,
      })
    ).toEqual([])
  })

  it('returns gaps larger than the configured threshold', () => {
    expect(
      detectTransactionGaps({
        accountId: 'acc_1',
        bookingDates: ['2026-01-01', '2026-01-03', '2026-03-10', '2026-03-11'],
        thresholdDays: 30,
      })
    ).toEqual([
      {
        accountId: 'acc_1',
        startDate: '2026-01-03',
        endDate: '2026-03-10',
        gapDays: 66,
      },
    ])
  })

  it('deduplicates equal dates before evaluating day gaps', () => {
    expect(
      detectTransactionGaps({
        accountId: 'acc_1',
        bookingDates: ['2026-01-01', '2026-01-01', '2026-02-15'],
        thresholdDays: 30,
      })
    ).toEqual([
      {
        accountId: 'acc_1',
        startDate: '2026-01-01',
        endDate: '2026-02-15',
        gapDays: 45,
      },
    ])
  })
})
