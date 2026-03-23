import { afterEach, describe, expect, it } from 'bun:test'
import { createPowensClient } from './client'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('createPowensClient', () => {
  it('turns request aborts into explicit Powens timeout errors', async () => {
    globalThis.fetch = ((_: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => {
            const error = new Error('This operation was aborted')
            error.name = 'AbortError'
            reject(error)
          },
          { once: true }
        )
      })
    }) as typeof fetch

    const client = createPowensClient({
      baseUrl: 'https://tenant.biapi.pro',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      userAgent: 'finance-os-test/1.0',
      timeoutMs: 10,
      maxRetries: 0,
    })

    await expect(client.listConnectionAccounts('conn-1', 'token-1')).rejects.toMatchObject({
      name: 'PowensApiError',
      statusCode: null,
      message: 'Powens request timed out after 10ms',
    })
  })
})
