import type { QueryClient } from '@tanstack/react-query'
import { dashboardQueryKeys } from '@/features/dashboard-query-options'
import { opsRefreshQueryKeys } from './query-options'

/**
 * Invalidate + refetch every query that an ops mutation (full refresh, single
 * job, stale recovery, cancel) can change: the refresh status (which carries
 * the latest manual operation + history), the latest manual operation, and the
 * advisor runs feed, plus a broad invalidation of the ops dashboard.
 *
 * Centralised so a recovered/auto-closed step can never linger as "en cours" in
 * any surface after a mutation, and so the behaviour is unit-testable.
 */
export const invalidateAndRefetchAfterOpsMutation = async (
  queryClient: QueryClient
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: opsRefreshQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
  ])
  await Promise.all([
    queryClient.refetchQueries({ queryKey: opsRefreshQueryKeys.status() }),
    queryClient.refetchQueries({ queryKey: dashboardQueryKeys.advisorManualOperationLatest() }),
    queryClient.refetchQueries({ queryKey: dashboardQueryKeys.advisorRuns(12) }),
  ])
}
