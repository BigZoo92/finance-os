import type { DashboardRange } from '../types'

const RANGE_TO_DAYS: Record<DashboardRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

const toDateOnly = (value: Date) => value.toISOString().slice(0, 10)

export const getRangeStartDate = (range: DashboardRange, now = new Date()) => {
  const days = RANGE_TO_DAYS[range]
  const start = new Date(now.getTime())
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return toDateOnly(start)
}
