import { queryOptions } from '@tanstack/react-query'
import type { AuthMode } from '@/features/auth-types'
import { fetchFinancialGoals } from './api'
import { getDemoFinancialGoals } from './demo-data'

export const financialGoalsQueryKeys = {
  all: ['financial-goals'] as const,
  list: () => [...financialGoalsQueryKeys.all, 'list'] as const,
}

export const financialGoalsQueryOptionsWithMode = ({
  mode,
}: {
  mode: AuthMode | undefined
}) =>
  queryOptions({
    queryKey: financialGoalsQueryKeys.list(),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoFinancialGoals()
      }

      return fetchFinancialGoals()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })
