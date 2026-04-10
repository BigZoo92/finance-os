import { apiFetch, ApiRequestError } from '@/lib/api'
import { getDemoMarketsOverview } from './demo-data'
import type { DashboardMarketsOverviewResponse, DashboardMarketsRefreshResponse } from './types'

export const fetchMarketsOverview = async () => {
  try {
    const response = await apiFetch<DashboardMarketsOverviewResponse>('/dashboard/markets/overview')

    return {
      ...response,
      watchlist: {
        ...response.watchlist,
        items:
          response.watchlist.items.length > 0 ? response.watchlist.items : response.panorama.items,
      },
      macro: {
        ...response.macro,
        items:
          response.macro.items.length > 0 ? response.macro.items : getDemoMarketsOverview().macro.items,
      },
    }
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (
        error.status === 'network_error' ||
        error.status === 401 ||
        error.status === 403 ||
        error.status === 404 ||
        error.status >= 500
      ) {
        return getDemoMarketsOverview()
      }
    }

    return getDemoMarketsOverview()
  }
}

export const postMarketsRefresh = async () => {
  return apiFetch<DashboardMarketsRefreshResponse>('/dashboard/markets/refresh', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      trigger: 'manual',
    }),
  })
}
