import { apiFetch } from '@/lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TradingLabStrategy {
  id: number
  name: string
  slug: string
  description: string | null
  strategyType: string
  status: string
  enabled: boolean
  tags: string[]
  parameters: Record<string, unknown>
  indicators: Array<{ name: string; params: Record<string, unknown> }>
  entryRules: Array<{ id: string; description: string; condition: string }>
  exitRules: Array<{ id: string; description: string; condition: string }>
  riskRules: Array<{ id: string; description: string; condition: string }>
  assumptions: string[]
  caveats: string[]
  scope: string
  createdAt: string
  updatedAt: string
}

export interface TradingLabBacktestRun {
  id: number
  strategyId: number
  name: string
  marketDataSource: string
  symbol: string
  timeframe: string
  startDate: string
  endDate: string
  initialCash: number
  feesBps: number
  slippageBps: number
  spreadBps: number
  runStatus: string
  runStartedAt: string | null
  runFinishedAt: string | null
  durationMs: number | null
  paramsHash: string | null
  dataHash: string | null
  resultSummary: Record<string, unknown> | null
  metrics: Record<string, unknown> | null
  equityCurve: Array<{ date: string; equity: number }> | null
  trades: Array<Record<string, unknown>> | null
  drawdowns: Array<{ date: string; drawdown: number }> | null
  errorSummary: string | null
  scope: string
  createdAt: string
  updatedAt: string
}

export interface TradingLabScenario {
  id: number
  name: string
  description: string | null
  linkedSignalItemId: number | null
  linkedNewsArticleId: number | null
  linkedStrategyId: number | null
  status: string
  thesis: string | null
  expectedOutcome: string | null
  invalidationCriteria: string | null
  riskNotes: string | null
  scope: string
  createdAt: string
  updatedAt: string
}

export interface AttentionItem {
  id: number
  sourceType: string
  sourceId: string | null
  severity: string
  status: string
  title: string
  summary: string | null
  reason: string | null
  actionHref: string | null
  dedupeKey: string
  scope: string
  createdAt: string
  updatedAt: string
  expiresAt: string | null
  acknowledgedAt: string | null
  resolvedAt: string | null
}

export interface TradingLabCapabilities {
  ok: boolean
  quantServiceAvailable: boolean
  paperOnly: boolean
  strategies: string[]
  indicators: string[]
  metrics: string[]
  caveats: string[]
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const fetchTradingLabCapabilities = () =>
  apiFetch<TradingLabCapabilities>('/dashboard/trading-lab/capabilities')

export const fetchTradingLabStrategies = () =>
  apiFetch<{ ok: boolean; strategies: TradingLabStrategy[] }>('/dashboard/trading-lab/strategies')

export const fetchTradingLabStrategy = (id: number) =>
  apiFetch<{ ok: boolean; strategy: TradingLabStrategy }>(`/dashboard/trading-lab/strategies/${id}`)

export const fetchTradingLabBacktests = (opts?: { strategyId?: number; limit?: number }) => {
  const params = new URLSearchParams()
  if (opts?.strategyId) params.set('strategyId', String(opts.strategyId))
  if (opts?.limit) params.set('limit', String(opts.limit))
  const qs = params.toString()
  return apiFetch<{ ok: boolean; backtests: TradingLabBacktestRun[] }>(
    `/dashboard/trading-lab/backtests${qs ? `?${qs}` : ''}`
  )
}

export const fetchTradingLabBacktest = (id: number) =>
  apiFetch<{ ok: boolean; backtest: TradingLabBacktestRun }>(`/dashboard/trading-lab/backtests/${id}`)

export const fetchTradingLabScenarios = () =>
  apiFetch<{ ok: boolean; scenarios: TradingLabScenario[] }>('/dashboard/trading-lab/scenarios')

export const fetchAttentionItems = (opts?: { status?: string }) => {
  const params = new URLSearchParams()
  if (opts?.status) params.set('status', opts.status)
  const qs = params.toString()
  return apiFetch<{ ok: boolean; items: AttentionItem[]; openCount: number }>(
    `/dashboard/trading-lab/attention${qs ? `?${qs}` : ''}`
  )
}
