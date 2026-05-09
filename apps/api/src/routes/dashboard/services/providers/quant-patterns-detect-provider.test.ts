import { describe, expect, it } from 'bun:test'
import type { Provider, ProviderCallContext } from '@finance-os/provider-contract'
import {
  assertProviderContract,
  assertProviderDoesNotExposeForbiddenCapabilities,
  assertProviderLogsSafe,
  assertProviderResultSafe,
  type CapturedLogLine,
  type ProviderLogTarget,
} from '@finance-os/provider-runtime'
import { createQuantPatternsDetectProvider } from './quant-patterns-detect-provider'

const baseConfig = {
  enabled: true,
  url: 'http://quant.local',
  timeoutMs: 1_000,
}

const captureLogs = (): { target: ProviderLogTarget; lines: CapturedLogLine[] } => {
  const lines: CapturedLogLine[] = []
  return {
    lines,
    target: {
      logEvent: ({ level, msg, ...rest }) => {
        lines.push({ level: String(level), msg: String(msg), ...rest })
      },
    },
  }
}

const ctx = (overrides: Partial<ProviderCallContext> = {}): ProviderCallContext => ({
  mode: 'admin',
  requestId: 'req-test',
  now: new Date('2026-05-09T12:00:00Z'),
  reason: 'unit-test',
  ...overrides,
})

const sampleCandles = Array.from({ length: 30 }, (_, i) => ({
  timestamp: `2026-05-0${(i % 9) + 1}T16:00:00Z`,
  open: 100 + i,
  high: 101 + i,
  low: 99 + i,
  close: 100.5 + i,
  volume: 1_000,
}))

describe('createQuantPatternsDetectProvider', () => {
  it('passes the contract harness and exposes a non-forbidden capability', () => {
    const { target } = captureLogs()
    const provider = createQuantPatternsDetectProvider({
      config: baseConfig,
      logTarget: target,
    }) as unknown as Provider
    assertProviderContract(provider)
    assertProviderDoesNotExposeForbiddenCapabilities(provider)
    expect(String(provider.id)).toBe('quant-service')
    expect(provider.capability).toBe('quant.patterns.detect')
  })

  it('demo mode returns deterministic fixture without calling fetch', async () => {
    const { target, lines } = captureLogs()
    let fetchCalls = 0
    const provider = createQuantPatternsDetectProvider({
      config: baseConfig,
      logTarget: target,
      fetchImpl: async () => {
        fetchCalls += 1
        return new Response('{}', { status: 200 })
      },
      now: () => new Date('2026-05-09T12:00:00Z'),
    })
    const result = await provider.call(
      { timeframe: '1h', candles: sampleCandles },
      ctx({ mode: 'demo' })
    )
    assertProviderResultSafe(result)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.sources[0]?.fromCache).toBe(true)
      expect(result.data.response).toBeDefined()
    }
    expect(fetchCalls).toBe(0)
    assertProviderLogsSafe(lines)
  })

  it('returns disabled_by_flag when quant-service is disabled and never calls fetch', async () => {
    const { target, lines } = captureLogs()
    let fetchCalls = 0
    const provider = createQuantPatternsDetectProvider({
      config: { ...baseConfig, enabled: false },
      logTarget: target,
      fetchImpl: async () => {
        fetchCalls += 1
        return new Response('{}', { status: 200 })
      },
    })
    const result = await provider.call(
      { timeframe: '1h', candles: sampleCandles },
      ctx({ mode: 'admin' })
    )
    assertProviderResultSafe(result)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('disabled_by_flag')
      expect(result.error.retryable).toBe(false)
    }
    expect(fetchCalls).toBe(0)
    expect(provider.getHealth().status).toBe('down')
    assertProviderLogsSafe(lines)
  })

  it('admin success maps upstream JSON to providerOk and updates health', async () => {
    const { target, lines } = captureLogs()
    const upstream = {
      detections: [{ id: 'd1', patternType: 'fair_value_gap' }],
      paramsHash: 'abc',
    }
    const provider = createQuantPatternsDetectProvider({
      config: baseConfig,
      logTarget: target,
      fetchImpl: async () =>
        new Response(JSON.stringify(upstream), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      now: () => new Date('2026-05-09T12:00:00Z'),
    })
    const result = await provider.call(
      { timeframe: '1h', candles: sampleCandles },
      ctx({ mode: 'admin' })
    )
    assertProviderResultSafe(result)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.response).toEqual(upstream)
      expect(result.meta.sources[0]?.fromCache).toBe(false)
    }
    expect(provider.getHealth().status).toBe('ok')
    assertProviderLogsSafe(lines)
  })

  it('does not log raw candle data even when upstream errors', async () => {
    const { target, lines } = captureLogs()
    const provider = createQuantPatternsDetectProvider({
      config: baseConfig,
      logTarget: target,
      fetchImpl: async () => new Response('{"error":"raw payload echo"}', { status: 502 }),
    })
    const candles = [
      { timestamp: '2026-05-09T16:00:00Z', open: 999.123456, high: 1, low: 0, close: 0, volume: 7 },
    ]
    const result = await provider.call({ timeframe: '1h', candles }, ctx({ mode: 'admin' }))
    assertProviderResultSafe(result)
    expect(result.ok).toBe(false)
    assertProviderLogsSafe(lines)
    for (const line of lines) {
      const stringified = JSON.stringify(line)
      // Concrete candle values must not appear in any log line.
      expect(stringified).not.toContain('999.123456')
      expect(stringified).not.toContain('raw payload echo')
    }
  })

  it('maps HTTP 429 to rate_limited and 5xx to transient', async () => {
    const { target, lines } = captureLogs()
    let nextStatus = 429
    const provider = createQuantPatternsDetectProvider({
      config: baseConfig,
      logTarget: target,
      fetchImpl: async () => new Response('{}', { status: nextStatus }),
    })
    const r1 = await provider.call(
      { timeframe: '1h', candles: sampleCandles },
      ctx({ mode: 'admin' })
    )
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.error.code).toBe('rate_limited')

    nextStatus = 503
    const r2 = await provider.call(
      { timeframe: '1h', candles: sampleCandles },
      ctx({ mode: 'admin' })
    )
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.error.code).toBe('transient')

    assertProviderLogsSafe(lines)
  })

  it('thrown errors normalize to provider_unavailable', async () => {
    const { target, lines } = captureLogs()
    const provider = createQuantPatternsDetectProvider({
      config: baseConfig,
      logTarget: target,
      fetchImpl: async () => {
        throw new Error('boom')
      },
    })
    const result = await provider.call(
      { timeframe: '1h', candles: sampleCandles },
      ctx({ mode: 'admin' })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('provider_unavailable')
    }
    assertProviderLogsSafe(lines)
  })
})
