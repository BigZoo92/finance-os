import { createPowensClient } from '@finance-os/powens'
import type { ApiEnv, PowensClient } from '../types'

export const createPowensClientService = (env: ApiEnv): PowensClient => {
  return createPowensClient({
    baseUrl: env.POWENS_BASE_URL,
    clientId: env.POWENS_CLIENT_ID,
    clientSecret: env.POWENS_CLIENT_SECRET,
    userAgent: 'finance-os-api/1.0',
    timeoutMs: 12_000,
    maxRetries: 2,
  })
}
