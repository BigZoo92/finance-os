import type { PowensConnectionDisconnectResult, PowensUseCases } from '../types'

interface CreateDisconnectConnectionUseCaseDependencies {
  disconnectConnection: (params: {
    connectionId: string
    now: Date
    reason: string
  }) => Promise<PowensConnectionDisconnectResult>
}

export const createDisconnectConnectionUseCase = ({
  disconnectConnection,
}: CreateDisconnectConnectionUseCaseDependencies): PowensUseCases['disconnectConnection'] => {
  return async connectionId => {
    return disconnectConnection({
      connectionId,
      now: new Date(),
      reason: 'admin_disconnect',
    })
  }
}
