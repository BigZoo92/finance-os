import { describe, expect, it } from 'bun:test'
import { asProviderId, PROVIDER_ERROR_CODES } from '@finance-os/provider-contract'
import {
  createProviderError,
  isProviderError,
  normalizeProviderError,
  providerErrorToSafeJson,
  providerErrorTypeOf,
} from './error'

const pid = asProviderId('test-provider')

describe('createProviderError', () => {
  it('accepts every known ProviderErrorCode', () => {
    for (const code of PROVIDER_ERROR_CODES) {
      const err = createProviderError({
        code,
        providerId: pid,
        message: `cause for ${code}`,
      })
      expect(err.code).toBe(code)
      expect(err.providerId).toBe(pid)
    }
  })

  it('rejects unknown codes', () => {
    expect(() => {
      createProviderError({
        // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
        code: 'not_a_real_code' as any,
        providerId: pid,
        message: 'x',
      })
    }).toThrow(/unknown ProviderErrorCode/)
  })

  it('redacts secrets in safeDetails', () => {
    const err = createProviderError({
      code: 'auth_failed',
      providerId: pid,
      message: 'auth bad',
      safeDetails: { attempt: 1, token: 'leak' },
    })
    expect(err.safeDetails?.attempt).toBe(1)
    expect(err.safeDetails?.token).toBe('[REDACTED]')
  })

  it('sanitizes causeType to a low-cardinality token', () => {
    const err = createProviderError({
      code: 'transient',
      providerId: pid,
      message: 'x',
      causeType: 'TypeError <weird path>',
    })
    expect(err.causeType).toMatch(/^[a-zA-Z0-9_:.-]+$/)
  })

  it('clamps overlong messages', () => {
    const err = createProviderError({
      code: 'transient',
      providerId: pid,
      message: 'x'.repeat(2000),
    })
    expect((err.causeRedacted ?? '').length).toBeLessThanOrEqual(501)
  })
})

describe('isProviderError', () => {
  it('detects a built error', () => {
    const err = createProviderError({ code: 'rate_limited', providerId: pid, message: '429' })
    expect(isProviderError(err)).toBe(true)
  })
  it('rejects unrelated objects', () => {
    expect(isProviderError({})).toBe(false)
    expect(isProviderError(null)).toBe(false)
    expect(isProviderError({ code: 'nope', providerId: 'x', retryable: true })).toBe(false)
  })
})

describe('normalizeProviderError', () => {
  it('passes through an existing ProviderError', () => {
    const original = createProviderError({
      code: 'auth_failed',
      providerId: pid,
      message: 'bad',
    })
    const out = normalizeProviderError(original, { providerId: pid })
    expect(out).toBe(original)
  })

  it('maps an unknown thrown Error to provider_unavailable by default', () => {
    const out = normalizeProviderError(new TypeError('socket boom'), { providerId: pid })
    expect(out.code).toBe('provider_unavailable')
    expect(out.causeType).toBe('TypeError')
  })

  it('honors the configured defaultCode', () => {
    const out = normalizeProviderError('unexpected', {
      providerId: pid,
      defaultCode: 'transient',
    })
    expect(out.code).toBe('transient')
  })
})

describe('providerErrorToSafeJson', () => {
  it('omits stack and exposes a stable browser-safe shape', () => {
    const err = createProviderError({
      code: 'tos_blocked',
      providerId: pid,
      message: 'forbidden',
      capability: 'market.quotes.read',
      requestId: 'req-1',
      safeDetails: { reason: 'tos', ok: true },
    })
    const json = providerErrorToSafeJson(err)
    expect(Object.keys(json).sort()).toEqual([
      'capability',
      'causeType',
      'code',
      'message',
      'providerId',
      'retryable',
      'safeDetails',
    ])
    expect((json as Record<string, unknown>).stack).toBeUndefined()
    expect(json.code).toBe('tos_blocked')
    expect(json.capability).toBe('market.quotes.read')
  })

  it('redacts secrets that somehow leaked into safeDetails', () => {
    const err = createProviderError({
      code: 'auth_failed',
      providerId: pid,
      message: 'x',
      safeDetails: { reason: 'rotated', token: 'sneaky' },
    })
    const json = providerErrorToSafeJson(err)
    expect(json.safeDetails?.token).toBe('[REDACTED]')
  })
})

describe('providerErrorTypeOf', () => {
  it('emits low-cardinality strings keyed by closed code union', () => {
    for (const code of PROVIDER_ERROR_CODES) {
      expect(providerErrorTypeOf(code)).toBe(`provider.${code}`)
    }
  })
})
