import { queryOptions } from '@tanstack/react-query'
import { fetchAuthMe } from './auth-api'

export const authQueryKeys = {
  all: ['auth'] as const,
  me: () => [...authQueryKeys.all, 'me'] as const,
}

export const authMeQueryOptions = () =>
  queryOptions({
    queryKey: authQueryKeys.me(),
    queryFn: fetchAuthMe,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: typeof window === 'undefined' ? 0 : 1,
  })
