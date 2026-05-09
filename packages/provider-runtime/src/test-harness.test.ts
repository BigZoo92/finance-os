import { describe, expect, it } from 'bun:test'
import { asProviderId, type Provider, type ProviderResult } from '@finance-os/provider-contract'
import { createProviderError } from './error'
import { providerErr, providerOk } from './result'
import {
  assertProviderContract,
  assertProviderDoesNotExposeForbiddenCapabilities,
  assertProviderErrorSafe,
  assertProviderLogsSafe,
  assertProviderResultSafe,
} from './test-harness'

const pid = asProviderId('fake')

const baseMeta = {
  requestId: 'req-harness',
  durationMs: 0,
  sources: [
    {
      providerId: pid,
      capability: 'market.quotes.read' as const,
      freshnessMinutes: 0,
      fromCache: false,
    },
  ],
}

const makeProvider = (): Provider => ({
  id: pid,
  capability: 'market.quotes.read',
  call: async (_input, ctx) =>
    providerOk(
      {},
      {
        ...baseMeta,
        requestId: ctx.requestId,
      }
    ),
  getHealth: () => ({ status: 'ok', lastSuccessAt: null, lastErrorCode: null }),
})

describe('assertProviderContract', () => {
  it('passes for a well-formed fake provider', () => {
    expect(() => {
      assertProviderContract(makeProvider())
    }).not.toThrow()
  })

  it('rejects providers with a missing call function', () => {
    const p = { ...makeProvider(), call: undefined as unknown as Provider['call'] }
    expect(() => {
      assertProviderContract(p)
    }).toThrow(/call must be a function/)
  })
})

describe('assertProviderDoesNotExposeForbiddenCapabilities', () => {
  it('passes for an allowed capability', () => {
    expect(() => {
      assertProviderDoesNotExposeForbiddenCapabilities(makeProvider())
    }).not.toThrow()
  })

  it('throws for a forbidden capability that somehow leaked in', () => {
    const bad: Provider = {
      ...makeProvider(),
      // biome-ignore lint/suspicious/noExplicitAny: testing forbidden value
      capability: 'trading.order.create' as any,
    }
    expect(() => {
      assertProviderDoesNotExposeForbiddenCapabilities(bad)
    }).toThrow(/forbidden capability/)
  })
})

describe('assertProviderErrorSafe', () => {
  it('passes for a built ProviderError', () => {
    const err = createProviderError({ code: 'transient', providerId: pid, message: 'x' })
    expect(() => {
      assertProviderErrorSafe(err)
    }).not.toThrow()
  })

  it('rejects unknown error codes', () => {
    expect(() => {
      assertProviderErrorSafe({
        // biome-ignore lint/suspicious/noExplicitAny: testing invalid value
        code: 'nope' as any,
        providerId: pid,
        retryable: false,
      })
    }).toThrow()
  })
})

describe('assertProviderResultSafe', () => {
  it('passes on a normal ok result', () => {
    const ok: ProviderResult<{ value: number }> = providerOk({ value: 1 }, baseMeta)
    expect(() => {
      assertProviderResultSafe(ok)
    }).not.toThrow()
  })

  it('passes on a normal err result', () => {
    const err = providerErr(
      createProviderError({ code: 'rate_limited', providerId: pid, message: 'x' }),
      baseMeta
    )
    expect(() => {
      assertProviderResultSafe(err)
    }).not.toThrow()
  })
})

describe('assertProviderLogsSafe', () => {
  it('passes when no log line carries unredacted secrets', () => {
    expect(() => {
      assertProviderLogsSafe([{ level: 'info', msg: 'provider.call.succeeded', providerId: pid }])
    }).not.toThrow()
  })
})
