import { queryOptions } from '@tanstack/react-query'
import { fetchMarketsOverview } from './api'

export const marketQueryKeys = {
  all: ['markets'] as const,
  overview: () => [...marketQueryKeys.all, 'overview'] as const,
}

export const marketsOverviewQueryOptions = () =>
  queryOptions({
    queryKey: marketQueryKeys.overview(),
    queryFn: () => fetchMarketsOverview(),
    staleTime: 30_000,
  })
