import type { PowensUseCases } from '../types'

interface CreateListStatusesUseCaseDependencies {
  listConnectionStatuses: () => ReturnType<PowensUseCases['listStatuses']>
}

export const createListStatusesUseCase = ({
  listConnectionStatuses,
}: CreateListStatusesUseCaseDependencies): PowensUseCases['listStatuses'] => {
  return async () => {
    return listConnectionStatuses()
  }
}
