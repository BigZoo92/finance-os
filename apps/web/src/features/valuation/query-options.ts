import { queryOptions } from '@tanstack/react-query'
import type { AuthMode } from '@/features/auth-types'
import { fetchValuationStatus, fetchValuationUnresolved } from './api'
import { getDemoValuationStatus, getDemoValuationUnresolved } from './demo-data'

export const valuationQueryKeys = {
  all: ['valuation'] as const,
  status: (mode?: AuthMode) =>
    [...valuationQueryKeys.all, 'status', ...(mode ? [mode] : [])] as const,
  unresolved: (mode?: AuthMode) =>
    [...valuationQueryKeys.all, 'unresolved', ...(mode ? [mode] : [])] as const,
}

export const valuationStatusQueryOptionsWithMode = ({ mode }: { mode?: AuthMode | undefined }) =>
  queryOptions({
    queryKey: valuationQueryKeys.status(mode),
    queryFn: () => (mode === 'demo' ? getDemoValuationStatus() : fetchValuationStatus()),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })

export const valuationUnresolvedQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode | undefined
}) =>
  queryOptions({
    queryKey: valuationQueryKeys.unresolved(mode),
    queryFn: () => (mode === 'demo' ? getDemoValuationUnresolved() : fetchValuationUnresolved()),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 60_000,
  })
