import { Elysia, t } from 'elysia'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { requireAdmin } from '../../../auth/guard'
import { logApiEvent, toErrorLogFields } from '../../../observability/logger'
import { createDashboardTradingLabRepository } from '../repositories/dashboard-trading-lab-repository'
import { createDashboardSignalItemsRepository } from '../repositories/dashboard-signal-items-repository'
import { generateDeterministicOhlcv } from '../services/trading-lab-ohlcv-fixtures'
import { sendBacktestToKnowledgeGraph } from '../services/trading-lab-graph-ingest'
import type { ApiDb } from '../types'

// ---------------------------------------------------------------------------
// Demo fixtures — deterministic, no service calls
// ---------------------------------------------------------------------------

const DEMO_STRATEGIES = [
  {
    id: 1,
    name: 'Buy & Hold Benchmark',
    slug: 'buy-and-hold',
    description: 'Simple buy and hold benchmark for comparison.',
    strategyType: 'benchmark',
    status: 'active-paper',
    enabled: true,
    tags: ['benchmark'],
    parameters: {},
    indicators: [],
    entryRules: [{ id: 'bh-1', description: 'Buy at start', condition: 'always' }],
    exitRules: [{ id: 'bh-2', description: 'Hold until end', condition: 'never' }],
    riskRules: [],
    assumptions: ['Market has long-term upward bias'],
    caveats: ['Does not manage risk', 'Full drawdown exposure'],
    scope: 'demo',
    createdAt: '2026-04-26T10:00:00Z',
    updatedAt: '2026-04-26T10:00:00Z',
  },
  {
    id: 2,
    name: 'EMA Crossover (10/20)',
    slug: 'ema-crossover-10-20',
    description: 'Experimental: Long when EMA10 > EMA20, exit when EMA10 < EMA20.',
    strategyType: 'experimental',
    status: 'draft',
    enabled: true,
    tags: ['trend', 'ema', 'experimental'],
    parameters: { fast_period: 10, slow_period: 20 },
    indicators: [
      { name: 'ema', params: { period: 10 } },
      { name: 'ema', params: { period: 20 } },
    ],
    entryRules: [{ id: 'ec-1', description: 'EMA10 crosses above EMA20', condition: 'ema_fast > ema_slow' }],
    exitRules: [{ id: 'ec-2', description: 'EMA10 crosses below EMA20', condition: 'ema_fast < ema_slow' }],
    riskRules: [],
    assumptions: ['Trend persistence in selected timeframe', 'Sufficient liquidity'],
    caveats: ['Experimental — no proven edge', 'Whipsaws in sideways markets', 'Past performance is not predictive'],
    scope: 'demo',
    createdAt: '2026-04-26T10:00:00Z',
    updatedAt: '2026-04-26T10:00:00Z',
  },
]

const DEMO_BACKTEST_METRICS = {
  cagr: 0.082,
  volatility: 0.145,
  sharpe: 0.56,
  sortino: 0.78,
  max_drawdown: 0.18,
  calmar: 0.46,
  win_rate: 0.55,
  profit_factor: 1.32,
  total_trades: 12,
  total_fees: 120,
  total_slippage: 60,
  benchmark_return: 0.065,
}

// Deterministic demo equity curve (50 points, steady growth with a dip)
const buildDemoEquityCurve = () => {
  const points: Array<{ date: string; equity: number }> = []
  let equity = 10000
  const base = new Date('2023-01-02')
  for (let i = 0; i < 50; i++) {
    const d = new Date(base)
    d.setDate(d.getDate() + i * 10)
    // Deterministic pseudo-random: steady growth with a dip at i=25-30
    const growth = i >= 25 && i <= 30 ? -0.008 : 0.003 + (i % 3) * 0.001
    equity = Math.round(equity * (1 + growth) * 100) / 100
    points.push({ date: d.toISOString().slice(0, 10), equity })
  }
  return points
}

const buildDemoDrawdowns = (equityCurve: Array<{ date: string; equity: number }>) => {
  let peak = equityCurve[0]?.equity ?? 10000
  return equityCurve.map(p => {
    if (p.equity > peak) peak = p.equity
    const dd = peak > 0 ? Math.round(((peak - p.equity) / peak) * 10000) / 10000 : 0
    return { date: p.date, drawdown: dd }
  })
}

const DEMO_EQUITY_CURVE = buildDemoEquityCurve()
const DEMO_DRAWDOWNS = buildDemoDrawdowns(DEMO_EQUITY_CURVE)

const DEMO_TRADES = [
  { entryDate: '2023-01-15', exitDate: '2023-03-20', side: 'long', entryPrice: 395.2, exitPrice: 410.5, size: 25.3, pnl: 387.15, pnlPct: 0.0387, fees: 10.2 },
  { entryDate: '2023-04-10', exitDate: '2023-06-15', side: 'long', entryPrice: 412.3, exitPrice: 430.1, size: 24.5, pnl: 436.1, pnlPct: 0.0431, fees: 10.8 },
  { entryDate: '2023-07-01', exitDate: '2023-08-20', side: 'long', entryPrice: 440.2, exitPrice: 425.6, size: 23.8, pnl: -347.48, pnlPct: -0.0332, fees: 10.4 },
]

const DEMO_BACKTESTS = [
  {
    id: 1,
    strategyId: 1,
    name: 'BH SPY 2023-2024',
    marketDataSource: 'eodhd',
    symbol: 'SPY.US',
    timeframe: '1d',
    startDate: '2023-01-01T00:00:00Z',
    endDate: '2024-12-31T00:00:00Z',
    initialCash: 10000,
    feesBps: 10,
    slippageBps: 5,
    spreadBps: 2,
    runStatus: 'completed',
    runStartedAt: '2026-04-26T10:05:00Z',
    runFinishedAt: '2026-04-26T10:05:02Z',
    durationMs: 2100,
    paramsHash: 'demo-hash-bh',
    dataHash: 'demo-hash-data',
    resultSummary: { strategy: 'buy_and_hold', dataPoints: 502 },
    metrics: DEMO_BACKTEST_METRICS,
    equityCurve: DEMO_EQUITY_CURVE,
    trades: DEMO_TRADES,
    drawdowns: DEMO_DRAWDOWNS,
    errorSummary: null,
    scope: 'demo',
    createdAt: '2026-04-26T10:05:00Z',
    updatedAt: '2026-04-26T10:05:02Z',
  },
]

const DEMO_SCENARIOS = [
  {
    id: 1,
    name: 'Fed rate cut Q3 2026',
    description: 'Hypothesis: equity markets rally on rate cut signal.',
    linkedSignalItemId: null,
    linkedNewsArticleId: null,
    linkedStrategyId: null,
    status: 'open',
    thesis: 'If the Fed signals a rate cut in Q3, broad equity indices should benefit.',
    expectedOutcome: 'SPY +3-5% in the month following announcement.',
    invalidationCriteria: 'Fed maintains or raises rates.',
    riskNotes: 'Market may have already priced in the cut. Inflation resurgence risk.',
    scope: 'demo',
    createdAt: '2026-04-26T10:00:00Z',
    updatedAt: '2026-04-26T10:00:00Z',
  },
]

const DEMO_CAPABILITIES = {
  ok: true,
  quantServiceAvailable: false,
  paperOnly: true,
  strategies: ['buy_and_hold', 'ema_crossover', 'rsi_mean_reversion', 'parabolic_sar_trend', 'orb_breakout'],
  indicators: ['ema', 'sma', 'rsi', 'macd', 'parabolic_sar', 'atr', 'bollinger_bands', 'support_resistance'],
  metrics: ['cagr', 'volatility', 'sharpe', 'sortino', 'max_drawdown', 'calmar', 'win_rate', 'profit_factor'],
  caveats: [
    'Paper-trading only. No real capital at risk.',
    'Backtests are simulations, not predictions.',
    'Technical strategies are experimental unless marked as benchmark.',
  ],
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export const createTradingLabRoute = ({
  db,
  quantServiceEnabled,
  quantServiceUrl,
  quantServiceTimeoutMs,
  knowledgeServiceEnabled,
  knowledgeServiceUrl,
  graphIngestEnabled,
}: {
  db: ApiDb
  quantServiceEnabled: boolean
  quantServiceUrl: string
  quantServiceTimeoutMs: number
  knowledgeServiceEnabled: boolean
  knowledgeServiceUrl: string
  graphIngestEnabled: boolean
}) => {
  const repo = createDashboardTradingLabRepository({ db })
  const signalItemsRepo = createDashboardSignalItemsRepository({ db })

  const callQuantService = async (
    path: string,
    body: unknown,
    requestId: string,
    timeoutMs?: number
  ): Promise<{ ok: boolean; data?: unknown; error?: string }> => {
    if (!quantServiceEnabled) {
      return { ok: false, error: 'Quant service is disabled' }
    }
    try {
      const controller = new AbortController()
      const timeout = setTimeout(
        () => controller.abort(),
        timeoutMs ?? quantServiceTimeoutMs
      )
      const resp = await fetch(`${quantServiceUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestId,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const data = await resp.json()
      return { ok: resp.ok, data }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Quant service unavailable',
      }
    }
  }

  return new Elysia({ prefix: '/trading-lab' })
    // --- Capabilities ---
    .get('/capabilities', async context => {
      const requestId = getRequestMeta(context).requestId
      return demoOrReal({
        context,
        demo: () => DEMO_CAPABILITIES,
        real: async () => {
          if (!quantServiceEnabled) {
            return { ...DEMO_CAPABILITIES, quantServiceAvailable: false }
          }
          const result = await callQuantService('/quant/capabilities', null, requestId)
          if (!result.ok) {
            return { ...DEMO_CAPABILITIES, quantServiceAvailable: false }
          }
          return { ok: true, quantServiceAvailable: true, paperOnly: true, ...(result.data as object) }
        },
      })
    })

    // --- Strategies ---
    .get('/strategies', async context => {
      return demoOrReal({
        context,
        demo: () => ({ ok: true, strategies: DEMO_STRATEGIES }),
        real: async () => {
          const strategies = await repo.listStrategies()
          return { ok: true, strategies }
        },
      })
    })
    .get('/strategies/:id', async context => {
      const id = Number(context.params.id)
      const requestId = getRequestMeta(context).requestId
      return demoOrReal({
        context,
        demo: () => {
          const s = DEMO_STRATEGIES.find(s => s.id === id)
          if (!s) {
            context.set.status = 404
            return { ok: false, code: 'NOT_FOUND', message: 'Strategy not found', requestId }
          }
          return { ok: true, strategy: s }
        },
        real: async () => {
          const strategy = await repo.getStrategy(id)
          if (!strategy) {
            context.set.status = 404
            return { ok: false, code: 'NOT_FOUND', message: 'Strategy not found', requestId }
          }
          return { ok: true, strategy }
        },
      })
    })
    .post(
      '/strategies',
      async context => {
        const requestId = getRequestMeta(context).requestId
        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return { ok: false, code: 'DEMO_MODE_FORBIDDEN', message: 'Admin session required', requestId }
          },
          real: async () => {
            requireAdmin(context)
            try {
              const strategy = await repo.createStrategy(context.body)
              context.set.status = 201
              return { ok: true, strategy }
            } catch (error) {
              logApiEvent({ level: 'error', msg: 'trading_lab_strategy_create_failed', requestId, ...toErrorLogFields({ error, includeStack: false }) })
              context.set.status = 400
              return { ok: false, code: 'CREATE_FAILED', message: 'Failed to create strategy', requestId }
            }
          },
        })
      },
      {
        body: t.Object({
          name: t.String(),
          slug: t.String(),
          description: t.Optional(t.String()),
          strategyType: t.Optional(t.String()),
          status: t.Optional(t.String()),
          tags: t.Optional(t.Array(t.String())),
          parameters: t.Optional(t.Record(t.String(), t.Unknown())),
          indicators: t.Optional(t.Array(t.Object({ name: t.String(), params: t.Record(t.String(), t.Unknown()) }))),
          entryRules: t.Optional(t.Array(t.Object({ id: t.String(), description: t.String(), condition: t.String() }))),
          exitRules: t.Optional(t.Array(t.Object({ id: t.String(), description: t.String(), condition: t.String() }))),
          riskRules: t.Optional(t.Array(t.Object({ id: t.String(), description: t.String(), condition: t.String() }))),
          assumptions: t.Optional(t.Array(t.String())),
          caveats: t.Optional(t.Array(t.String())),
        }),
      }
    )
    .patch(
      '/strategies/:id',
      async context => {
        const requestId = getRequestMeta(context).requestId
        const id = Number(context.params.id)
        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return { ok: false, code: 'DEMO_MODE_FORBIDDEN', message: 'Admin session required', requestId }
          },
          real: async () => {
            requireAdmin(context)
            const strategy = await repo.updateStrategy(id, context.body)
            if (!strategy) {
              context.set.status = 404
              return { ok: false, code: 'NOT_FOUND', message: 'Strategy not found', requestId }
            }
            return { ok: true, strategy }
          },
        })
      },
      {
        body: t.Object({
          name: t.Optional(t.String()),
          description: t.Optional(t.String()),
          strategyType: t.Optional(t.String()),
          status: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
          tags: t.Optional(t.Array(t.String())),
          parameters: t.Optional(t.Record(t.String(), t.Unknown())),
          assumptions: t.Optional(t.Array(t.String())),
          caveats: t.Optional(t.Array(t.String())),
        }),
      }
    )
    .delete('/strategies/:id', async context => {
      const requestId = getRequestMeta(context).requestId
      const id = Number(context.params.id)
      return demoOrReal({
        context,
        demo: () => {
          context.set.status = 403
          return { ok: false, code: 'DEMO_MODE_FORBIDDEN', message: 'Admin session required', requestId }
        },
        real: async () => {
          requireAdmin(context)
          const strategy = await repo.archiveStrategy(id)
          if (!strategy) {
            context.set.status = 404
            return { ok: false, code: 'NOT_FOUND', message: 'Strategy not found', requestId }
          }
          return { ok: true, strategy }
        },
      })
    })

    // --- Backtest runs ---
    .get('/backtests', async context => {
      const q = context.query as Record<string, string | undefined>
      return demoOrReal({
        context,
        demo: () => ({ ok: true, backtests: DEMO_BACKTESTS }),
        real: async () => {
          const opts: { strategyId?: number; limit?: number } = {}
          if (q.strategyId) opts.strategyId = Number(q.strategyId)
          if (q.limit) opts.limit = Number(q.limit)
          const backtests = await repo.listBacktestRuns(opts)
          return { ok: true, backtests }
        },
      })
    })
    .get('/backtests/:id', async context => {
      const id = Number(context.params.id)
      const requestId = getRequestMeta(context).requestId
      return demoOrReal({
        context,
        demo: () => {
          const b = DEMO_BACKTESTS.find(b => b.id === id)
          if (!b) {
            context.set.status = 404
            return { ok: false, code: 'NOT_FOUND', message: 'Backtest run not found', requestId }
          }
          return { ok: true, backtest: b }
        },
        real: async () => {
          const backtest = await repo.getBacktestRun(id)
          if (!backtest) {
            context.set.status = 404
            return { ok: false, code: 'NOT_FOUND', message: 'Backtest run not found', requestId }
          }
          return { ok: true, backtest }
        },
      })
    })
    .post(
      '/backtests/run',
      async context => {
        const requestId = getRequestMeta(context).requestId
        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return { ok: false, code: 'DEMO_MODE_FORBIDDEN', message: 'Admin session required', requestId }
          },
          real: async () => {
            requireAdmin(context)
            const {
              strategyId,
              symbol,
              timeframe,
              startDate,
              endDate,
              initialCash,
              feesBps,
              slippageBps,
              spreadBps,
              data,
              useDemoData,
            } = context.body

            // Resolve OHLCV: use provided data, else fall back to deterministic fixture
            const startDateObj = new Date(startDate)
            const endDateObj = new Date(endDate)
            const providedRows = Array.isArray(data) ? data.length : 0
            const ohlcv =
              providedRows > 0
                ? (data as Array<Record<string, unknown>>)
                : useDemoData === false
                ? null
                : generateDeterministicOhlcv({
                    symbol,
                    startDate: startDateObj,
                    endDate: endDateObj,
                  })

            const dataSource =
              providedRows > 0 ? 'caller_provided' : useDemoData === false ? 'unavailable' : 'deterministic_fixture'

            // Create run record — omit undefined keys for exactOptionalPropertyTypes
            const runInput: Parameters<typeof repo.createBacktestRun>[0] = {
              strategyId,
              name: `${symbol} ${startDate.slice(0, 10)} to ${endDate.slice(0, 10)}`,
              symbol,
              startDate: startDateObj,
              endDate: endDateObj,
              marketDataSource: dataSource,
            }
            if (timeframe !== undefined) runInput.timeframe = timeframe
            if (initialCash !== undefined) runInput.initialCash = initialCash
            if (feesBps !== undefined) runInput.feesBps = feesBps
            if (slippageBps !== undefined) runInput.slippageBps = slippageBps
            if (spreadBps !== undefined) runInput.spreadBps = spreadBps

            const run = await repo.createBacktestRun(runInput)

            // Reject if data is unavailable and demo data was opted out
            if (!ohlcv || ohlcv.length < 5) {
              await repo.updateBacktestRunResult(run.id, {
                runStatus: 'failed',
                runStartedAt: new Date(),
                runFinishedAt: new Date(),
                durationMs: 0,
                errorSummary: 'OHLCV data unavailable',
              })
              context.set.status = 422
              return {
                ok: false,
                code: 'DATA_UNAVAILABLE',
                message: 'No OHLCV data was provided and useDemoData was false.',
                runId: run.id,
                requestId,
              }
            }

            // Get strategy
            const strategy = await repo.getStrategy(strategyId)
            if (!strategy) {
              context.set.status = 404
              return { ok: false, code: 'STRATEGY_NOT_FOUND', message: 'Strategy not found', requestId }
            }

            // Call quant service
            const startedAt = new Date()
            const strategyParams = (strategy.parameters ?? {}) as Record<string, unknown>
            const strategyTypeForQuant =
              (strategyParams.strategy_type as string | undefined) ??
              (typeof strategy.slug === 'string' && strategy.slug.includes('buy-and-hold')
                ? 'buy_and_hold'
                : 'buy_and_hold')
            const quantResult = await callQuantService(
              '/quant/backtest',
              {
                strategy_type: strategyTypeForQuant,
                data: ohlcv,
                initial_cash: initialCash,
                fees_bps: feesBps,
                slippage_bps: slippageBps,
                spread_bps: spreadBps,
                params: strategyParams,
              },
              requestId,
              60_000
            )

            if (!quantResult.ok) {
              await repo.updateBacktestRunResult(run.id, {
                runStatus: 'failed',
                runStartedAt: startedAt,
                runFinishedAt: new Date(),
                durationMs: Date.now() - startedAt.getTime(),
                errorSummary: quantResult.error ?? 'Quant service error',
              })
              // Surface as attention item (fail-soft, do not break response)
              try {
                await repo.upsertAttentionItem({
                  sourceType: 'trading-lab',
                  sourceId: `backtest:${run.id}`,
                  severity: 'important',
                  title: `Backtest failed: ${strategy.name}`,
                  summary: quantResult.error ?? 'Quant service error',
                  reason: 'Backtest run failed',
                  actionHref: '/ia/trading-lab',
                  dedupeKey: `trading-lab:backtest:${run.id}`,
                  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                })
              } catch {
                /* fail-soft */
              }

              context.set.status = 502
              return {
                ok: false,
                code: 'BACKTEST_FAILED',
                message: quantResult.error ?? 'Backtest failed',
                runId: run.id,
                requestId,
              }
            }

            const qd = quantResult.data as Record<string, unknown>
            const metrics = qd.metrics as Record<string, unknown> | null
            const caveats = (qd.caveats as string[] | undefined) ?? []
            await repo.updateBacktestRunResult(run.id, {
              runStatus: 'completed',
              runStartedAt: startedAt,
              runFinishedAt: new Date(),
              durationMs: Date.now() - startedAt.getTime(),
              paramsHash: qd.params_hash as string,
              dataHash: qd.data_hash as string,
              resultSummary: { strategy_type: qd.strategy_type, dataSource, dataPoints: ohlcv.length },
              metrics: metrics ?? {},
              equityCurve: qd.equity_curve as Array<{ date: string; equity: number }>,
              trades: qd.trades as Array<Record<string, unknown>>,
              drawdowns: qd.drawdowns as Array<{ date: string; drawdown: number }>,
            })

            // Auto-trigger graph ingest (fail-soft)
            const graphResult = await sendBacktestToKnowledgeGraph({
              knowledgeServiceUrl,
              knowledgeServiceEnabled,
              ingestEnabled: graphIngestEnabled,
              requestId,
              input: {
                strategy: {
                  id: strategy.id,
                  name: strategy.name,
                  slug: strategy.slug,
                  strategyType: strategy.strategyType,
                  status: strategy.status,
                  description: strategy.description ?? null,
                  tags: strategy.tags as string[],
                  assumptions: (strategy.assumptions as string[]) ?? [],
                  caveats: (strategy.caveats as string[]) ?? [],
                  indicators: (strategy.indicators as Array<{ name: string; params: Record<string, unknown> }>) ?? [],
                },
                backtest: {
                  id: run.id,
                  symbol,
                  startDate: startDateObj,
                  endDate: endDateObj,
                  initialCash: initialCash ?? 10000,
                  feesBps: feesBps ?? 10,
                  slippageBps: slippageBps ?? 5,
                  metrics,
                  paramsHash: (qd.params_hash as string) ?? null,
                  dataHash: (qd.data_hash as string) ?? null,
                  runStatus: 'completed',
                },
                caveats,
              },
            })
            if (!graphResult.ok) {
              logApiEvent({
                level: 'info',
                msg: 'trading_lab_graph_ingest_skipped',
                requestId,
                reason: graphResult.reason ?? 'unknown',
                runId: run.id,
              })
            }

            return {
              ok: true,
              runId: run.id,
              metrics,
              caveats,
              dataSource,
              dataPoints: ohlcv.length,
              graphIngest: { ok: graphResult.ok, reason: graphResult.reason ?? null },
              requestId,
            }
          },
        })
      },
      {
        body: t.Object({
          strategyId: t.Number(),
          symbol: t.String(),
          timeframe: t.Optional(t.String()),
          startDate: t.String(),
          endDate: t.String(),
          initialCash: t.Optional(t.Number()),
          feesBps: t.Optional(t.Number()),
          slippageBps: t.Optional(t.Number()),
          spreadBps: t.Optional(t.Number()),
          data: t.Optional(t.Array(t.Record(t.String(), t.Unknown()))),
          useDemoData: t.Optional(t.Boolean()),
        }),
      }
    )

    // --- Scenarios ---
    .get('/scenarios', async context => {
      return demoOrReal({
        context,
        demo: () => ({ ok: true, scenarios: DEMO_SCENARIOS }),
        real: async () => {
          const scenarios = await repo.listScenarios()
          return { ok: true, scenarios }
        },
      })
    })
    .post(
      '/scenarios',
      async context => {
        const requestId = getRequestMeta(context).requestId
        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return { ok: false, code: 'DEMO_MODE_FORBIDDEN', message: 'Admin session required', requestId }
          },
          real: async () => {
            requireAdmin(context)
            const scenario = await repo.createScenario(context.body)
            context.set.status = 201
            return { ok: true, scenario }
          },
        })
      },
      {
        body: t.Object({
          name: t.String(),
          description: t.Optional(t.String()),
          linkedSignalItemId: t.Optional(t.Number()),
          linkedNewsArticleId: t.Optional(t.Number()),
          linkedStrategyId: t.Optional(t.Number()),
          thesis: t.Optional(t.String()),
          expectedOutcome: t.Optional(t.String()),
          invalidationCriteria: t.Optional(t.String()),
          riskNotes: t.Optional(t.String()),
        }),
      }
    )
    .patch(
      '/scenarios/:id',
      async context => {
        const requestId = getRequestMeta(context).requestId
        const id = Number(context.params.id)
        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return { ok: false, code: 'DEMO_MODE_FORBIDDEN', message: 'Admin session required', requestId }
          },
          real: async () => {
            requireAdmin(context)
            const scenario = await repo.updateScenario(id, context.body)
            if (!scenario) {
              context.set.status = 404
              return { ok: false, code: 'NOT_FOUND', message: 'Scenario not found', requestId }
            }
            return { ok: true, scenario }
          },
        })
      },
      {
        body: t.Object({
          name: t.Optional(t.String()),
          description: t.Optional(t.String()),
          status: t.Optional(t.String()),
          thesis: t.Optional(t.String()),
          expectedOutcome: t.Optional(t.String()),
          invalidationCriteria: t.Optional(t.String()),
          riskNotes: t.Optional(t.String()),
        }),
      }
    )

    // --- Attention ---
    .get('/attention', async context => {
      const q = context.query as Record<string, string | undefined>
      return demoOrReal({
        context,
        demo: () => ({
          ok: true,
          items: [
            {
              id: 1,
              sourceType: 'signal',
              sourceId: 'demo-signal-1',
              severity: 'important',
              status: 'open',
              title: 'Fed rate decision signal detected',
              summary: 'Multiple sources report potential Fed policy shift.',
              reason: 'High-impact macro signal from multiple providers',
              actionHref: '/signaux',
              dedupeKey: 'demo-attention-1',
              scope: 'demo',
              createdAt: '2026-04-26T08:00:00Z',
              updatedAt: '2026-04-26T08:00:00Z',
              expiresAt: null,
              acknowledgedAt: null,
              resolvedAt: null,
            },
          ],
          openCount: 1,
        }),
        real: async () => {
          const opts: { status?: string; sourceType?: string; severity?: string } = {}
          if (q.status) opts.status = q.status
          if (q.sourceType) opts.sourceType = q.sourceType
          if (q.severity) opts.severity = q.severity
          const [items, openCount] = await Promise.all([
            repo.listAttentionItems(opts),
            repo.countOpenAttentionItems(),
          ])
          return { ok: true, items, openCount }
        },
      })
    })
    .patch('/attention/:id', async context => {
      const requestId = getRequestMeta(context).requestId
      const id = Number(context.params.id)
      const { status } = context.body as { status: string }
      return demoOrReal({
        context,
        demo: () => {
          context.set.status = 403
          return { ok: false, code: 'DEMO_MODE_FORBIDDEN', message: 'Admin session required', requestId }
        },
        real: async () => {
          requireAdmin(context)
          const validStatuses = ['open', 'acknowledged', 'dismissed', 'resolved'] as const
          const typedStatus = validStatuses.includes(status as typeof validStatuses[number])
            ? (status as typeof validStatuses[number])
            : 'open'
          const item = await repo.updateAttentionItemStatus(id, typedStatus)
          if (!item) {
            context.set.status = 404
            return { ok: false, code: 'NOT_FOUND', message: 'Attention item not found', requestId }
          }
          return { ok: true, item }
        },
      })
    })

    // --- Attention rebuild (auto-generate from signals/providers/runs) ---
    .post('/attention/rebuild', async context => {
      const requestId = getRequestMeta(context).requestId
      return demoOrReal({
        context,
        demo: () => ({ ok: true, generated: 0, fromSignals: 0, fromProviders: 0, fromIngestionRuns: 0, fromBacktests: 0, requestId }),
        real: async () => {
          requireAdmin(context)
          try {
            const { runAttentionAutoGenerator } = await import(
              '../services/attention-auto-generator'
            )
            const result = await runAttentionAutoGenerator({ db })
            return { ...result, requestId }
          } catch (error) {
            logApiEvent({
              level: 'error',
              msg: 'attention_rebuild_failed',
              requestId,
              ...toErrorLogFields({ error, includeStack: false }),
            })
            context.set.status = 500
            return {
              ok: false,
              code: 'ATTENTION_REBUILD_FAILED',
              message: 'Failed to rebuild attention items',
              requestId,
            }
          }
        },
      })
    })

    // --- Create scenario from signal (prefill thesis) ---
    .post(
      '/scenarios/from-signal',
      async context => {
        const requestId = getRequestMeta(context).requestId
        const { signalItemId, linkedStrategyId } = context.body
        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return { ok: false, code: 'DEMO_MODE_FORBIDDEN', message: 'Admin session required', requestId }
          },
          real: async () => {
            requireAdmin(context)
            const signal = await signalItemsRepo.getItemById(signalItemId)
            if (!signal) {
              context.set.status = 404
              return { ok: false, code: 'SIGNAL_NOT_FOUND', message: 'Signal item not found', requestId }
            }

            const tickerHint =
              signal.tickers && signal.tickers.length > 0 ? ` (tickers: ${signal.tickers.slice(0, 3).join(', ')})` : ''
            const thesis =
              `Hypothesis derived from signal "${signal.title}"${tickerHint}.\n` +
              `Reason: ${signal.attentionReason ?? 'flagged signal'}.\n` +
              `Domain: ${signal.signalDomain}. Source: ${signal.sourceProvider}.\n\n` +
              `Note: signals alone are weak evidence — corroborate with deterministic data and challenger before acting.`
            const invalidation =
              'Define explicit price/event/time invalidation criteria before tracking this scenario.'

            const scenarioInput: Parameters<typeof repo.createScenario>[0] = {
              name: signal.title.slice(0, 120),
              description: `Scenario auto-generated from signal #${signal.id}`,
              linkedSignalItemId: signal.id,
              thesis,
              invalidationCriteria: invalidation,
              riskNotes:
                'Paper-trading only. Backtests are not predictions. Technical strategies are experimental.',
            }
            if (linkedStrategyId !== undefined) scenarioInput.linkedStrategyId = linkedStrategyId

            const scenario = await repo.createScenario(scenarioInput)
            context.set.status = 201
            return { ok: true, scenario, requestId }
          },
        })
      },
      {
        body: t.Object({
          signalItemId: t.Number(),
          linkedStrategyId: t.Optional(t.Number()),
        }),
      }
    )

    // --- Unified signals feed ---
    .get('/signals/feed', async context => {
      const q = context.query as Record<string, string | undefined>
      return demoOrReal({
        context,
        demo: () => ({
          ok: true,
          items: [],
          total: 0,
          caveats: ['Demo mode: no live signal data'],
        }),
        real: async () => {
          // Delegate to existing signal items repository for now
          // Unified feed combines news_article + signal_item
          const { createDashboardSignalItemsRepository } = await import(
            '../repositories/dashboard-signal-items-repository'
          )
          const itemsRepo = createDashboardSignalItemsRepository({ db })
          const limit = Number(q.limit) || 50
          const offset = Number(q.offset) || 0
          const opts: Parameters<typeof itemsRepo.listItems>[0] = { limit, offset }
          if (q.signalDomain) opts.signalDomain = q.signalDomain
          if (q.sourceProvider) opts.sourceProvider = q.sourceProvider
          if (q.requiresAttention === 'true') opts.requiresAttention = true

          const items = await itemsRepo.listItems(opts)
          const total = await itemsRepo.countItems()
          return {
            ok: true,
            items: items.map(item => ({
              ...item,
              sourceType: item.sourceType ?? 'social',
              sourceProvider: item.sourceProvider,
            })),
            total,
          }
        },
      })
    })
}
