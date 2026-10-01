import { css, cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { ChevronDownPixelIcon, ExclamationTrianglePixelIcon } from '@finance-os/ui/icons/pixel'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { KpiTile } from '@/components/surfaces/kpi-tile'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { BacktestRunner } from '@/components/trading-lab/backtest-runner'
import { DataSourceBadge } from '@/components/trading-lab/data-source-badge'
import { DrawdownChart, type DrawdownPoint } from '@/components/trading-lab/drawdown-chart'
import { EquityCurveChart, type EquityPoint } from '@/components/trading-lab/equity-curve-chart'
import { HypothesisLabSection } from '@/components/trading-lab/hypothesis-lab'
import { GraphPathPreview } from '@/components/trading-lab/path-preview'
import { PatternDetectionPanel } from '@/components/trading-lab/pattern-detection-panel'
import { StrategyEditor } from '@/components/trading-lab/strategy-editor'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { getLearningLoopUiFlags } from '@/features/learning-loop-config'
import { shouldShowHypothesisLabOnTradingLab } from '@/features/learning-loop-visibility'
import type {
  AttentionItem,
  TradingLabBacktestRun,
  TradingLabScenario,
  TradingLabStrategy,
} from '@/features/trading-lab-api'
import {
  attentionItemsQueryOptions,
  tradingLabBacktestsQueryOptions,
  tradingLabCapabilitiesQueryOptions,
  tradingLabScenariosQueryOptions,
  tradingLabStrategiesQueryOptions,
} from '@/features/trading-lab-query-options'

export const Route = createFileRoute('/_app/ia/trading-lab')({
  loader: async ({ context }) => {
    await Promise.allSettled([
      context.queryClient.ensureQueryData(tradingLabStrategiesQueryOptions()),
      context.queryClient.ensureQueryData(tradingLabBacktestsQueryOptions()),
      context.queryClient.ensureQueryData(tradingLabScenariosQueryOptions()),
      context.queryClient.ensureQueryData(tradingLabCapabilitiesQueryOptions()),
      context.queryClient.ensureQueryData(attentionItemsQueryOptions({ status: 'open' })),
    ])
  },
  component: TradingLabPage,
})

type PillTone = 'negative' | 'warning' | 'teal' | 'positive' | 'neutral' | 'archived'

// Severity and status chips share one pill; the tone maps replace the former class lookups.
const pill = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    rounded: 'full',
    borderWidth: '1px',
    px: '2',
    py: '0.5',
    textStyle: 'xs',
    fontWeight: 'medium',
  },
  variants: {
    tone: {
      negative: { bg: 'negative/20', color: 'negative', borderColor: 'negative/30' },
      warning: { bg: 'warning/20', color: 'warning', borderColor: 'warning/30' },
      teal: { bg: 'teal/20', color: 'teal', borderColor: 'teal/30' },
      positive: { bg: 'positive/20', color: 'positive', borderColor: 'positive/30' },
      neutral: { bg: 'surface.2', color: 'muted.foreground', borderColor: 'border' },
      archived: { bg: 'surface.1', color: 'muted.foreground/60', borderColor: 'border/50' },
    },
  },
})

const SEVERITY_TONE: Record<string, PillTone> = {
  critical: 'negative',
  important: 'warning',
  watch: 'teal',
  info: 'neutral',
}

const STATUS_TONE: Record<string, PillTone> = {
  'active-paper': 'positive',
  draft: 'neutral',
  archived: 'archived',
  completed: 'positive',
  running: 'warning',
  failed: 'negative',
  pending: 'neutral',
  open: 'teal',
  tracking: 'warning',
}

// Bare `rounded` is Tailwind's inlined 0.25rem, not a radius token.
const typeTag = cva({
  base: { rounded: '0.25rem', borderWidth: '1px', px: '1.5', py: '0.5', fontSize: '10px' },
  variants: {
    kind: {
      experimental: { borderColor: 'warning/20', bg: 'warning/15', color: 'warning' },
      benchmark: { borderColor: 'positive/20', bg: 'positive/15', color: 'positive' },
    },
  },
})

const card = cva({
  base: { rounded: 'md', borderWidth: '1px', borderColor: 'border', bg: 'surface.0', p: '3' },
  variants: {
    layout: {
      block: {},
      row: { display: 'flex', alignItems: 'center', gap: '3' },
      rowStart: { display: 'flex', alignItems: 'flex-start', gap: '3' },
    },
  },
  defaultVariants: { layout: 'block' },
})

const mutedText = css({ textStyle: 'sm', color: 'muted.foreground' })

const itemTitle = css({ textStyle: 'sm', fontWeight: 'medium', color: 'foreground' })

const warningIcon = css({ mt: '0.5', flexShrink: '0', color: 'warning' })

const viewLink = css({
  flexShrink: '0',
  textStyle: 'xs',
  color: 'primary',
  _hover: { textDecorationLine: 'underline' },
})

const figure = css({ textStyle: 'financial', color: 'foreground' })

const hash = css({ fontFamily: 'mono', color: 'foreground/80' })

const metricsGrid = css({
  mb: '3',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '2',
  sm: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
  lg: { gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' },
})

const chartHeader = css({
  mb: '1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: 'wide',
  color: 'muted.foreground/70',
})

const mono = css({ fontFamily: 'mono' })

const tradesSummary = css({
  cursor: 'pointer',
  textStyle: 'xs',
  color: 'muted.foreground',
  _hover: { color: 'foreground' },
})

const inlineIcon = css({ display: 'inline-block', verticalAlign: '-1px' })

const cell = cva({
  base: { px: '2', py: '1' },
  variants: {
    align: {
      left: { textAlign: 'left' },
      right: { textAlign: 'right' },
    },
    tone: {
      unavailable: { color: 'muted.foreground' },
      positive: { color: 'positive' },
      negative: { color: 'negative' },
    },
  },
})

const pnlTone = (value: number | null) =>
  value === null ? 'unavailable' : value >= 0 ? 'positive' : 'negative'

const caveatItem = css({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '2',
  textStyle: 'xs',
  color: 'muted.foreground',
})

function SeverityBadge({ severity }: { severity: string }) {
  const labelMap: Record<string, string> = {
    critical: 'Critique',
    important: 'Important',
    watch: 'À surveiller',
    info: 'Information',
  }
  return (
    <span className={pill({ tone: SEVERITY_TONE[severity] ?? 'neutral' })}>
      {labelMap[severity] ?? 'Information'}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const labelMap: Record<string, string> = {
    'active-paper': 'Simulation active',
    archived: 'Archivé',
    completed: 'Terminé',
    draft: 'Brouillon',
    failed: 'Échec',
    open: 'Ouvert',
    pending: 'En attente',
    running: 'En cours',
    tracking: 'Suivi',
  }
  return (
    <span className={pill({ tone: STATUS_TONE[status] ?? 'neutral' })}>
      {labelMap[status] ?? 'État inconnu'}
    </span>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number | null }) {
  return (
    <styled.div rounded="lg" borderWidth="1px" borderColor="border" bg="surface.1" p="3">
      <styled.div textStyle="xs" color="muted.foreground">
        {label}
      </styled.div>
      <styled.div
        textStyle="financial"
        fontSize="lg"
        lineHeight="lg"
        fontWeight="semibold"
        color="foreground"
      >
        {value !== null && value !== undefined ? String(value) : 'Indisponible'}
      </styled.div>
    </styled.div>
  )
}

function TradingLabPage() {
  const { data: authData } = useQuery(authMeQueryOptions())
  const isAdmin = authData?.mode === 'admin'
  const isDemo = authData?.mode === 'demo'

  const { data: strategies = [], isLoading: strategiesLoading } = useQuery(
    tradingLabStrategiesQueryOptions()
  )
  const { data: backtests = [], isLoading: backtestsLoading } = useQuery(
    tradingLabBacktestsQueryOptions()
  )
  const { data: scenarios = [], isLoading: scenariosLoading } = useQuery(
    tradingLabScenariosQueryOptions()
  )
  const { data: capabilities } = useQuery(tradingLabCapabilitiesQueryOptions())
  const { data: attentionData } = useQuery(attentionItemsQueryOptions({ status: 'open' }))

  const attentionItems: AttentionItem[] = attentionData?.items ?? []
  const openCount = attentionData?.openCount ?? 0
  const strategyList = strategies as TradingLabStrategy[]
  const backtestList = backtests as TradingLabBacktestRun[]
  const scenarioList = scenarios as TradingLabScenario[]

  return (
    <styled.div spaceY="6">
      <PageHeader
        eyebrow="Expert en recherche papier"
        title="Trading Lab"
        description="Espace expert pour simulation et backtests. Aucun capital réel, aucun ordre, aucune exécution."
      />

      {/* Paper-only warning */}
      <styled.div
        rounded="lg"
        borderWidth="1px"
        borderColor="warning/30"
        bg="warning/10"
        px="4"
        py="3"
      >
        <styled.div display="flex" alignItems="flex-start" gap="2">
          <ExclamationTrianglePixelIcon className={warningIcon} size={18} />
          <div>
            <styled.div textStyle="sm" fontWeight="medium" color="warning">
              Simulation uniquement. Un backtest n’est pas une prédiction.
            </styled.div>
            <styled.div mt="0.5" textStyle="xs" color="warning/80">
              Environnement de recherche et simulation. Aucun capital réel, aucune connexion broker,
              aucune exécution d'ordre. Les stratégies techniques sont expérimentales sauf marquées
              comme benchmark. Les signaux sociaux seuls sont une preuve faible.
            </styled.div>
          </div>
        </styled.div>
      </styled.div>

      {/* Attention items */}
      {openCount > 0 && (
        <Panel title={`Ce qui demande ton attention (${openCount})`}>
          <styled.div spaceY="2">
            {attentionItems.slice(0, 5).map((item: AttentionItem) => (
              <div key={item.id} className={card({ layout: 'rowStart' })}>
                <SeverityBadge severity={item.severity} />
                <styled.div flex="1" minW="0">
                  <styled.div truncate textStyle="sm" fontWeight="medium" color="foreground">
                    {item.title}
                  </styled.div>
                  {item.summary ? (
                    <styled.div mt="0.5" lineClamp="2" textStyle="xs" color="muted.foreground">
                      {item.summary}
                    </styled.div>
                  ) : null}
                </styled.div>
                {item.actionHref ? (
                  <a href={item.actionHref} className={viewLink}>
                    Voir
                  </a>
                ) : null}
              </div>
            ))}
          </styled.div>
        </Panel>
      )}

      {/* KPI row */}
      <styled.div
        display="grid"
        gridTemplateColumns="repeat(2, minmax(0, 1fr))"
        gap="3"
        sm={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
      >
        <KpiTile label="Stratégies" value={strategyList.length} />
        <KpiTile label="Backtests" value={backtestList.length} />
        <KpiTile label="Scénarios" value={scenarioList.length} />
        <KpiTile
          label="Quant Service"
          displayValue={capabilities?.quantServiceAvailable ? 'Connecté' : 'Hors-ligne'}
        />
      </styled.div>

      {/* In-UI runner (admin) + strategy editor (admin) — collapsed by default */}
      <BacktestRunner
        strategies={strategyList}
        isAdmin={Boolean(isAdmin)}
        isDemo={Boolean(isDemo)}
      />
      <StrategyEditor strategies={strategyList} isAdmin={Boolean(isAdmin)} />

      {/* Graph path preview (cleanly bounded — not a graph hairball) */}
      <GraphPathPreview
        scenarios={scenarioList}
        strategies={strategyList}
        backtests={backtestList}
        attentionItems={attentionItems}
      />

      {/* Strategies list */}
      <Panel title="Stratégies">
        {strategiesLoading ? (
          <div className={mutedText}>Chargement…</div>
        ) : strategyList.length === 0 ? (
          <div className={mutedText}>
            Aucune stratégie pour le moment.
            {isAdmin ? ' Crée-en une via le builder ci-dessus.' : ''}
          </div>
        ) : (
          <styled.div spaceY="2">
            {strategyList.map(s => (
              <div key={s.id} className={card({ layout: 'row' })}>
                <styled.div flex="1" minW="0">
                  <styled.div display="flex" alignItems="center" gap="2">
                    <span className={itemTitle}>{s.name}</span>
                    <StatusBadge status={s.status} />
                    {s.strategyType === 'experimental' && (
                      <span className={typeTag({ kind: 'experimental' })}>expérimentale</span>
                    )}
                    {s.strategyType === 'benchmark' && (
                      <span className={typeTag({ kind: 'benchmark' })}>benchmark</span>
                    )}
                  </styled.div>
                  {s.description ? (
                    <styled.div mt="0.5" lineClamp="1" textStyle="xs" color="muted.foreground">
                      {s.description}
                    </styled.div>
                  ) : null}
                </styled.div>
                <styled.div flexShrink="0" textStyle="xs" color="muted.foreground/60">
                  {s.tags.slice(0, 3).join(', ')}
                </styled.div>
              </div>
            ))}
          </styled.div>
        )}
      </Panel>

      {/* Latest backtests */}
      <Panel title="Backtests récents">
        {backtestsLoading ? (
          <div className={mutedText}>Chargement…</div>
        ) : backtestList.length === 0 ? (
          <div className={mutedText}>Aucun backtest pour le moment.</div>
        ) : (
          <styled.div spaceY="4">
            {backtestList.slice(0, 5).map(b => {
              const m = (b.metrics ?? {}) as Record<string, unknown>
              const equity = (b.equityCurve ?? []) as EquityPoint[]
              const drawdowns = (b.drawdowns ?? []) as DrawdownPoint[]
              const summary = (b.resultSummary ?? {}) as Record<string, unknown>
              const dataQuality = (summary.dataQuality as string | undefined) ?? null
              const dataProvider = (summary.dataProvider as string | undefined) ?? null
              const fallbackUsed = Boolean(summary.fallbackUsed)
              return (
                <div key={b.id} className={card()}>
                  <styled.div mb="2" display="flex" flexWrap="wrap" alignItems="center" gap="2">
                    <span className={itemTitle}>{b.name}</span>
                    <StatusBadge status={b.runStatus} />
                    <styled.span
                      ml="auto"
                      textStyle="financial"
                      fontSize="xs"
                      lineHeight="xs"
                      color="muted.foreground"
                    >
                      {b.symbol}
                    </styled.span>
                    <DataSourceBadge
                      resolvedMarketDataSource={b.marketDataSource}
                      dataProvider={dataProvider}
                      dataQuality={dataQuality}
                      fallbackUsed={fallbackUsed}
                    />
                  </styled.div>

                  <styled.div
                    mb="3"
                    display="flex"
                    flexWrap="wrap"
                    gap="2"
                    fontSize="11px"
                    color="muted.foreground"
                  >
                    <span>
                      cash <span className={figure}>${b.initialCash.toFixed(0)}</span>
                    </span>
                    <span>
                      fees <span className={figure}>{b.feesBps}bps</span>
                    </span>
                    <span>
                      slippage <span className={figure}>{b.slippageBps}bps</span>
                    </span>
                    <span>
                      spread <span className={figure}>{b.spreadBps}bps</span>
                    </span>
                    {b.paramsHash ? (
                      <span>
                        params <span className={hash}>{b.paramsHash.slice(0, 8)}</span>
                      </span>
                    ) : null}
                    {b.dataHash ? (
                      <span>
                        data <span className={hash}>{b.dataHash.slice(0, 8)}</span>
                      </span>
                    ) : null}
                  </styled.div>

                  {b.metrics ? (
                    <div className={metricsGrid}>
                      <MetricCard
                        label="CAGR"
                        value={m.cagr != null ? `${((m.cagr as number) * 100).toFixed(1)}%` : null}
                      />
                      <MetricCard
                        label="Sharpe"
                        value={m.sharpe != null ? (m.sharpe as number).toFixed(2) : null}
                      />
                      <MetricCard
                        label="Sortino"
                        value={m.sortino != null ? (m.sortino as number).toFixed(2) : null}
                      />
                      <MetricCard
                        label="Max DD"
                        value={
                          m.max_drawdown != null
                            ? `${((m.max_drawdown as number) * 100).toFixed(1)}%`
                            : null
                        }
                      />
                      <MetricCard
                        label="Calmar"
                        value={m.calmar != null ? (m.calmar as number).toFixed(2) : null}
                      />
                      <MetricCard
                        label="Win Rate"
                        value={
                          m.win_rate != null
                            ? `${((m.win_rate as number) * 100).toFixed(0)}%`
                            : null
                        }
                      />
                      <MetricCard
                        label="Profit F."
                        value={
                          m.profit_factor != null ? (m.profit_factor as number).toFixed(2) : null
                        }
                      />
                      <MetricCard label="Trades" value={m.total_trades as number | null} />
                    </div>
                  ) : null}

                  {b.runStatus === 'completed' && equity.length > 0 ? (
                    // minmax(0, …): a chart canvas mounted wider than its track
                    // must not widen the column (autoSize never shrinks it back).
                    <styled.div
                      display="grid"
                      gap="3"
                      lg={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}
                    >
                      <div>
                        <div className={chartHeader}>
                          <span>Courbe d'équité</span>
                          <span className={mono}>{equity.length} pts</span>
                        </div>
                        <EquityCurveChart data={equity} chartHeight={200} />
                      </div>
                      <div>
                        <div className={chartHeader}>
                          <span>Drawdown</span>
                          <span className={mono}>{drawdowns.length} pts</span>
                        </div>
                        <DrawdownChart data={drawdowns} chartHeight={200} />
                      </div>
                    </styled.div>
                  ) : null}

                  {b.runStatus === 'completed' && b.trades && b.trades.length > 0 ? (
                    <styled.details mt="3">
                      <summary className={tradesSummary}>
                        {b.trades.length} trade{b.trades.length > 1 ? 's' : ''}{' '}
                        <ChevronDownPixelIcon size={10} className={inlineIcon} />
                      </summary>
                      <styled.div
                        mt="2"
                        maxH="44"
                        overflow="auto"
                        rounded="0.25rem"
                        borderWidth="1px"
                        borderColor="border/50"
                        bg="surface.1"
                      >
                        <styled.table w="full" fontSize="11px">
                          <styled.thead color="muted.foreground/70">
                            <styled.tr borderBottomWidth="1px" borderColor="border/40">
                              <th className={cell({ align: 'left' })}>Entrée</th>
                              <th className={cell({ align: 'left' })}>Sortie</th>
                              <th className={cell({ align: 'right' })}>Côté</th>
                              <th className={cell({ align: 'right' })}>PnL</th>
                              <th className={cell({ align: 'right' })}>PnL %</th>
                            </styled.tr>
                          </styled.thead>
                          <styled.tbody textStyle="financial">
                            {b.trades.slice(0, 50).map(t => {
                              const tr = t as Record<string, unknown>
                              const pnlValue = tr.pnl == null ? null : Number(tr.pnl)
                              const pnl =
                                pnlValue !== null && Number.isFinite(pnlValue) ? pnlValue : null
                              const pnlPctValue = tr.pnl_pct ?? tr.pnlPct
                              const pnlPctNumber = pnlPctValue == null ? null : Number(pnlPctValue)
                              const pnlPct =
                                pnlPctNumber !== null && Number.isFinite(pnlPctNumber)
                                  ? pnlPctNumber
                                  : null
                              const tradeKey = [
                                String(tr.entry_date ?? tr.entryDate ?? ''),
                                String(tr.exit_date ?? tr.exitDate ?? ''),
                                String(tr.side ?? ''),
                                String(tr.pnl ?? ''),
                              ].join(':')
                              return (
                                <styled.tr
                                  key={tradeKey}
                                  borderBottomWidth="1px"
                                  borderColor="border/20"
                                >
                                  <td className={cell()}>
                                    {String(tr.entry_date ?? tr.entryDate ?? '')}
                                  </td>
                                  <td className={cell()}>
                                    {String(tr.exit_date ?? tr.exitDate ?? '')}
                                  </td>
                                  <td className={cell({ align: 'right' })}>
                                    {tr.side === 'long'
                                      ? 'Achat'
                                      : tr.side === 'short'
                                        ? 'Vente'
                                        : 'Indisponible'}
                                  </td>
                                  <td className={cell({ align: 'right', tone: pnlTone(pnl) })}>
                                    {pnl === null
                                      ? 'Indisponible'
                                      : `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`}
                                  </td>
                                  <td className={cell({ align: 'right', tone: pnlTone(pnlPct) })}>
                                    {pnlPct === null
                                      ? 'Indisponible'
                                      : `${pnlPct >= 0 ? '+' : ''}${(pnlPct * 100).toFixed(2)}%`}
                                  </td>
                                </styled.tr>
                              )
                            })}
                          </styled.tbody>
                        </styled.table>
                      </styled.div>
                    </styled.details>
                  ) : null}

                  {b.runStatus === 'failed' ? (
                    <styled.div mt="2" textStyle="xs" color="negative">
                      Simulation interrompue. Vérifiez les paramètres et réessayez.
                    </styled.div>
                  ) : null}

                  <styled.div mt="3" fontSize="10px" color="warning/70">
                    Backtest = simulation, pas une prédiction. Stratégies techniques expérimentales.
                    Signaux sociaux seuls = preuve faible.
                  </styled.div>
                </div>
              )
            })}
          </styled.div>
        )}
      </Panel>

      {/* PR5 — Hypothesis Lab tab/section. Visible only when LEARNING_LOOP_UI_ENABLED is true.
          PR6 — Visibility delegated to a shared predicate (see learning-loop-visibility.ts).
          PR11 — Pattern detection panel reuses the same flag gate so demo/admin behaviour is
          consistent across the Trading Lab learning-loop surfaces. */}
      {(() => {
        const mode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined
        const visible =
          shouldShowHypothesisLabOnTradingLab({
            learningLoopFlag: getLearningLoopUiFlags().enabled,
            mode,
          }) && mode !== undefined
        if (!visible || mode === undefined) return null
        return (
          <>
            <HypothesisLabSection mode={mode} />
            <PatternDetectionPanel mode={mode} />
          </>
        )
      })()}

      {/* Scenarios */}
      <Panel title="Scénarios papier">
        {scenariosLoading ? (
          <div className={mutedText}>Chargement…</div>
        ) : scenarioList.length === 0 ? (
          <div className={mutedText}>
            Aucun scénario. Crée-en un depuis un signal pour structurer une thèse.
          </div>
        ) : (
          <styled.div spaceY="2">
            {scenarioList.map(s => (
              <div key={s.id} className={card()}>
                <styled.div display="flex" alignItems="center" gap="2">
                  <span className={itemTitle}>{s.name}</span>
                  <StatusBadge status={s.status} />
                </styled.div>
                {s.thesis ? (
                  <styled.div mt="1" lineClamp="2" textStyle="xs" color="muted.foreground">
                    {s.thesis}
                  </styled.div>
                ) : null}
                {s.invalidationCriteria ? (
                  <styled.div mt="1" textStyle="xs" color="negative/70">
                    Invalidation : {s.invalidationCriteria}
                  </styled.div>
                ) : null}
              </div>
            ))}
          </styled.div>
        )}
      </Panel>

      {/* Capabilities / risk caveats */}
      {capabilities?.caveats && capabilities.caveats.length > 0 && (
        <Panel title="Risques & caveats">
          <styled.ul spaceY="1">
            {capabilities.caveats.map((c: string) => (
              <li key={c} className={caveatItem}>
                <styled.span aria-hidden mt="1.5" boxSize="1.5" flexShrink="0" bg="warning" />
                {c}
              </li>
            ))}
          </styled.ul>
        </Panel>
      )}
    </styled.div>
  )
}
