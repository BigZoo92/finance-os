import { queryOptions } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export const systemQueryKeys = {
  all: ['system'] as const,
  apiHealth: () => [...systemQueryKeys.all, 'api-health'] as const,
}

export const apiHealthQueryOptions = () =>
  queryOptions({
    queryKey: systemQueryKeys.apiHealth(),
    queryFn: () => apiFetch<unknown>('/health'),
    staleTime: 30_000,
  })
