import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { authMeQueryOptions } from '@/features/auth-query-options'
import {
  tradingLabStrategiesQueryOptions,
  tradingLabBacktestsQueryOptions,
  tradingLabScenariosQueryOptions,
  tradingLabCapabilitiesQueryOptions,
  attentionItemsQueryOptions,
} from '@/features/trading-lab-query-options'
import type {
  TradingLabStrategy,
  TradingLabBacktestRun,
  TradingLabScenario,
  AttentionItem,
} from '@/features/trading-lab-api'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { KpiTile } from '@/components/surfaces/kpi-tile'
import { EquityCurveChart, type EquityPoint } from '@/components/trading-lab/equity-curve-chart'
import { DrawdownChart, type DrawdownPoint } from '@/components/trading-lab/drawdown-chart'
import { BacktestRunner } from '@/components/trading-lab/backtest-runner'
import { StrategyEditor } from '@/components/trading-lab/strategy-editor'
import { GraphPathPreview } from '@/components/trading-lab/path-preview'
import { DataSourceBadge } from '@/components/trading-lab/data-source-badge'

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

function SeverityBadge({ severity }: { severity: string }) {
  const colorMap: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    important: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    watch: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    info: 'bg-surface-2 text-muted-foreground border-border',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorMap[severity] ?? colorMap.info}`}>
      {severity}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    'active-paper': 'bg-green-500/20 text-green-400 border-green-500/30',
    draft: 'bg-surface-2 text-muted-foreground border-border',
    archived: 'bg-surface-1 text-muted-foreground/60 border-border/50',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    running: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    pending: 'bg-surface-2 text-muted-foreground border-border',
    open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    tracking: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorMap[status] ?? colorMap.draft}`}>
      {status}
    </span>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-financial text-lg font-semibold text-foreground">
        {value !== null && value !== undefined ? String(value) : '--'}
      </div>
    </div>
  )
}

function TradingLabPage() {
  const { data: authData } = useQuery(authMeQueryOptions())
  const isAdmin = authData?.mode === 'admin'
  const isDemo = authData?.mode === 'demo'

  const { data: strategies = [], isLoading: strategiesLoading } = useQuery(tradingLabStrategiesQueryOptions())
  const { data: backtests = [], isLoading: backtestsLoading } = useQuery(tradingLabBacktestsQueryOptions())
  const { data: scenarios = [], isLoading: scenariosLoading } = useQuery(tradingLabScenariosQueryOptions())
  const { data: capabilities } = useQuery(tradingLabCapabilitiesQueryOptions())
  const { data: attentionData } = useQuery(attentionItemsQueryOptions({ status: 'open' }))

  const attentionItems: AttentionItem[] = attentionData?.items ?? []
  const openCount = attentionData?.openCount ?? 0
  const strategyList = strategies as TradingLabStrategy[]
  const backtestList = backtests as TradingLabBacktestRun[]
  const scenarioList = scenarios as TradingLabScenario[]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trading Lab"
        description="Recherche papier, backtests et stratégies — pas de trading réel."
      />

      {/* Paper-only warning */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <div className="flex items-start gap-2">
          <span className="text-amber-400 text-lg leading-none mt-0.5">&#9888;</span>
          <div>
            <div className="font-medium text-amber-300 text-sm">Paper Trading Only · Backtest ≠ prédiction</div>
            <div className="text-xs text-amber-400/80 mt-0.5">
              Environnement de recherche et simulation. Aucun capital réel, aucune connexion broker, aucune exécution d'ordre.
              Les stratégies techniques sont expérimentales sauf marquées comme benchmark. Les signaux sociaux seuls sont une preuve faible.
            </div>
          </div>
        </div>
      </div>

      {/* Attention items */}
      {openCount > 0 && (
        <Panel title={`Ce qui demande ton attention (${openCount})`}>
          <div className="space-y-2">
            {attentionItems.slice(0, 5).map((item: AttentionItem) => (
              <div key={item.id} className="flex items-start gap-3 rounded-md border border-border bg-surface-0 p-3">
                <SeverityBadge severity={item.severity} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{item.title}</div>
                  {item.summary ? (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.summary}</div>
                  ) : null}
                </div>
                {item.actionHref ? (
                  <a href={item.actionHref} className="text-xs text-primary hover:underline shrink-0">
                    Voir
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Stratégies" value={strategyList.length} />
        <KpiTile label="Backtests" value={backtestList.length} />
        <KpiTile label="Scénarios" value={scenarioList.length} />
        <KpiTile
          label="Quant Service"
          display={capabilities?.quantServiceAvailable ? 'Connecté' : 'Hors-ligne'}
        />
      </div>

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
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : strategyList.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Aucune stratégie pour le moment.{isAdmin ? ' Crée-en une via le builder ci-dessus.' : ''}
          </div>
        ) : (
          <div className="space-y-2">
            {strategyList.map(s => (
              <div key={s.id} className="flex items-center gap-3 rounded-md border border-border bg-surface-0 p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{s.name}</span>
                    <StatusBadge status={s.status} />
                    {s.strategyType === 'experimental' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                        expérimentale
                      </span>
                    )}
                    {s.strategyType === 'benchmark' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20">
                        benchmark
                      </span>
                    )}
                  </div>
                  {s.description ? (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</div>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground/60 shrink-0">
                  {s.tags.slice(0, 3).join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Latest backtests */}
      <Panel title="Backtests récents">
        {backtestsLoading ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : backtestList.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aucun backtest pour le moment.</div>
        ) : (
          <div className="space-y-4">
            {backtestList.slice(0, 5).map(b => {
              const m = (b.metrics ?? {}) as Record<string, unknown>
              const equity = (b.equityCurve ?? []) as EquityPoint[]
              const drawdowns = (b.drawdowns ?? []) as DrawdownPoint[]
              const summary = (b.resultSummary ?? {}) as Record<string, unknown>
              const dataQuality = (summary.dataQuality as string | undefined) ?? null
              const dataProvider = (summary.dataProvider as string | undefined) ?? null
              const fallbackUsed = Boolean(summary.fallbackUsed)
              return (
                <div key={b.id} className="rounded-md border border-border bg-surface-0 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{b.name}</span>
                    <StatusBadge status={b.runStatus} />
                    <span className="ml-auto font-financial text-xs text-muted-foreground">{b.symbol}</span>
                    <DataSourceBadge
                      resolvedMarketDataSource={b.marketDataSource}
                      dataProvider={dataProvider}
                      dataQuality={dataQuality}
                      fallbackUsed={fallbackUsed}
                    />
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span>cash <span className="font-financial text-foreground">${b.initialCash.toFixed(0)}</span></span>
                    <span>fees <span className="font-financial text-foreground">{b.feesBps}bps</span></span>
                    <span>slippage <span className="font-financial text-foreground">{b.slippageBps}bps</span></span>
                    <span>spread <span className="font-financial text-foreground">{b.spreadBps}bps</span></span>
                    {b.paramsHash ? <span>params <span className="font-mono text-foreground/80">{b.paramsHash.slice(0, 8)}</span></span> : null}
                    {b.dataHash ? <span>data <span className="font-mono text-foreground/80">{b.dataHash.slice(0, 8)}</span></span> : null}
                  </div>

                  {b.metrics ? (
                    <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                      <MetricCard label="CAGR" value={m.cagr != null ? `${((m.cagr as number) * 100).toFixed(1)}%` : null} />
                      <MetricCard label="Sharpe" value={m.sharpe != null ? (m.sharpe as number).toFixed(2) : null} />
                      <MetricCard label="Sortino" value={m.sortino != null ? (m.sortino as number).toFixed(2) : null} />
                      <MetricCard label="Max DD" value={m.max_drawdown != null ? `${((m.max_drawdown as number) * 100).toFixed(1)}%` : null} />
                      <MetricCard label="Calmar" value={m.calmar != null ? (m.calmar as number).toFixed(2) : null} />
                      <MetricCard label="Win Rate" value={m.win_rate != null ? `${((m.win_rate as number) * 100).toFixed(0)}%` : null} />
                      <MetricCard label="Profit F." value={m.profit_factor != null ? (m.profit_factor as number).toFixed(2) : null} />
                      <MetricCard label="Trades" value={m.total_trades as number | null} />
                    </div>
                  ) : null}

                  {b.runStatus === 'completed' && equity.length > 0 ? (
                    <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground/70">
                          <span>Courbe d'équité</span>
                          <span className="font-mono">{equity.length} pts</span>
                        </div>
                        <EquityCurveChart data={equity} height={200} />
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground/70">
                          <span>Drawdown</span>
                          <span className="font-mono">{drawdowns.length} pts</span>
                        </div>
                        <DrawdownChart data={drawdowns} height={200} />
                      </div>
                    </div>
                  ) : null}

                  {b.runStatus === 'completed' && b.trades && b.trades.length > 0 ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        {b.trades.length} trade{b.trades.length > 1 ? 's' : ''} ▾
                      </summary>
                      <div className="mt-2 max-h-44 overflow-auto rounded border border-border/50 bg-surface-1">
                        <table className="w-full text-[11px]">
                          <thead className="text-muted-foreground/70">
                            <tr className="border-b border-border/40">
                              <th className="px-2 py-1 text-left">Entrée</th>
                              <th className="px-2 py-1 text-left">Sortie</th>
                              <th className="px-2 py-1 text-right">Côté</th>
                              <th className="px-2 py-1 text-right">PnL</th>
                              <th className="px-2 py-1 text-right">PnL %</th>
                            </tr>
                          </thead>
                          <tbody className="font-financial">
                            {b.trades.slice(0, 50).map(t => {
                              const tr = t as Record<string, unknown>
                              const pnl = Number(tr.pnl ?? 0)
                              const pnlPct = Number(tr.pnl_pct ?? tr.pnlPct ?? 0)
                              const tradeKey = [
                                String(tr.entry_date ?? tr.entryDate ?? ''),
                                String(tr.exit_date ?? tr.exitDate ?? ''),
                                String(tr.side ?? 'long'),
                                String(tr.pnl ?? ''),
                              ].join(':')
                              return (
                                <tr key={tradeKey} className="border-b border-border/20">
                                  <td className="px-2 py-1">{String(tr.entry_date ?? tr.entryDate ?? '')}</td>
                                  <td className="px-2 py-1">{String(tr.exit_date ?? tr.exitDate ?? '')}</td>
                                  <td className="px-2 py-1 text-right">{String(tr.side ?? 'long')}</td>
                                  <td className={`px-2 py-1 text-right ${pnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                                  </td>
                                  <td className={`px-2 py-1 text-right ${pnlPct >= 0 ? 'text-positive' : 'text-negative'}`}>
                                    {pnlPct >= 0 ? '+' : ''}{(pnlPct * 100).toFixed(2)}%
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ) : null}

                  {b.runStatus === 'failed' && b.errorSummary ? (
                    <div className="mt-2 text-xs text-red-400">{b.errorSummary}</div>
                  ) : null}

                  <div className="mt-3 text-[10px] text-amber-400/70">
                    Backtest = simulation, pas une prédiction. Stratégies techniques expérimentales. Signaux sociaux seuls = preuve faible.
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {/* Scenarios */}
      <Panel title="Scénarios papier">
        {scenariosLoading ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : scenarioList.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aucun scénario. Crée-en un depuis un signal pour structurer une thèse.</div>
        ) : (
          <div className="space-y-2">
            {scenarioList.map(s => (
              <div key={s.id} className="rounded-md border border-border bg-surface-0 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{s.name}</span>
                  <StatusBadge status={s.status} />
                </div>
                {s.thesis ? (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.thesis}</div>
                ) : null}
                {s.invalidationCriteria ? (
                  <div className="text-xs text-red-400/70 mt-1">
                    Invalidation : {s.invalidationCriteria}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Capabilities / risk caveats */}
      {capabilities?.caveats && capabilities.caveats.length > 0 && (
        <Panel title="Risques & caveats">
          <ul className="space-y-1">
            {capabilities.caveats.map((c: string) => (
              <li key={c} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">&#9679;</span>
                {c}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
