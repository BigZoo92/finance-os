import { queryOptions } from '@tanstack/react-query'
import { fetchPowensStatus } from './api'

export const powensQueryKeys = {
  all: ['powens'] as const,
  status: () => [...powensQueryKeys.all, 'status'] as const,
}

export const powensStatusQueryOptions = () =>
  queryOptions({
    queryKey: powensQueryKeys.status(),
    queryFn: fetchPowensStatus,
    staleTime: 10_000,
  })
