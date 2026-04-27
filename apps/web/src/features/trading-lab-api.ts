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

// ---------------------------------------------------------------------------
// Mutations (admin-only — UI guards by mode)
// ---------------------------------------------------------------------------

export type DataSourcePreference =
  | 'auto'
  | 'cached'
  | 'provider'
  | 'caller_provided'
  | 'deterministic_fixture'

export type PreferredProvider = 'auto' | 'eodhd' | 'twelvedata'

export interface BacktestRunRequest {
  strategyId: number
  symbol: string
  exchange?: string
  timeframe?: string
  startDate: string
  endDate: string
  initialCash?: number
  feesBps?: number
  slippageBps?: number
  spreadBps?: number
  data?: Array<Record<string, unknown>>
  dataSourcePreference?: DataSourcePreference
  preferredProvider?: PreferredProvider
  useDemoData?: boolean
}

export interface BacktestRunResponse {
  ok: boolean
  runId?: number
  metrics?: Record<string, unknown> | null
  caveats?: string[]
  resolvedMarketDataSource?: string
  dataProvider?: string
  dataQuality?: string
  dataWarnings?: string[]
  fallbackUsed?: boolean
  fallbackReason?: string | null
  barsCount?: number
  firstBarDate?: string | null
  lastBarDate?: string | null
  graphIngest?: { ok: boolean; reason: string | null }
  code?: string
  message?: string
}

export const runTradingLabBacktest = (body: BacktestRunRequest) =>
  apiFetch<BacktestRunResponse>('/dashboard/trading-lab/backtests/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

export interface WalkForwardRequest {
  strategyId: number
  symbol: string
  exchange?: string
  timeframe?: string
  startDate: string
  endDate: string
  initialCash?: number
  feesBps?: number
  slippageBps?: number
  spreadBps?: number
  data?: Array<Record<string, unknown>>
  dataSourcePreference?: DataSourcePreference
  preferredProvider?: PreferredProvider
  trainBars?: number
  testBars?: number
  stepBars?: number
}

export interface WalkForwardWindow {
  index: number
  train_start: string
  train_end: string
  test_start: string
  test_end: string
  train_return: number | null
  test_return: number | null
  train_sharpe: number | null
  test_sharpe: number | null
  train_max_drawdown: number | null
  test_max_drawdown: number | null
  test_total_trades: number
}

export interface WalkForwardResponse {
  ok: boolean
  windows?: WalkForwardWindow[]
  inSample?: Record<string, unknown>
  outOfSample?: Record<string, unknown>
  stabilityScore?: number | null
  degradationRatio?: number | null
  overfitWarning?: string | null
  summary?: string
  resolvedMarketDataSource?: string
  dataProvider?: string
  fallbackUsed?: boolean
  caveats?: string[]
  code?: string
  message?: string
}

export const runTradingLabWalkForward = (body: WalkForwardRequest) =>
  apiFetch<WalkForwardResponse>('/dashboard/trading-lab/backtests/walk-forward', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

export interface MarketDataPreviewRequest {
  symbol: string
  exchange?: string
  timeframe?: string
  startDate: string
  endDate: string
  dataSourcePreference?: DataSourcePreference
  preferredProvider?: PreferredProvider
  data?: Array<Record<string, unknown>>
}

export interface MarketDataPreviewResponse {
  ok: boolean
  resolvedMarketDataSource?: string
  dataProvider?: string
  dataQuality?: string
  dataWarnings?: string[]
  barsCount?: number
  firstBarDate?: string | null
  lastBarDate?: string | null
  fallbackUsed?: boolean
  fallbackReason?: string | null
  sample?: Array<{
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
  }>
  code?: string
  message?: string
}

export const previewTradingLabMarketData = (body: MarketDataPreviewRequest) =>
  apiFetch<MarketDataPreviewResponse>('/dashboard/trading-lab/market-data/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

export interface CreateScenarioFromSignalRequest {
  signalItemId: number
  linkedStrategyId?: number
}

export const createScenarioFromSignal = (body: CreateScenarioFromSignalRequest) =>
  apiFetch<{ ok: boolean; scenario: TradingLabScenario }>(
    '/dashboard/trading-lab/scenarios/from-signal',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

export interface CreateStrategyRequest {
  name: string
  slug: string
  description?: string
  strategyType?: string
  status?: string
  tags?: string[]
  parameters?: Record<string, unknown>
  indicators?: Array<{ name: string; params: Record<string, unknown> }>
  entryRules?: Array<{ id: string; description: string; condition: string }>
  exitRules?: Array<{ id: string; description: string; condition: string }>
  riskRules?: Array<{ id: string; description: string; condition: string }>
  assumptions?: string[]
  caveats?: string[]
}

export const createTradingLabStrategy = (body: CreateStrategyRequest) =>
  apiFetch<{ ok: boolean; strategy: TradingLabStrategy }>(
    '/dashboard/trading-lab/strategies',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

export const updateTradingLabStrategy = (
  id: number,
  body: Partial<CreateStrategyRequest> & { enabled?: boolean }
) =>
  apiFetch<{ ok: boolean; strategy: TradingLabStrategy }>(
    `/dashboard/trading-lab/strategies/${id}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

export const archiveTradingLabStrategy = (id: number) =>
  apiFetch<{ ok: boolean; strategy: TradingLabStrategy }>(
    `/dashboard/trading-lab/strategies/${id}`,
    { method: 'DELETE' }
  )

export const triggerAttentionRebuildApi = () =>
  apiFetch<{ ok: boolean; generated: number }>(
    '/dashboard/trading-lab/attention/rebuild',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }
  )
