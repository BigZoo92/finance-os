import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test'
import { sendBacktestToKnowledgeGraph } from './trading-lab-graph-ingest'

const baseInput = {
  strategy: {
    id: 1,
    name: 'EMA Crossover',
    slug: 'ema-crossover',
    strategyType: 'experimental',
    status: 'active-paper',
    description: 'Test strategy',
    tags: ['trend', 'experimental'],
    assumptions: ['Trend persistence'],
    caveats: ['Whipsaws in ranging markets'],
    indicators: [{ name: 'ema', params: { period: 10 } }],
  },
  backtest: {
    id: 42,
    symbol: 'SPY.US',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-06-01'),
    initialCash: 10000,
    feesBps: 10,
    slippageBps: 5,
    metrics: { cagr: 0.08, sharpe: 0.7, max_drawdown: 0.15, total_trades: 12, irrelevant: 'drop' },
    paramsHash: 'phash',
    dataHash: 'dhash',
    runStatus: 'completed',
  },
  caveats: ['Backtests are not predictions.'],
}

describe('sendBacktestToKnowledgeGraph', () => {
  const originalFetch = globalThis.fetch
  beforeEach(() => {
    // reset between tests
    ;(globalThis as { fetch: typeof fetch }).fetch = originalFetch
  })
  afterEach(() => {
    ;(globalThis as { fetch: typeof fetch }).fetch = originalFetch
  })

  it('returns ok=false when knowledge service disabled', async () => {
    const result = await sendBacktestToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: false,
      ingestEnabled: true,
      requestId: 'r1',
      input: baseInput,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('knowledge_service_disabled')
  })

  it('returns ok=false when ingest disabled', async () => {
    const result = await sendBacktestToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: true,
      ingestEnabled: false,
      requestId: 'r1',
      input: baseInput,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('graph_ingest_disabled')
  })

  it('sends compact payload and never includes equity curve / trades', async () => {
    const captured: { url?: string; body?: unknown } = {}
    ;(globalThis as { fetch: typeof fetch }).fetch = mock(async (url: string | URL, init?: RequestInit) => {
      captured.url = String(url)
      captured.body = init?.body ? JSON.parse(String(init.body)) : null
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as unknown as typeof fetch

    const result = await sendBacktestToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: true,
      ingestEnabled: true,
      requestId: 'r1',
      input: baseInput,
    })

    expect(result.ok).toBe(true)
    expect(captured.url).toContain('/knowledge/ingest/trading-lab')
    const body = captured.body as Record<string, unknown>
    expect(body.mode).toBe('admin')
    expect(body.source).toBe('finance-os-trading-lab')
    expect(Array.isArray(body.strategies)).toBe(true)
    expect(Array.isArray(body.backtests)).toBe(true)
    const bt = (body.backtests as Array<Record<string, unknown>>)[0]
    expect(bt).toBeDefined()
    if (!bt) {
      throw new Error('Expected compact backtest payload')
    }
    expect(bt.id).toBe(42)
    expect(bt.symbol).toBe('SPY.US')
    // equity curve / trades MUST NOT appear in graph payload
    expect('equityCurve' in bt).toBe(false)
    expect('equity_curve' in bt).toBe(false)
    expect('trades' in bt).toBe(false)
    // metrics filtered to known compact set, irrelevant key dropped
    const metrics = bt.metrics as Record<string, unknown>
    expect('cagr' in metrics).toBe(true)
    expect('irrelevant' in metrics).toBe(false)
  })

  it('fail-soft on fetch error', async () => {
    ;(globalThis as { fetch: typeof fetch }).fetch = mock(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch

    const result = await sendBacktestToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: true,
      ingestEnabled: true,
      requestId: 'r1',
      input: baseInput,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('knowledge_service_error')
  })

  it('fail-soft on non-OK response', async () => {
    ;(globalThis as { fetch: typeof fetch }).fetch = mock(async () => {
      return new Response('boom', { status: 500 })
    }) as unknown as typeof fetch

    const result = await sendBacktestToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: true,
      ingestEnabled: true,
      requestId: 'r1',
      input: baseInput,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('knowledge_service_status_500')
  })
})
