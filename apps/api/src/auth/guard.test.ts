import { describe, expect, it } from 'bun:test'
import { DemoModeForbiddenError, isInternalTokenValid, requireAdmin } from './guard'

const requestMeta = {
  requestId: 'req-guard',
  startedAtMs: 0,
}

describe('requireAdmin', () => {
  it('allows admin mode', () => {
    expect(() =>
      requireAdmin({
        auth: { mode: 'admin' as const },
        internalAuth: { hasValidToken: false, tokenSource: null },
        requestMeta,
      })
    ).not.toThrow()
  })

  it('rejects demo mode even if internal token is present', () => {
    expect(() =>
      requireAdmin({
        auth: { mode: 'demo' as const },
        internalAuth: { hasValidToken: true, tokenSource: 'x-internal-token' as const },
        requestMeta,
      })
    ).toThrow(DemoModeForbiddenError)
  })
})

describe('isInternalTokenValid', () => {
  it('accepts only the exact configured internal token', () => {
    const env = {
      PRIVATE_ACCESS_TOKEN: 'internal-token-secret',
    }

    expect(
      isInternalTokenValid({
        providedToken: 'internal-token-secret',
        env,
      })
    ).toBe(true)
    expect(
      isInternalTokenValid({
        providedToken: 'internal-token-secret ',
        env,
      })
    ).toBe(false)
    expect(
      isInternalTokenValid({
        providedToken: null,
        env,
      })
    ).toBe(false)
  })
})
