import { describe, expect, it } from 'bun:test'
import { DemoModeForbiddenError, requireAdmin } from './guard'

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
