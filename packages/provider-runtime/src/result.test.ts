import { describe, expect, it } from 'bun:test'
import { asProviderId, type ProviderMeta } from '@finance-os/provider-contract'
import { createProviderError } from './error'
import {
  mapProviderError,
  mapProviderResult,
  providerErr,
  providerOk,
  unwrapProviderResultOrThrow,
} from './result'

const pid = asProviderId('test-provider')

const meta: ProviderMeta = {
  requestId: 'req-1',
  durationMs: 5,
  sources: [
    { providerId: pid, capability: 'market.quotes.read', freshnessMinutes: 0, fromCache: false },
  ],
}

describe('providerOk / providerErr', () => {
  it('discriminates correctly off `ok`', () => {
    const ok = providerOk({ value: 1 }, meta)
    const err = providerErr(
      createProviderError({ code: 'rate_limited', providerId: pid, message: '429' }),
      meta
    )
    if (ok.ok) {
      expect(ok.data.value).toBe(1)
    } else {
      throw new Error('expected ok branch')
    }
    if (err.ok) {
      throw new Error('expected err branch')
    }
    expect(err.error.code).toBe('rate_limited')
  })

  it('always carries meta on both branches', () => {
    const ok = providerOk({}, meta)
    const err = providerErr(
      createProviderError({ code: 'transient', providerId: pid, message: 'x' }),
      meta
    )
    expect(ok.meta).toBe(meta)
    expect(err.meta).toBe(meta)
  })
})

describe('mapProviderResult / mapProviderError', () => {
  it('mapProviderResult preserves meta on ok', () => {
    const ok = providerOk({ value: 1 }, meta)
    const mapped = mapProviderResult(ok, d => d.value + 1)
    if (!mapped.ok) {
      throw new Error('expected ok branch')
    }
    expect(mapped.data).toBe(2)
    expect(mapped.meta).toBe(meta)
  })

  it('mapProviderResult is a no-op on err', () => {
    const err = providerErr(
      createProviderError({ code: 'transient', providerId: pid, message: 'x' }),
      meta
    )
    const mapped = mapProviderResult(err, (n: number) => n + 1)
    expect(mapped).toBe(err)
  })

  it('mapProviderError is a no-op on ok', () => {
    const ok = providerOk({ value: 1 }, meta)
    const mapped = mapProviderError(ok, () =>
      createProviderError({ code: 'permanent', providerId: pid, message: 'x' })
    )
    expect(mapped).toBe(ok)
  })

  it('mapProviderError rewrites the error on err', () => {
    const err = providerErr(
      createProviderError({ code: 'transient', providerId: pid, message: 'a' }),
      meta
    )
    const mapped = mapProviderError(err, () =>
      createProviderError({ code: 'permanent', providerId: pid, message: 'b' })
    )
    if (mapped.ok) {
      throw new Error('expected err branch')
    }
    expect(mapped.error.code).toBe('permanent')
    expect(mapped.meta).toBe(meta)
  })
})

describe('unwrapProviderResultOrThrow', () => {
  it('returns data on ok', () => {
    const ok = providerOk({ value: 7 }, meta)
    expect(unwrapProviderResultOrThrow(ok).value).toBe(7)
  })
  it('throws on err with the closed code in the message', () => {
    const err = providerErr(
      createProviderError({ code: 'auth_failed', providerId: pid, message: 'bad' }),
      meta
    )
    expect(() => {
      unwrapProviderResultOrThrow(err)
    }).toThrow(/auth_failed/)
  })
})
