import { describe, expect, it } from 'bun:test'
import { createGetSyncBacklogCountUseCase } from './create-get-sync-backlog-count-use-case'

describe('createGetSyncBacklogCountUseCase', () => {
  it('returns backlog count from repository', async () => {
    const getSyncBacklogCount = createGetSyncBacklogCountUseCase({
      getSyncBacklogCount: async () => 7,
    })

    await expect(getSyncBacklogCount()).resolves.toBe(7)
  })

  it('normalizes negative repository values to zero', async () => {
    const getSyncBacklogCount = createGetSyncBacklogCountUseCase({
      getSyncBacklogCount: async () => -3,
    })

    await expect(getSyncBacklogCount()).resolves.toBe(0)
  })
})
