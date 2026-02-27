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
    staleTime: 60_000,
    retry: false,
  })
