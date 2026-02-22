import { apiFetch } from '@/lib/api'
import type {
  DashboardRange,
  DashboardSummaryResponse,
  DashboardTransactionsResponse,
} from './dashboard-types'

const toSearchParams = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue
    }

    search.set(key, String(value))
  }

  return search.toString()
}

export const fetchDashboardSummary = (range: DashboardRange) => {
  const query = toSearchParams({ range })
  return apiFetch<DashboardSummaryResponse>(`/dashboard/summary?${query}`)
}

export const fetchDashboardTransactions = (params: {
  range: DashboardRange
  limit: number
  cursor?: string
}) => {
  const query = toSearchParams({
    range: params.range,
    limit: params.limit,
    cursor: params.cursor,
  })

  return apiFetch<DashboardTransactionsResponse>(`/dashboard/transactions?${query}`)
}
