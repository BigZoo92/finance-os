import { describe, expect, it } from 'bun:test'
import type { ProviderLogTarget } from '@finance-os/provider-runtime'
import { Elysia, t } from 'elysia'
import { buildDemoPatternDetectionResponse } from '../services/pattern-detection-demo'
import {
  createQuantPatternsDetectProvider,
  type FetchImpl,
} from '../services/providers/quant-patterns-detect-provider'

// Macro Prompt 2-fix — route-level test for `/dashboard/trading-lab/patterns/detect`.
//
// Mirrors `trading-lab-hypotheses.test.ts`: we do NOT import `createTradingLabRoute`
// directly because that factory transitively pulls `@finance-os/db`. Instead we mount
// the exact handler logic the production route uses against an isolated Elysia app +
// the real provider wrapper + a fake fetch. The handler body is duplicated from
// trading-lab.ts:/patterns/detect on purpose — it is the unit under test.

interface MountInput {
  quantServiceEnabled: boolean
  quantServiceUrl: string
  quantServiceTimeoutMs: number
  fetchImpl?: FetchImpl
  logTarget?: ProviderLogTarget
  mode: 'admin' | 'demo'
  requestId: string
}

const collectingTarget = (): { target: ProviderLogTarget; lines: unknown[] } => {
  const lines: unknown[] = []
  return {
    lines,
    target: {
      logEvent: payload => {
        lines.push(payload)
      },
    },
  }
}

const mountApp = (deps: MountInput) => {
  const { target, lines } = (() => {
    if (deps.logTarget !== undefined) {
      return { target: deps.logTarget, lines: [] as unknown[] }
    }
    return collectingTarget()
  })()

  const provider = createQuantPatternsDetectProvider({
    config: {
      enabled: deps.quantServiceEnabled,
      url: deps.quantServiceUrl,
      timeoutMs: deps.quantServiceTimeoutMs,
    },
    logTarget: target,
    ...(deps.fetchImpl !== undefined ? { fetchImpl: deps.fetchImpl } : {}),
  })

  const app = new Elysia().post(
    '/patterns/detect',
    async context => {
      if (deps.mode === 'demo') {
        return buildDemoPatternDetectionResponse(context.body)
      }
      const result = await provider.call(context.body as Parameters<typeof provider.call>[0], {
        mode: 'admin',
        requestId: deps.requestId,
        now: new Date(),
        reason: 'route:trading-lab.patterns.detect',
      })
      if (result.ok) {
        return { ok: true, ...(result.data.response as object) }
      }
      context.set.status = 503
      if (result.error.code === 'disabled_by_flag') {
        return {
          ok: false,
          code: 'QUANT_SERVICE_DISABLED',
          message: 'Quant service is disabled',
          requestId: deps.requestId,
        }
      }
      return {
        ok: false,
        code: 'QUANT_SERVICE_UNAVAILABLE',
        message: result.error.causeRedacted ?? 'Quant service unreachable',
        requestId: deps.requestId,
      }
    },
    {
      body: t.Object({
        timeframe: t.String({ minLength: 1, maxLength: 16 }),
        candles: t.Array(
          t.Object({
            timestamp: t.String(),
            open: t.Number(),
            high: t.Number(),
            low: t.Number(),
            close: t.Number(),
            volume: t.Optional(t.Union([t.Number(), t.Null()])),
          })
        ),
      }),
    }
  )

  return { app, lines }
}

const SAMPLE_BODY = {
  timeframe: '1h',
  candles: Array.from({ length: 12 }, (_, i) => ({
    timestamp: `2026-05-09T${String(i).padStart(2, '0')}:00:00Z`,
    open: 100 + i,
    high: 101 + i,
    low: 99 + i,
    close: 100.5 + i,
    volume: 1_000,
  })),
}

const buildRequest = (body: unknown) =>
  new Request('http://localhost/patterns/detect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /patterns/detect (rewired through quant-patterns-detect provider)', () => {
  it('admin success preserves the public response shape { ok: true, ...upstreamBody }', async () => {
    let observedFetchCount = 0
    const upstream = {
      symbol: null,
      timeframe: '1h',
      detections: [{ id: 'd1', patternType: 'fair_value_gap', confidence: 'medium' }],
      generatedAt: '2026-05-09T12:00:00Z',
      paramsHash: 'p1',
      dataHash: 'd1',
    }
    const { app } = mountApp({
      quantServiceEnabled: true,
      quantServiceUrl: 'http://quant.local',
      quantServiceTimeoutMs: 1_000,
      mode: 'admin',
      requestId: 'req-success',
      fetchImpl: async () => {
        observedFetchCount += 1
        return new Response(JSON.stringify(upstream), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    })
    const response = await app.handle(buildRequest(SAMPLE_BODY))
    expect(response.status).toBe(200)
    const json = (await response.json()) as Record<string, unknown>
    expect(json.ok).toBe(true)
    expect(json.detections).toEqual(upstream.detections)
    expect(json.timeframe).toBe('1h')
    expect(json.paramsHash).toBe('p1')
    expect(observedFetchCount).toBe(1)
  })

  it('admin: provider returns disabled_by_flag → 503 QUANT_SERVICE_DISABLED, no fetch call', async () => {
    let fetchCalls = 0
    const { app } = mountApp({
      quantServiceEnabled: false,
      quantServiceUrl: 'http://quant.local',
      quantServiceTimeoutMs: 1_000,
      mode: 'admin',
      requestId: 'req-disabled',
      fetchImpl: async () => {
        fetchCalls += 1
        return new Response('{}', { status: 200 })
      },
    })
    const response = await app.handle(buildRequest(SAMPLE_BODY))
    expect(response.status).toBe(503)
    const json = (await response.json()) as Record<string, unknown>
    expect(json).toEqual({
      ok: false,
      code: 'QUANT_SERVICE_DISABLED',
      message: 'Quant service is disabled',
      requestId: 'req-disabled',
    })
    expect(fetchCalls).toBe(0)
  })

  it('admin: provider returns transient (HTTP 5xx) → 503 QUANT_SERVICE_UNAVAILABLE', async () => {
    const { app } = mountApp({
      quantServiceEnabled: true,
      quantServiceUrl: 'http://quant.local',
      quantServiceTimeoutMs: 1_000,
      mode: 'admin',
      requestId: 'req-5xx',
      fetchImpl: async () =>
        new Response('{"error":"raw upstream body should not surface"}', {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
    })
    const response = await app.handle(buildRequest(SAMPLE_BODY))
    expect(response.status).toBe(503)
    const json = (await response.json()) as Record<string, unknown>
    expect(json.ok).toBe(false)
    expect(json.code).toBe('QUANT_SERVICE_UNAVAILABLE')
    expect(json.requestId).toBe('req-5xx')
    // The public message must NOT echo the upstream body.
    expect(JSON.stringify(json)).not.toContain('raw upstream body should not surface')
  })

  it('admin: thrown fetch error → 503 QUANT_SERVICE_UNAVAILABLE', async () => {
    const { app } = mountApp({
      quantServiceEnabled: true,
      quantServiceUrl: 'http://quant.local',
      quantServiceTimeoutMs: 1_000,
      mode: 'admin',
      requestId: 'req-thrown',
      fetchImpl: async () => {
        throw new Error('connect ECONNREFUSED secret://internal-host:1234')
      },
    })
    const response = await app.handle(buildRequest(SAMPLE_BODY))
    expect(response.status).toBe(503)
    const json = (await response.json()) as Record<string, unknown>
    expect(json.code).toBe('QUANT_SERVICE_UNAVAILABLE')
    expect(json.requestId).toBe('req-thrown')
  })

  it('demo mode does NOT invoke fetch and returns the deterministic fixture', async () => {
    let fetchCalls = 0
    const { app } = mountApp({
      quantServiceEnabled: true,
      quantServiceUrl: 'http://quant.local',
      quantServiceTimeoutMs: 1_000,
      mode: 'demo',
      requestId: 'req-demo',
      fetchImpl: async () => {
        fetchCalls += 1
        return new Response('{}', { status: 200 })
      },
    })
    const response = await app.handle(buildRequest(SAMPLE_BODY))
    expect(response.status).toBe(200)
    const json = (await response.json()) as Record<string, unknown>
    // Same shape as the demo helper.
    const expected = buildDemoPatternDetectionResponse(SAMPLE_BODY)
    expect(json).toEqual(expected)
    expect(fetchCalls).toBe(0)
  })

  it('logs never contain raw candle values, raw fetch errors, or upstream error bodies', async () => {
    const logLines: unknown[] = []
    const collectingLogTarget: ProviderLogTarget = {
      logEvent: payload => {
        logLines.push(payload)
      },
    }
    const { app } = mountApp({
      quantServiceEnabled: true,
      quantServiceUrl: 'http://quant.local',
      quantServiceTimeoutMs: 1_000,
      mode: 'admin',
      requestId: 'req-log-check',
      logTarget: collectingLogTarget,
      fetchImpl: async () => new Response('{"error":"DO_NOT_LOG_RAW_BODY"}', { status: 502 }),
    })
    const candleSentinel = 'CANDLE_SENTINEL_42_42_42'
    const sentinelBody = {
      timeframe: '1h',
      candles: Array.from({ length: 12 }, (_, i) => ({
        timestamp: `${candleSentinel}:${i}`,
        open: 99999.42424242,
        high: 1,
        low: 0,
        close: 0,
        volume: 7,
      })),
    }
    await app.handle(buildRequest(sentinelBody))

    const stringified = JSON.stringify(logLines)
    expect(stringified).not.toContain('DO_NOT_LOG_RAW_BODY')
    expect(stringified).not.toContain(candleSentinel)
    expect(stringified).not.toContain('99999.42424242')
  })

  it('does not introduce execution vocabulary in the public response on failure', async () => {
    const FORBIDDEN_VOCAB = ['order', 'execute', 'trade.create', 'transfer', 'swap', 'payment']
    const { app } = mountApp({
      quantServiceEnabled: false,
      quantServiceUrl: 'http://quant.local',
      quantServiceTimeoutMs: 1_000,
      mode: 'admin',
      requestId: 'req-vocab',
      fetchImpl: async () => new Response('{}', { status: 200 }),
    })
    const response = await app.handle(buildRequest(SAMPLE_BODY))
    const json = (await response.json()) as Record<string, unknown>
    const stringified = JSON.stringify(json).toLowerCase()
    for (const word of FORBIDDEN_VOCAB) {
      expect(stringified).not.toContain(word)
    }
  })
})
