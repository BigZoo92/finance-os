import { describe, expect, it } from 'bun:test'
import { createApiSecurityHeaders } from './http-headers'

describe('createApiSecurityHeaders', () => {
  it('sets baseline API security headers without HSTS outside production', () => {
    const headers = createApiSecurityHeaders({ nodeEnv: 'test' })

    expect(headers).toEqual(
      expect.objectContaining({
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'x-frame-options': 'DENY',
        'x-robots-tag': 'noindex, nofollow, noarchive',
        'content-security-policy': "frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      })
    )
    expect('strict-transport-security' in headers).toBe(false)
  })

  it('adds HSTS only for production', () => {
    expect(createApiSecurityHeaders({ nodeEnv: 'production' })).toEqual(
      expect.objectContaining({
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
      })
    )
  })
})
