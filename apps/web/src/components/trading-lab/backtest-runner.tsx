import { css, cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { ExclamationTrianglePixelIcon } from '@finance-os/ui/icons/pixel'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Panel } from '@/components/surfaces/panel'
import {
  type BacktestRunRequest,
  type BacktestRunResponse,
  type DataSourcePreference,
  type MarketDataPreviewResponse,
  type PreferredProvider,
  previewTradingLabMarketData,
  runTradingLabBacktest,
  runTradingLabWalkForward,
  type TradingLabStrategy,
  type WalkForwardResponse,
} from '@/features/trading-lab-api'
import { DataSourceBadge } from './data-source-badge'
import { MarketDataSourcePicker } from './market-data-source-picker'
import { StrategyPicker } from './strategy-picker'

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
  if (!Number.isFinite(n)) return 'Indisponible'
  return `${(n * 100).toFixed(digits)}%`
}
const formatNum = (value: unknown, digits = 2) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'Indisponible'
  return n.toFixed(digits)
}

const toggleButton = css({
  rounded: 'md',
  borderWidth: '1px',
  borderColor: 'border',
  bg: 'surface.1',
  px: '2',
  py: '1',
  fontSize: '11px',
  color: 'muted.foreground',
  _hover: { color: 'foreground' },
})

const field = css({ display: 'flex', flexDirection: 'column', gap: '1', textStyle: 'xs' })

const fieldLabel = css({ color: 'muted.foreground' })

const control = css({
  rounded: 'md',
  borderWidth: '1px',
  borderColor: 'border',
  bg: 'surface.1',
  px: '2',
  py: '1.5',
  textStyle: 'sm',
  color: 'foreground',
  _disabled: { opacity: '0.5' },
})

const actionButton = cva({
  base: {
    rounded: 'md',
    borderWidth: '1px',
    px: '3',
    py: '1.5',
    textStyle: 'xs',
    _disabled: { opacity: '0.5' },
  },
  variants: {
    tone: {
      neutral: {
        borderColor: 'border',
        bg: 'surface.1',
        color: 'foreground',
        _hover: { bg: 'surface.2' },
      },
      primary: {
        borderColor: 'primary/40',
        bg: 'primary/15',
        fontWeight: 'medium',
        color: 'primary',
        _hover: { bg: 'primary/25' },
      },
      ai: {
        borderColor: 'ai/40',
        bg: 'ai/15',
        fontWeight: 'medium',
        color: 'ai',
        _hover: { bg: 'ai/25' },
      },
    },
  },
})

// Failure and warning notices; the demo banner uses the wider inset.
const notice = cva({
  base: { rounded: 'md', borderWidth: '1px', textStyle: 'xs' },
  variants: {
    tone: {
      negative: { borderColor: 'negative/30', bg: 'negative/10', color: 'negative' },
      warning: { borderColor: 'warning/30', bg: 'warning/10', color: 'warning' },
    },
    inset: {
      even: { p: '2' },
      wide: { px: '3', py: '2' },
    },
  },
  defaultVariants: { inset: 'even' },
})

const resultPanel = cva({
  base: { rounded: 'md', borderWidth: '1px', p: '2', textStyle: 'xs' },
  variants: {
    tone: {
      neutral: { borderColor: 'border', bg: 'surface.0' },
      positive: { borderColor: 'positive/30', bg: 'positive/5' },
      ai: { borderColor: 'ai/30', bg: 'ai/5' },
    },
  },
})

const metricGrid = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '2',
  sm: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
})

const inlineIcon = css({ mr: '1', display: 'inline-block', verticalAlign: '-1px' })

const disclaimer = css({ mt: '2', fontSize: '10px', color: 'warning/70' })

const overfitBadge = cva({
  base: {
    rounded: 'full',
    borderWidth: '1px',
    px: '2',
    py: '0.5',
    fontSize: '10px',
    textTransform: 'uppercase',
  },
  variants: {
    tone: {
      stable: { bg: 'positive/15', color: 'positive', borderColor: 'positive/30' },
      fragile: { bg: 'warning/15', color: 'warning', borderColor: 'warning/30' },
      overfit: { bg: 'negative/15', color: 'negative', borderColor: 'negative/30' },
      insufficient: { bg: 'surface.2', color: 'muted.foreground', borderColor: 'border' },
    },
  },
})

const cell = cva({
  base: { px: '2', py: '1' },
  variants: {
    align: {
      left: { textAlign: 'left' },
      right: { textAlign: 'right' },
    },
  },
})

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
      tone="ai"
      actions={
        <button type="button" className={toggleButton} onClick={() => setOpen(state => !state)}>
          {open ? 'Masquer' : 'Afficher'}
        </button>
      }
    >
      {!open ? (
        <styled.div textStyle="xs" color="muted.foreground">
          Configurer une stratégie et un univers pour lancer un backtest papier.
        </styled.div>
      ) : (
        <styled.div spaceY="3">
          {isDemo ? (
            <div className={notice({ tone: 'warning', inset: 'wide' })}>
              Mode démo. Les boutons sont visibles mais désactivés. Connecte-toi en admin pour
              exécuter.
            </div>
          ) : null}

          <styled.div
            display="grid"
            gap="3"
            sm={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
            lg={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
          >
            <StrategyPicker
              strategies={strategies}
              value={strategyId}
              onChange={setStrategyId}
              disabled={formDisabled}
            />
            <label className={field}>
              <span className={fieldLabel}>Symbole</span>
              <input
                type="text"
                value={symbol}
                onChange={event => setSymbol(event.target.value)}
                placeholder="SPY.US, AAPL, EURUSD…"
                disabled={formDisabled}
                className={control}
              />
            </label>
            <label className={field}>
              <span className={fieldLabel}>Intervalle</span>
              <select
                className={control}
                value={timeframe}
                disabled={formDisabled}
                onChange={event => setTimeframe(event.target.value)}
              >
                <option value="1d">1 jour</option>
                <option value="1w">1 semaine</option>
                <option value="1mo">1 mois</option>
              </select>
            </label>
            <label className={field}>
              <span className={fieldLabel}>Début</span>
              <input
                type="date"
                value={startDate}
                onChange={event => setStartDate(event.target.value)}
                disabled={formDisabled}
                className={control}
              />
            </label>
            <label className={field}>
              <span className={fieldLabel}>Fin</span>
              <input
                type="date"
                value={endDate}
                onChange={event => setEndDate(event.target.value)}
                disabled={formDisabled}
                className={control}
              />
            </label>
            <label className={field}>
              <span className={fieldLabel}>Capital initial</span>
              <input
                type="number"
                min={100}
                step={100}
                value={initialCash}
                onChange={event => setInitialCash(Number(event.target.value) || 0)}
                disabled={formDisabled}
                className={control}
              />
            </label>
            <label className={field}>
              <span className={fieldLabel}>Frais (bps)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={feesBps}
                onChange={event => setFeesBps(Number(event.target.value) || 0)}
                disabled={formDisabled}
                className={control}
              />
            </label>
            <label className={field}>
              <span className={fieldLabel}>Slippage (bps)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={slippageBps}
                onChange={event => setSlippageBps(Number(event.target.value) || 0)}
                disabled={formDisabled}
                className={control}
              />
            </label>
            <label className={field}>
              <span className={fieldLabel}>Spread (bps)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={spreadBps}
                onChange={event => setSpreadBps(Number(event.target.value) || 0)}
                disabled={formDisabled}
                className={control}
              />
            </label>
          </styled.div>

          <MarketDataSourcePicker
            source={dataSource}
            onSourceChange={setDataSource}
            provider={provider}
            onProviderChange={setProvider}
            disabled={formDisabled}
          />

          <styled.div display="flex" flexWrap="wrap" alignItems="center" gap="2" pt="1">
            <button
              type="button"
              disabled={formDisabled || strategyId === null || previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
              className={actionButton({ tone: 'neutral' })}
            >
              {previewMutation.isPending ? 'Prévisualisation…' : 'Prévisualiser les données'}
            </button>
            <button
              type="button"
              disabled={formDisabled || strategyId === null || runMutation.isPending}
              onClick={() => runMutation.mutate()}
              className={actionButton({ tone: 'primary' })}
            >
              {runMutation.isPending ? 'Backtest en cours…' : 'Lancer le backtest'}
            </button>
            <button
              type="button"
              disabled={formDisabled || strategyId === null || walkForwardMutation.isPending}
              onClick={() => walkForwardMutation.mutate()}
              className={actionButton({ tone: 'ai' })}
            >
              {walkForwardMutation.isPending ? 'Walk-forward…' : 'Walk-forward'}
            </button>
            <styled.span ml="auto" fontSize="10px" color="muted.foreground/70">
              Aucun ordre n'est passé. Aucune connexion broker.
            </styled.span>
          </styled.div>

          <PreviewResultPanel data={previewMutation.data} error={previewMutation.error} />
          <BacktestResultPanel data={runMutation.data} error={runMutation.error} />
          <WalkForwardResultPanel
            data={walkForwardMutation.data}
            error={walkForwardMutation.error}
          />
        </styled.div>
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
      <div className={notice({ tone: 'negative' })}>
        Échec de la prévisualisation : {(error as Error).message}
      </div>
    )
  }
  if (!data?.ok) {
    if (data?.message) {
      return <div className={notice({ tone: 'warning' })}>{data.message}</div>
    }
    return null
  }
  return (
    <div className={resultPanel({ tone: 'neutral' })}>
      <styled.div mb="1" display="flex" flexWrap="wrap" alignItems="center" gap="2">
        <DataSourceBadge
          resolvedMarketDataSource={data.resolvedMarketDataSource}
          dataProvider={data.dataProvider}
          dataQuality={data.dataQuality}
          fallbackUsed={data.fallbackUsed}
        />
        <styled.span color="muted.foreground">
          {data.barsCount ?? 'Nombre indisponible'} bougies, du{' '}
          {data.firstBarDate ?? 'début indisponible'} au {data.lastBarDate ?? 'terme indisponible'}
        </styled.span>
      </styled.div>
      {data.dataWarnings && data.dataWarnings.length > 0 ? (
        <styled.ul spaceY="0.5" color="warning/70">
          {data.dataWarnings.map(warning => (
            <li key={warning}>{warning}</li>
          ))}
        </styled.ul>
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
      <div className={notice({ tone: 'negative' })}>
        Échec du backtest : {(error as Error).message}
      </div>
    )
  }
  if (!data) return null
  if (!data.ok) {
    return (
      <div className={notice({ tone: 'warning' })}>{data.message ?? 'Backtest impossible.'}</div>
    )
  }
  const m = (data.metrics ?? {}) as Record<string, unknown>
  return (
    <div className={resultPanel({ tone: 'positive' })}>
      <styled.div mb="2" display="flex" flexWrap="wrap" alignItems="center" gap="2">
        <styled.span fontWeight="medium" color="positive">
          Backtest #{data.runId} terminé.
        </styled.span>
        <DataSourceBadge
          resolvedMarketDataSource={data.resolvedMarketDataSource}
          dataProvider={data.dataProvider}
          dataQuality={data.dataQuality}
          fallbackUsed={data.fallbackUsed}
        />
        <styled.span color="muted.foreground">
          {data.barsCount ?? 'Nombre indisponible'} bougies, du{' '}
          {data.firstBarDate ?? 'début indisponible'} au {data.lastBarDate ?? 'terme indisponible'}
        </styled.span>
      </styled.div>
      <div className={metricGrid}>
        <Metric label="CAGR" value={formatPct(m.cagr)} />
        <Metric label="Sharpe" value={formatNum(m.sharpe)} />
        <Metric label="Max DD" value={formatPct(m.max_drawdown)} />
        <Metric label="Win rate" value={formatPct(m.win_rate, 0)} />
      </div>
      {data.fallbackUsed ? (
        <styled.div mt="2" color="warning/80">
          <ExclamationTrianglePixelIcon size={12} className={inlineIcon} />
          Fallback utilisé ({data.fallbackReason ?? 'inconnu'}). Les chiffres ne reflètent pas un
          marché réel.
        </styled.div>
      ) : null}
      {data.dataWarnings && data.dataWarnings.length > 0 ? (
        <styled.ul mt="1" spaceY="0.5" color="muted.foreground">
          {data.dataWarnings.map(warning => (
            <li key={warning}>{warning}</li>
          ))}
        </styled.ul>
      ) : null}
      <div className={disclaimer}>
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
      <div className={notice({ tone: 'negative' })}>
        Échec du walk-forward : {(error as Error).message}
      </div>
    )
  }
  if (!data) return null
  if (!data.ok) {
    return (
      <div className={notice({ tone: 'warning' })}>
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
  const TONE_LABEL: Record<typeof tone, string> = {
    stable: 'Stable',
    fragile: 'Fragile',
    overfit: 'Risque overfit',
    insufficient: 'Données insuffisantes',
  }

  return (
    <div className={resultPanel({ tone: 'ai' })}>
      <styled.div mb="2" display="flex" flexWrap="wrap" alignItems="center" gap="2">
        <styled.span fontWeight="medium" color="ai">
          Walk-forward
        </styled.span>
        <span className={overfitBadge({ tone })}>{TONE_LABEL[tone]}</span>
        <DataSourceBadge
          resolvedMarketDataSource={data.resolvedMarketDataSource}
          dataProvider={data.dataProvider}
          dataQuality="real"
          fallbackUsed={data.fallbackUsed}
        />
      </styled.div>
      <styled.p mb="2" color="muted.foreground">
        {data.summary}
      </styled.p>
      <div className={metricGrid}>
        <Metric
          label="Stabilité OOS"
          value={data.stabilityScore != null ? formatNum(data.stabilityScore) : 'Indisponible'}
        />
        <Metric
          label="Dégradation"
          value={
            data.degradationRatio != null
              ? `${(data.degradationRatio * 100).toFixed(0)}%`
              : 'Indisponible'
          }
        />
        <Metric label="Fenêtres" value={String(windows.length)} />
        <Metric label="Alerte" value={data.overfitWarning ?? 'Indisponible'} />
      </div>
      {windows.length > 0 ? (
        <styled.div
          mt="2"
          maxH="40"
          overflow="auto"
          rounded="0.25rem"
          borderWidth="1px"
          borderColor="border/60"
          bg="surface.1"
        >
          <styled.table w="full" fontSize="10px">
            <styled.thead color="muted.foreground/70">
              <styled.tr borderBottomWidth="1px" borderColor="border/40">
                <th className={cell({ align: 'left' })}>Période OOS</th>
                <th className={cell({ align: 'right' })}>Test ret.</th>
                <th className={cell({ align: 'right' })}>Test sharpe</th>
                <th className={cell({ align: 'right' })}>Test DD</th>
              </styled.tr>
            </styled.thead>
            <styled.tbody textStyle="financial">
              {windows.map(w => (
                <styled.tr key={w.index} borderBottomWidth="1px" borderColor="border/20">
                  <td className={cell()}>
                    {w.test_start} → {w.test_end}
                  </td>
                  <td className={cell({ align: 'right' })}>{formatPct(w.test_return)}</td>
                  <td className={cell({ align: 'right' })}>{formatNum(w.test_sharpe)}</td>
                  <td className={cell({ align: 'right' })}>{formatPct(w.test_max_drawdown)}</td>
                </styled.tr>
              ))}
            </styled.tbody>
          </styled.table>
        </styled.div>
      ) : null}
      <div className={disclaimer}>
        La validation walk-forward réduit le risque d'overfitting mais n'est pas une preuve de
        performance future.
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <styled.div rounded="0.25rem" borderWidth="1px" borderColor="border/60" bg="surface.1" p="2">
      <styled.div
        fontSize="10px"
        textTransform="uppercase"
        letterSpacing="wide"
        color="muted.foreground"
      >
        {label}
      </styled.div>
      <styled.div textStyle="financial" fontSize="sm" lineHeight="sm" color="foreground">
        {value}
      </styled.div>
    </styled.div>
  )
}
