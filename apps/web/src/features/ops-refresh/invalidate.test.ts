import type { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { dashboardQueryKeys } from '@/features/dashboard-query-options'
import { invalidateAndRefetchAfterOpsMutation } from './invalidate'
import { opsRefreshQueryKeys } from './query-options'

describe('invalidateAndRefetchAfterOpsMutation', () => {
  it('invalidates ops + dashboard and refetches status, latest operation and advisor runs', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined)
    const refetchQueries = vi.fn().mockResolvedValue(undefined)
    const queryClient = { invalidateQueries, refetchQueries } as unknown as QueryClient

    await invalidateAndRefetchAfterOpsMutation(queryClient)

    const invalidatedKeys = invalidateQueries.mock.calls.map(([arg]) => arg.queryKey)
    expect(invalidatedKeys).toContainEqual(opsRefreshQueryKeys.all)
    expect(invalidatedKeys).toContainEqual(dashboardQueryKeys.all)

    const refetchedKeys = refetchQueries.mock.calls.map(([arg]) => arg.queryKey)
    expect(refetchedKeys).toContainEqual(opsRefreshQueryKeys.status())
    expect(refetchedKeys).toContainEqual(dashboardQueryKeys.advisorManualOperationLatest())
    expect(refetchedKeys).toContainEqual(dashboardQueryKeys.advisorRuns(12))
  })
})
