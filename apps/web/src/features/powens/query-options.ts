import { queryOptions } from '@tanstack/react-query'
import type { AuthMode } from '../auth-types'
import { getDemoPowensStatus } from '../demo-data'
import { fetchPowensStatus } from './api'

export const powensQueryKeys = {
  all: ['powens'] as const,
  status: () => [...powensQueryKeys.all, 'status'] as const,
}

export const powensStatusQueryOptions = () =>
  powensStatusQueryOptionsWithMode({
    mode: 'admin',
  })

export const powensStatusQueryOptionsWithMode = ({ mode }: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: powensQueryKeys.status(),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoPowensStatus()
      }

      return fetchPowensStatus()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 10_000,
  })
