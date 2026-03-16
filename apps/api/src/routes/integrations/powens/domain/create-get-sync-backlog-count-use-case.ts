import type { PowensUseCases } from '../types'

interface CreateGetSyncBacklogCountUseCaseDependencies {
  getSyncBacklogCount: () => Promise<number>
}

export const createGetSyncBacklogCountUseCase = ({
  getSyncBacklogCount,
}: CreateGetSyncBacklogCountUseCaseDependencies): PowensUseCases['getSyncBacklogCount'] => {
  return async () => {
    const count = await getSyncBacklogCount()
    return count >= 0 ? count : 0
  }
}
