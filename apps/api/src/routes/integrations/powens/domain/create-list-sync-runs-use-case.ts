import type { PowensUseCases } from '../types'

interface CreateListSyncRunsUseCaseDependencies {
  listConnectionSyncRuns: (limit?: number) => ReturnType<PowensUseCases['listSyncRuns']>
}

export const createListSyncRunsUseCase = ({
  listConnectionSyncRuns,
}: CreateListSyncRunsUseCaseDependencies): PowensUseCases['listSyncRuns'] => {
  return async limit => {
    return listConnectionSyncRuns(limit)
  }
}
