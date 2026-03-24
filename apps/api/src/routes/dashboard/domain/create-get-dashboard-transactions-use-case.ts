import type { DashboardUseCases } from '../types'
import { decodeDashboardCursor, encodeDashboardCursor } from '../utils/cursor'
import { getRangeStartDate } from '../utils/range'

interface CreateGetDashboardTransactionsUseCaseDependencies {
  listTransactions: (params: {
    fromDate: string
    limit: number
    cursor: { bookingDate: string; id: number } | null
  }) => Promise<
    Array<{
      id: number
      bookingDate: string
      amount: string
      currency: string
      label: string
      category: string | null
      subcategory: string | null
      incomeType: 'salary' | 'recurring' | 'exceptional' | null
      tags: string[]
      powensConnectionId: string
      powensAccountId: string
      accountName: string | null
    }>
  >
}

const toMoney = (value: string) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.round(parsed * 100) / 100
}

export const createGetDashboardTransactionsUseCase = ({
  listTransactions,
}: CreateGetDashboardTransactionsUseCaseDependencies): DashboardUseCases['getTransactions'] => {
  return async input => {
    const fromDate = getRangeStartDate(input.range)
    const decodedCursor = decodeDashboardCursor(input.cursor)
    const queryLimit = input.limit + 1

    const rows = await listTransactions({
      fromDate,
      limit: queryLimit,
      cursor: decodedCursor,
    })

    const hasNextPage = rows.length > input.limit
    const visibleRows = hasNextPage ? rows.slice(0, input.limit) : rows
    const tail = visibleRows[visibleRows.length - 1]

    return {
      range: input.range,
      limit: input.limit,
      nextCursor:
        hasNextPage && tail
          ? encodeDashboardCursor({
              bookingDate: tail.bookingDate,
              id: tail.id,
            })
          : null,
      items: visibleRows.map(row => {
        const amount = toMoney(row.amount)

        return {
          id: row.id,
          bookingDate: row.bookingDate,
          amount,
          currency: row.currency,
          direction: amount >= 0 ? 'income' : 'expense',
          label: row.label,
          category: row.category,
          subcategory: row.subcategory,
          incomeType: row.incomeType,
          tags: row.tags,
          powensConnectionId: row.powensConnectionId,
          powensAccountId: row.powensAccountId,
          accountName: row.accountName,
        }
      }),
    }
  }
}
