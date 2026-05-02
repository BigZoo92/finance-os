import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  runTradingLabBacktest,
  runTradingLabWalkForward,
  previewTradingLabMarketData,
  type BacktestRunRequest,
  type BacktestRunResponse,
  type DataSourcePreference,
  type PreferredProvider,
  type TradingLabStrategy,
  type WalkForwardResponse,
  type MarketDataPreviewResponse,
} from '@/features/trading-lab-api'
import { Panel } from '@/components/surfaces/panel'
import { StrategyPicker } from './strategy-picker'
import { MarketDataSourcePicker } from './market-data-source-picker'
import { DataSourceBadge } from './data-source-badge'

type Props = {
  strategies: TradingLabStrategy[]
  isAdmin: boolean
  isDemo: boolean
  defaultSymbol?: string
  defaultStrategyId?: number | null
  initialOpen?: boolean
}

const todayIso = () => new Date().toISOString().slice(0, 10)
const monthsAgoIso = (months: number) => {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}

const formatPct = (value: unknown, digits = 1) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(digits)}%`
}
const formatNum = (value: unknown, digits = 2) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

export function BacktestRunner({
  strategies,
  isAdmin,
  isDemo,
  defaultSymbol = 'SPY.US',
  defaultStrategyId,
  initialOpen = false,
}: Props) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(initialOpen)
  const [strategyId, setStrategyId] = useState<number | null>(
    defaultStrategyId ?? strategies[0]?.id ?? null
  )
  const [symbol, setSymbol] = useState(defaultSymbol)
  const [timeframe, setTimeframe] = useState('1d')
  const [startDate, setStartDate] = useState(monthsAgoIso(12))
  const [endDate, setEndDate] = useState(todayIso())
  const [initialCash, setInitialCash] = useState(10_000)
  const [feesBps, setFeesBps] = useState(10)
  const [slippageBps, setSlippageBps] = useState(5)
  const [spreadBps, setSpreadBps] = useState(2)
  const [dataSource, setDataSource] = useState<DataSourcePreference>('auto')
  const [provider, setProvider] = useState<PreferredProvider>('auto')

  const adminBlocked = !isAdmin
  const formDisabled = adminBlocked

  const buildBacktestBody = (): BacktestRunRequest => {
    if (strategyId === null) {
      throw new Error('Strategy required')
    }
    return {
      strategyId,
      symbol: symbol.trim(),
      timeframe,
      startDate,
      endDate,
      initialCash,
      feesBps,
      slippageBps,
      spreadBps,
      dataSourcePreference: dataSource,
      preferredProvider: provider,
    }
  }

  const previewMutation = useMutation({
    mutationFn: () =>
      previewTradingLabMarketData({
        symbol: symbol.trim(),
        timeframe,
        startDate,
        endDate,
        dataSourcePreference: dataSource,
        preferredProvider: provider,
      }),
  })

  const runMutation = useMutation({
    mutationFn: () => runTradingLabBacktest(buildBacktestBody()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tradingLab', 'backtests'] })
      void queryClient.invalidateQueries({ queryKey: ['attention'] })
    },
  })

  const walkForwardMutation = useMutation({
    mutationFn: () =>
      runTradingLabWalkForward({
        ...(buildBacktestBody() as Omit<BacktestRunRequest, 'useDemoData'>),
        trainBars: 120,
        testBars: 30,
        stepBars: 30,
      }),
  })

  return (
    <Panel
      title="Lancer un backtest"
      description={
        adminBlocked
          ? 'Lecture seule en mode démo. Les exécutions sont réservées au mode admin.'
          : 'Recherche papier uniquement. Backtests ≠ prédictions. Les stratégies techniques restent expérimentales.'
      }
      tone="violet"
      actions={
        <button
          type="button"
          className="rounded-md border border-border bg-surface-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(state => !state)}
        >
          {open ? 'Masquer' : 'Afficher'}
        </button>
      }
    >
      {!open ? (
        <div className="text-xs text-muted-foreground">
          Configurer une stratégie et un univers pour lancer un backtest papier.
        </div>
      ) : (
        <div className="space-y-3">
          {isDemo ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Mode démo — les boutons sont visibles mais désactivés. Connecte-toi en admin pour exécuter.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StrategyPicker
              strategies={strategies}
              value={strategyId}
              onChange={setStrategyId}
              disabled={formDisabled}
            />
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Symbole</span>
              <input
                type="text"
                value={symbol}
                onChange={event => setSymbol(event.target.value)}
                placeholder="SPY.US, AAPL, EURUSD…"
                disabled={formDisabled}
                className="rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Intervalle</span>
              <select
                className="rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
                value={timeframe}
                disabled={formDisabled}
                onChange={event => setTimeframe(event.target.value)}
              >
                <option value="1d">1 jour</option>
                <option value="1w">1 semaine</option>
                <option value="1mo">1 mois</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Début</span>
              <input
                type="date"
                value={startDate}
                onChange={event => setStartDate(event.target.value)}
                disabled={formDisabled}
                className="rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Fin</span>
              <input
                type="date"
                value={endDate}
                onChange={event => setEndDate(event.target.value)}
                disabled={formDisabled}
                className="rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Capital initial</span>
              <input
                type="number"
                min={100}
                step={100}
                value={initialCash}
                onChange={event => setInitialCash(Number(event.target.value) || 0)}
                disabled={formDisabled}
                className="rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Frais (bps)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={feesBps}
                onChange={event => setFeesBps(Number(event.target.value) || 0)}
                disabled={formDisabled}
                className="rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Slippage (bps)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={slippageBps}
                onChange={event => setSlippageBps(Number(event.target.value) || 0)}
                disabled={formDisabled}
                className="rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Spread (bps)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={spreadBps}
                onChange={event => setSpreadBps(Number(event.target.value) || 0)}
                disabled={formDisabled}
                className="rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
              />
            </label>
          </div>

          <MarketDataSourcePicker
            source={dataSource}
            onSourceChange={setDataSource}
            provider={provider}
            onProviderChange={setProvider}
            disabled={formDisabled}
          />

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={formDisabled || strategyId === null || previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
              className="rounded-md border border-border bg-surface-1 px-3 py-1.5 text-xs text-foreground hover:bg-surface-2 disabled:opacity-50"
            >
              {previewMutation.isPending ? 'Prévisualisation…' : 'Prévisualiser les données'}
            </button>
            <button
              type="button"
              disabled={formDisabled || strategyId === null || runMutation.isPending}
              onClick={() => runMutation.mutate()}
              className="rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 disabled:opacity-50"
            >
              {runMutation.isPending ? 'Backtest en cours…' : 'Lancer le backtest'}
            </button>
            <button
              type="button"
              disabled={formDisabled || strategyId === null || walkForwardMutation.isPending}
              onClick={() => walkForwardMutation.mutate()}
              className="rounded-md border border-accent-2/40 bg-accent-2/15 px-3 py-1.5 text-xs font-medium text-accent-2 hover:bg-accent-2/25 disabled:opacity-50"
            >
              {walkForwardMutation.isPending ? 'Walk-forward…' : 'Walk-forward'}
            </button>
            <span className="ml-auto text-[10px] text-muted-foreground/70">
              Aucun ordre n'est passé. Aucune connexion broker.
            </span>
          </div>

          <PreviewResultPanel data={previewMutation.data} error={previewMutation.error} />
          <BacktestResultPanel data={runMutation.data} error={runMutation.error} />
          <WalkForwardResultPanel data={walkForwardMutation.data} error={walkForwardMutation.error} />
        </div>
      )}
    </Panel>
  )
}

function PreviewResultPanel({
  data,
  error,
}: {
  data: MarketDataPreviewResponse | undefined
  error: unknown
}) {
  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
        Échec de la prévisualisation : {(error as Error).message}
      </div>
    )
  }
  if (!data || !data.ok) {
    if (data?.message) {
      return (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
          {data.message}
        </div>
      )
    }
    return null
  }
  return (
    <div className="rounded-md border border-border bg-surface-0 p-2 text-xs">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <DataSourceBadge
          resolvedMarketDataSource={data.resolvedMarketDataSource}
          dataProvider={data.dataProvider}
          dataQuality={data.dataQuality}
          fallbackUsed={data.fallbackUsed}
        />
        <span className="text-muted-foreground">
          {data.barsCount ?? 0} bougies · {data.firstBarDate ?? '—'} → {data.lastBarDate ?? '—'}
        </span>
      </div>
      {data.dataWarnings && data.dataWarnings.length > 0 ? (
        <ul className="space-y-0.5 text-amber-300/70">
          {data.dataWarnings.map(warning => (
            <li key={warning}>· {warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function BacktestResultPanel({
  data,
  error,
}: {
  data: BacktestRunResponse | undefined
  error: unknown
}) {
  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
        Échec du backtest : {(error as Error).message}
      </div>
    )
  }
  if (!data) return null
  if (!data.ok) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
        {data.message ?? 'Backtest impossible.'}
      </div>
    )
  }
  const m = (data.metrics ?? {}) as Record<string, unknown>
  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-medium text-emerald-300">Backtest #{data.runId} terminé.</span>
        <DataSourceBadge
          resolvedMarketDataSource={data.resolvedMarketDataSource}
          dataProvider={data.dataProvider}
          dataQuality={data.dataQuality}
          fallbackUsed={data.fallbackUsed}
        />
        <span className="text-muted-foreground">
          {data.barsCount ?? 0} bougies · {data.firstBarDate ?? '—'} → {data.lastBarDate ?? '—'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="CAGR" value={formatPct(m.cagr)} />
        <Metric label="Sharpe" value={formatNum(m.sharpe)} />
        <Metric label="Max DD" value={formatPct(m.max_drawdown)} />
        <Metric label="Win rate" value={formatPct(m.win_rate, 0)} />
      </div>
      {data.fallbackUsed ? (
        <div className="mt-2 text-amber-300/80">
          ⚠ Fallback utilisé ({data.fallbackReason ?? 'inconnu'}). Les chiffres ne reflètent pas un marché réel.
        </div>
      ) : null}
      {data.dataWarnings && data.dataWarnings.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {data.dataWarnings.map(warning => (
            <li key={warning}>· {warning}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 text-[10px] text-amber-400/70">
        Backtest = simulation, pas une prédiction. Stratégies techniques expérimentales.
      </div>
    </div>
  )
}

function WalkForwardResultPanel({
  data,
  error,
}: {
  data: WalkForwardResponse | undefined
  error: unknown
}) {
  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
        Échec du walk-forward : {(error as Error).message}
      </div>
    )
  }
  if (!data) return null
  if (!data.ok) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
        {data.message ?? 'Walk-forward impossible.'}
      </div>
    )
  }
  const windows = data.windows ?? []
  const tone =
    data.overfitWarning === 'STRONG_DEGRADATION' ||
    data.overfitWarning === 'OOS_LOSES_MONEY_WHEN_IS_PROFITABLE'
      ? 'overfit'
      : data.overfitWarning === 'HIGH_OOS_VARIANCE'
        ? 'fragile'
        : data.overfitWarning === 'INSUFFICIENT_DATA'
          ? 'insufficient'
          : 'stable'
  const TONE_BADGE: Record<typeof tone, string> = {
    stable: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    fragile: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    overfit: 'bg-red-500/15 text-red-300 border-red-500/30',
    insufficient: 'bg-surface-2 text-muted-foreground border-border',
  }
  const TONE_LABEL: Record<typeof tone, string> = {
    stable: 'Stable',
    fragile: 'Fragile',
    overfit: 'Risque overfit',
    insufficient: 'Données insuffisantes',
  }

  return (
    <div className="rounded-md border border-accent-2/30 bg-accent-2/5 p-2 text-xs">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-medium text-accent-2">Walk-forward</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${TONE_BADGE[tone]}`}>
          {TONE_LABEL[tone]}
        </span>
        <DataSourceBadge
          resolvedMarketDataSource={data.resolvedMarketDataSource}
          dataProvider={data.dataProvider}
          dataQuality="real"
          fallbackUsed={data.fallbackUsed}
        />
      </div>
      <p className="mb-2 text-muted-foreground">{data.summary}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label="Stabilité OOS"
          value={data.stabilityScore != null ? formatNum(data.stabilityScore) : '—'}
        />
        <Metric
          label="Dégradation"
          value={
            data.degradationRatio != null
              ? `${(data.degradationRatio * 100).toFixed(0)}%`
              : '—'
          }
        />
        <Metric label="Fenêtres" value={String(windows.length)} />
        <Metric label="Warning" value={data.overfitWarning ?? '—'} />
      </div>
      {windows.length > 0 ? (
        <div className="mt-2 max-h-40 overflow-auto rounded border border-border/60 bg-surface-1">
          <table className="w-full text-[10px]">
            <thead className="text-muted-foreground/70">
              <tr className="border-b border-border/40">
                <th className="px-2 py-1 text-left">Période OOS</th>
                <th className="px-2 py-1 text-right">Test ret.</th>
                <th className="px-2 py-1 text-right">Test sharpe</th>
                <th className="px-2 py-1 text-right">Test DD</th>
              </tr>
            </thead>
            <tbody className="font-financial">
              {windows.map(w => (
                <tr key={w.index} className="border-b border-border/20">
                  <td className="px-2 py-1">{w.test_start} → {w.test_end}</td>
                  <td className="px-2 py-1 text-right">{formatPct(w.test_return)}</td>
                  <td className="px-2 py-1 text-right">{formatNum(w.test_sharpe)}</td>
                  <td className="px-2 py-1 text-right">{formatPct(w.test_max_drawdown)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="mt-2 text-[10px] text-amber-400/70">
        La validation walk-forward réduit le risque d'overfitting mais n'est pas une preuve de performance future.
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/60 bg-surface-1 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-financial text-sm text-foreground">{value}</div>
    </div>
  )
}
