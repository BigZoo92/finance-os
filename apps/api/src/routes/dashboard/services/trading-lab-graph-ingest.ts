/**
 * Send compact Trading Lab summaries (strategy + backtest run) to the
 * knowledge graph. Fail-soft: errors do not break the backtest flow.
 *
 * NEVER sends full equity curves or trade lists — graph stores compact memory only.
 */

interface BacktestSummaryIngestInput {
  strategy: {
    id: number
    name: string
    slug: string
    strategyType: string
    status: string
    description: string | null
    tags: string[]
    assumptions: string[]
    caveats: string[]
    indicators: Array<{ name: string; params: Record<string, unknown> }>
  }
  backtest: {
    id: number
    symbol: string
    startDate: Date | string
    endDate: Date | string
    initialCash: number
    feesBps: number
    slippageBps: number
    metrics: Record<string, unknown> | null
    paramsHash: string | null
    dataHash: string | null
    runStatus: string
  }
  caveats: string[]
}

interface GraphIngestResult {
  ok: boolean
  reason?: string
}

const toIso = (v: Date | string): string =>
  v instanceof Date ? v.toISOString() : new Date(v).toISOString()

/** Keep only top metric keys to bound payload size. */
const compactMetrics = (metrics: Record<string, unknown> | null): Record<string, unknown> => {
  if (!metrics) return {}
  const keys = [
    'cagr',
    'sharpe',
    'sortino',
    'max_drawdown',
    'calmar',
    'win_rate',
    'profit_factor',
    'total_trades',
    'total_fees',
    'total_slippage',
  ]
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    if (metrics[k] !== undefined && metrics[k] !== null) out[k] = metrics[k]
  }
  return out
}

export const sendBacktestToKnowledgeGraph = async ({
  knowledgeServiceUrl,
  knowledgeServiceEnabled,
  ingestEnabled,
  requestId,
  input,
  timeoutMs = 5_000,
}: {
  knowledgeServiceUrl: string
  knowledgeServiceEnabled: boolean
  ingestEnabled: boolean
  requestId: string
  input: BacktestSummaryIngestInput
  timeoutMs?: number
}): Promise<GraphIngestResult> => {
  if (!knowledgeServiceEnabled) return { ok: false, reason: 'knowledge_service_disabled' }
  if (!ingestEnabled) return { ok: false, reason: 'graph_ingest_disabled' }

  const payload = {
    mode: 'admin',
    source: 'finance-os-trading-lab',
    strategies: [
      {
        id: input.strategy.id,
        name: input.strategy.name,
        slug: input.strategy.slug,
        strategyType: input.strategy.strategyType,
        status: input.strategy.status,
        description: input.strategy.description,
        tags: input.strategy.tags.slice(0, 8),
        assumptions: input.strategy.assumptions.slice(0, 5),
        caveats: input.strategy.caveats.slice(0, 5),
        indicators: input.strategy.indicators.map(i => i.name).slice(0, 5),
      },
    ],
    backtests: [
      {
        id: input.backtest.id,
        strategyId: input.strategy.id,
        strategyName: input.strategy.name,
        symbol: input.backtest.symbol,
        startDate: toIso(input.backtest.startDate),
        endDate: toIso(input.backtest.endDate),
        initialCash: input.backtest.initialCash,
        feesBps: input.backtest.feesBps,
        slippageBps: input.backtest.slippageBps,
        metrics: compactMetrics(input.backtest.metrics),
        paramsHash: input.backtest.paramsHash,
        dataHash: input.backtest.dataHash,
        caveats: input.caveats.slice(0, 5),
        runStatus: input.backtest.runStatus,
      },
    ],
    scenarios: [],
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(`${knowledgeServiceUrl}/knowledge/ingest/trading-lab`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!response.ok) {
      return { ok: false, reason: `knowledge_service_status_${response.status}` }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? `knowledge_service_error:${error.message.slice(0, 60)}` : 'knowledge_service_error',
    }
  }
}
