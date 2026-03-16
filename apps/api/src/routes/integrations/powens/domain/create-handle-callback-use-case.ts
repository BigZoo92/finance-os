import { encryptString } from '@finance-os/powens'
import type { PowensUseCases } from '../types'
import { decodePowensCode } from '../utils/decodePowensCode'

interface CreateHandlePowensCallbackUseCaseDependencies {
  exchangeCodeForToken: (code: string) => Promise<{ access_token: string }>
  upsertConnectedConnection: (params: {
    connectionId: string
    encryptedAccessToken: string
    now: Date
  }) => Promise<void>
  enqueueConnectionSync: (params: { connectionId: string; requestId?: string }) => Promise<void>
  encryptionKey: string
}

export const createHandlePowensCallbackUseCase = ({
  exchangeCodeForToken,
  upsertConnectedConnection,
  enqueueConnectionSync,
  encryptionKey,
}: CreateHandlePowensCallbackUseCaseDependencies): PowensUseCases['handleCallback'] => {
  return async ({ connectionId, encodedCode, requestId }) => {
    const decodedCode = decodePowensCode(encodedCode)
    const token = await exchangeCodeForToken(decodedCode)
    const encryptedToken = encryptString(token.access_token, encryptionKey)
    const now = new Date()

    await upsertConnectedConnection({
      connectionId,
      encryptedAccessToken: encryptedToken,
      now,
    })

    await enqueueConnectionSync({ connectionId, requestId })
  }
}
