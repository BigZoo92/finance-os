import { describe, expect, it, vi } from 'vitest'
import { prefetchDashboardRouteQueries } from './index'

const createQueryClientMock = ({
  rejectEnsureKeySubstrings = [],
  rejectInfiniteKeySubstrings = [],
}: {
  rejectEnsureKeySubstrings?: string[]
  rejectInfiniteKeySubstrings?: string[]
} = {}) => {
  const ensureQueryData = vi.fn(async (options: { queryKey: readonly unknown[] }) => {
    const queryKey = options.queryKey.join(':')
    if (rejectEnsureKeySubstrings.some(substring => queryKey.includes(substring))) {
      throw new Error(`ensureQueryData failed for ${queryKey}`)
    }
    return undefined
  })

  const ensureInfiniteQueryData = vi.fn(async (options: { queryKey: readonly unknown[] }) => {
    const queryKey = options.queryKey.join(':')
    if (rejectInfiniteKeySubstrings.some(substring => queryKey.includes(substring))) {
      throw new Error(`ensureInfiniteQueryData failed for ${queryKey}`)
    }
    return undefined
  })

  return {
    ensureQueryData,
    ensureInfiniteQueryData,
  }
}

describe('prefetchDashboardRouteQueries', () => {
  it('keeps the dashboard loader alive when Powens status prefetch fails', async () => {
    const queryClient = createQueryClientMock({
      rejectEnsureKeySubstrings: ['powens:status'],
    })

    await expect(
      prefetchDashboardRouteQueries({
        queryClient: queryClient as never,
        mode: 'admin',
        range: '30d',
      })
    ).resolves.toBeUndefined()
  })

  it('keeps the dashboard loader alive when Powens sync-runs prefetch fails', async () => {
    const queryClient = createQueryClientMock({
      rejectEnsureKeySubstrings: ['powens:sync-runs'],
    })

    await expect(
      prefetchDashboardRouteQueries({
        queryClient: queryClient as never,
        mode: 'admin',
        range: '30d',
      })
    ).resolves.toBeUndefined()
  })

  it('still fails when a non-Powens prefetch fails', async () => {
    const queryClient = createQueryClientMock({
      rejectEnsureKeySubstrings: ['dashboard:summary'],
    })

    await expect(
      prefetchDashboardRouteQueries({
        queryClient: queryClient as never,
        mode: 'admin',
        range: '30d',
      })
    ).rejects.toThrow('dashboard:summary')
  })
})
