import { describe, expect, it } from 'bun:test'
import {
  DemoModeForbiddenError,
  InvalidCredentialsError,
  isInternalTokenValid,
  rejectInvalidCredentials,
  requireAdmin,
} from './guard'

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

describe('rejectInvalidCredentials', () => {
  it('passes through when no credential was attempted', () => {
    expect(() =>
      rejectInvalidCredentials({
        auth: { mode: 'demo' as const },
        internalAuth: { hasValidToken: false, tokenSource: null },
        requestMeta,
      })
    ).not.toThrow()
  })

  it('passes through when credential validated', () => {
    expect(() =>
      rejectInvalidCredentials({
        auth: { mode: 'demo' as const },
        internalAuth: { hasValidToken: true, tokenSource: 'authorization' as const },
        requestMeta,
      })
    ).not.toThrow()
  })

  it('rejects when a bearer token was provided but failed validation', () => {
    expect(() =>
      rejectInvalidCredentials({
        auth: { mode: 'demo' as const },
        internalAuth: { hasValidToken: false, tokenSource: 'authorization' as const },
        requestMeta,
      })
    ).toThrow(InvalidCredentialsError)
  })

  it('rejects when an x-internal-token was provided but failed validation', () => {
    expect(() =>
      rejectInvalidCredentials({
        auth: { mode: 'demo' as const },
        internalAuth: { hasValidToken: false, tokenSource: 'x-internal-token' as const },
        requestMeta,
      })
    ).toThrow(InvalidCredentialsError)
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
