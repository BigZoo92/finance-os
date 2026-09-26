import { describe, expect, it } from 'vitest'
import {
  applyWebSecurityHeaders,
  HSTS_HEADER_VALUE,
  isSecureRequest,
  WEB_SECURITY_HEADERS,
} from './security-headers'

describe('applyWebSecurityHeaders', () => {
  it('sets the baseline headers on an HTML response', () => {
    const response = applyWebSecurityHeaders(new Response('<html></html>'), {
      request: new Request('http://web.local/'),
      nodeEnv: 'production',
    })
    for (const [name, value] of Object.entries(WEB_SECURITY_HEADERS)) {
      expect(response.headers.get(name)).toBe(value)
    }
    expect(response.headers.get('content-security-policy')).toContain("form-action 'self'")
  })

  it('keeps a header the upstream API already set', () => {
    const upstream = new Response('{}', {
      headers: { 'content-security-policy': "frame-ancestors 'none'; form-action 'none'" },
    })
    const response = applyWebSecurityHeaders(upstream, {
      request: new Request('http://web.local/api/auth/me'),
      nodeEnv: 'production',
    })
    expect(response.headers.get('content-security-policy')).toBe(
      "frame-ancestors 'none'; form-action 'none'"
    )
    expect(response.headers.get('x-frame-options')).toBe('DENY')
  })

  it('adds HSTS only for HTTPS requests in production', () => {
    const insecure = applyWebSecurityHeaders(new Response(''), {
      request: new Request('http://web.local/'),
      nodeEnv: 'production',
    })
    expect(insecure.headers.get('strict-transport-security')).toBeNull()

    const forwarded = applyWebSecurityHeaders(new Response(''), {
      request: new Request('http://web.local/', { headers: { 'x-forwarded-proto': 'https' } }),
      nodeEnv: 'production',
    })
    expect(forwarded.headers.get('strict-transport-security')).toBe(HSTS_HEADER_VALUE)

    const development = applyWebSecurityHeaders(new Response(''), {
      request: new Request('https://web.local/'),
      nodeEnv: 'development',
    })
    expect(development.headers.get('strict-transport-security')).toBeNull()
  })

  it('reads the first forwarded protocol', () => {
    expect(
      isSecureRequest(new Request('http://x/', { headers: { 'x-forwarded-proto': 'https, http' } }))
    ).toBe(true)
    expect(isSecureRequest(new Request('http://x/'))).toBe(false)
  })
})
