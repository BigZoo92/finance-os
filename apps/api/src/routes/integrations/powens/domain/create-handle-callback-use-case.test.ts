import { describe, expect, it } from 'bun:test'
import { createHandlePowensCallbackUseCase } from './create-handle-callback-use-case'

describe('createHandlePowensCallbackUseCase', () => {
  it('is idempotent for repeated callbacks with the same provider connection id', async () => {
    const upsertedConnectionIds = new Set<string>()
    const enqueuedConnectionIds: string[] = []
    const handleCallback = createHandlePowensCallbackUseCase({
      exchangeCodeForToken: async () => ({
        access_token: 'provider-access-token',
      }),
      upsertConnectedConnection: async ({ connectionId, encryptedAccessToken }) => {
        expect(encryptedAccessToken).not.toContain('provider-access-token')
        upsertedConnectionIds.add(connectionId)
      },
      enqueueConnectionSync: async ({ connectionId }) => {
        enqueuedConnectionIds.push(connectionId)
      },
      encryptionKey: 'x'.repeat(32),
    })

    await handleCallback({
      connectionId: 'conn-1',
      encodedCode: 'callback-code',
      requestId: 'req-1',
    })
    await handleCallback({
      connectionId: 'conn-1',
      encodedCode: 'callback-code',
      requestId: 'req-2',
    })

    expect([...upsertedConnectionIds]).toEqual(['conn-1'])
    expect(enqueuedConnectionIds).toEqual(['conn-1', 'conn-1'])
  })
})
