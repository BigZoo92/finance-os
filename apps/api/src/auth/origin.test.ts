import { describe, expect, it } from 'bun:test'
import { createAllowedBrowserOrigins, isSameOriginMutationRequest } from './origin'

describe('origin guard', () => {
  const allowedOrigins = createAllowedBrowserOrigins({
    requestUrl: 'https://finance.example/api/dashboard/manual-assets',
    webOrigin: 'https://finance.example',
    nodeEnv: 'production',
  })

  it('accepts unsafe mutations from the configured web origin', () => {
    expect(
      isSameOriginMutationRequest({
        request: new Request('https://finance.example/api/dashboard/manual-assets', {
          method: 'POST',
          headers: {
            origin: 'https://finance.example',
          },
        }),
        allowedOrigins,
      })
    ).toBe(true)
  })

  it('accepts unsafe mutations with same-origin referer when Origin is absent', () => {
    expect(
      isSameOriginMutationRequest({
        request: new Request('https://finance.example/api/dashboard/manual-assets', {
          method: 'DELETE',
          headers: {
            referer: 'https://finance.example/integrations',
          },
        }),
        allowedOrigins,
      })
    ).toBe(true)
  })

  it('rejects unsafe browser mutations without an allowed origin or referer', () => {
    expect(
      isSameOriginMutationRequest({
        request: new Request('https://finance.example/api/dashboard/manual-assets', {
          method: 'POST',
        }),
        allowedOrigins,
      })
    ).toBe(false)

    expect(
      isSameOriginMutationRequest({
        request: new Request('https://finance.example/api/dashboard/manual-assets', {
          method: 'PATCH',
          headers: {
            origin: 'https://evil.example',
          },
        }),
        allowedOrigins,
      })
    ).toBe(false)
  })

  it('does not require origin evidence for safe methods', () => {
    expect(
      isSameOriginMutationRequest({
        request: new Request('https://finance.example/api/auth/me'),
        allowedOrigins,
      })
    ).toBe(true)
  })
})
