import { describe, expect, it } from 'bun:test'
import {
  assertNoSensitiveProviderFields,
  createSensitiveKeyMatcher,
  redactProviderLogFields,
  redactProviderPayload,
} from './redaction'

describe('redactProviderPayload', () => {
  it('redacts sensitive keys recursively', () => {
    const input = {
      ok: true,
      apiKey: 'sk_live_123',
      nested: {
        token: 'abc.def',
        password: 'p@ss',
        cookie: 'session=foo',
        client_secret: 'cs',
        refresh_token: 'rt',
        innocuous: 42,
      },
      list: [{ authorization: 'Bearer x' }, { jwt: 'eyJ.x' }, { ok: 1 }],
    }
    const out = redactProviderPayload(input) as Record<string, unknown>
    expect(out.apiKey).toBe('[REDACTED]')
    const nested = out.nested as Record<string, unknown>
    expect(nested.token).toBe('[REDACTED]')
    expect(nested.password).toBe('[REDACTED]')
    expect(nested.cookie).toBe('[REDACTED]')
    expect(nested.client_secret).toBe('[REDACTED]')
    expect(nested.refresh_token).toBe('[REDACTED]')
    expect(nested.innocuous).toBe(42)
    const list = out.list as Array<Record<string, unknown>>
    expect(list[0]?.authorization).toBe('[REDACTED]')
    expect(list[1]?.jwt).toBe('[REDACTED]')
    expect(list[2]?.ok).toBe(1)
  })

  it('matches sensitive key fragments case-insensitively', () => {
    const out = redactProviderPayload({ ApiKey: 'x', BEARER_HEADER: 'y' }) as Record<
      string,
      unknown
    >
    expect(out.ApiKey).toBe('[REDACTED]')
    expect(out.BEARER_HEADER).toBe('[REDACTED]')
  })

  it('handles circular references without throwing', () => {
    type Node = { name: string; self?: Node }
    const a: Node = { name: 'a' }
    a.self = a
    const out = redactProviderPayload(a) as Record<string, unknown>
    expect(out.name).toBe('a')
    expect(out.self).toBe('[Circular]')
  })

  it('clamps long strings', () => {
    const long = 'x'.repeat(2000)
    const out = redactProviderPayload({ note: long }, { maxStringLength: 100 }) as {
      note: string
    }
    expect(out.note.length).toBeLessThan(long.length)
    expect(out.note.startsWith('xxx')).toBe(true)
    expect(out.note).toContain('clamped')
  })

  it('redacts Error name + message and never includes stack', () => {
    const err = new Error('boom token=secret')
    const out = redactProviderPayload(err) as Record<string, unknown>
    expect(out.name).toBe('Error')
    expect(typeof out.message).toBe('string')
    expect(Object.keys(out).includes('stack')).toBe(false)
  })

  it('serializes Date as ISO string', () => {
    const d = new Date('2026-05-09T00:00:00.000Z')
    expect(redactProviderPayload(d)).toBe('2026-05-09T00:00:00.000Z')
  })

  it('reports unknown class instances as a tag, not their fields', () => {
    class Wallet {
      constructor(public secret = 'shh') {}
    }
    const out = redactProviderPayload({ w: new Wallet() }) as Record<string, unknown>
    expect(out.w).toBe('[Wallet]')
  })

  it('respects custom sensitive key matchers', () => {
    const matcher = createSensitiveKeyMatcher(['biscuit'])
    const out = redactProviderPayload({ biscuit: 'cookie-jar' }, { matcher }) as Record<
      string,
      unknown
    >
    expect(out.biscuit).toBe('[REDACTED]')
  })
})

describe('redactProviderLogFields', () => {
  it('redacts both top-level keys and nested values', () => {
    const out = redactProviderLogFields({
      providerId: 'powens',
      apiKey: 'leak',
      payload: { token: 'leak2', ok: 1 },
    })
    expect(out.providerId).toBe('powens')
    expect(out.apiKey).toBe('[REDACTED]')
    const payload = out.payload as Record<string, unknown>
    expect(payload.token).toBe('[REDACTED]')
    expect(payload.ok).toBe(1)
  })
})

describe('assertNoSensitiveProviderFields', () => {
  it('passes after running through redactProviderPayload', () => {
    const out = redactProviderPayload({
      token: 'x',
      nested: { password: 'y', ok: 1 },
    })
    expect(() => {
      assertNoSensitiveProviderFields(out)
    }).not.toThrow()
  })

  it('throws on raw payloads carrying secrets', () => {
    expect(() => {
      assertNoSensitiveProviderFields({ token: 'leak' })
    }).toThrow(/sensitive/i)
  })
})
