import { describe, expect, it } from 'vitest'
import { getDemoDashboardTransactions } from './demo-data'

describe('getDemoDashboardTransactions', () => {
  it('uses dashboard-model cursor pagination (bookingDate|id)', () => {
    const firstPage = getDemoDashboardTransactions({
      range: '30d',
      limit: 3,
    })

    expect(firstPage.items.map(item => item.id)).toEqual([12012, 12011, 12010])
    expect(firstPage.nextCursor).toBe('2026-02-21|12010')

    const secondPage = getDemoDashboardTransactions({
      range: '30d',
      limit: 3,
      ...(firstPage.nextCursor ? { cursor: firstPage.nextCursor } : {}),
    })

    expect(secondPage.items.map(item => item.id)).toEqual([12009, 12008, 12007])
    expect(secondPage.nextCursor).toBe('2026-02-19|12007')
  })

  it('falls back to first page when cursor format is invalid', () => {
    const fromInvalidCursor = getDemoDashboardTransactions({
      range: '30d',
      limit: 2,
      cursor: 'not-a-valid-cursor',
    })

    expect(fromInvalidCursor.items.map(item => item.id)).toEqual([12012, 12011])
    expect(fromInvalidCursor.nextCursor).toBe('2026-02-22|12011')
  })
})
