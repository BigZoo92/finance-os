import type { DashboardTransactionCursor } from '../types'

const CURSOR_PATTERN = /^(\d{4}-\d{2}-\d{2})\|(\d+)$/

export const decodeDashboardCursor = (value: string | undefined): DashboardTransactionCursor | null => {
  if (!value) {
    return null
  }

  const match = CURSOR_PATTERN.exec(value)
  if (!match) {
    return null
  }

  const [, bookingDate, rawId] = match
  if (!bookingDate || !rawId) {
    return null
  }

  const id = Number(rawId)

  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return {
    bookingDate,
    id,
  }
}

export const encodeDashboardCursor = (cursor: DashboardTransactionCursor) => {
  return `${cursor.bookingDate}|${cursor.id}`
}
