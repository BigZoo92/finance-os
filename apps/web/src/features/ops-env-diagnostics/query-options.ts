import { queryOptions } from '@tanstack/react-query'
import { fetchEnvDiagnostics } from './api'

export const opsEnvDiagnosticsQueryKeys = {
  all: ['ops', 'env-diagnostics'] as const,
}

export const opsEnvDiagnosticsQueryOptions = () =>
  queryOptions({
    queryKey: opsEnvDiagnosticsQueryKeys.all,
    queryFn: () => fetchEnvDiagnostics(),
    staleTime: 30_000,
  })
