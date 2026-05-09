// PR12 — Strategy Scorecard card.
//
// Collapsible per-hypothesis evidence-quality view. NEVER an execution path:
//   • Read-only query (`GET /dashboard/trading-lab/strategies/:id/scorecard`).
//   • Flag-gated: when `VITE_LEARNING_LOOP_UI_ENABLED=false`, the query never fires.
//   • Demo mode renders a deterministic fixture without contacting the API.
//   • Copy is paper-only / research-only; no buy/sell/order/execute wording.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button } from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { dashboardTradingLabStrategyScorecardQueryOptionsWithMode } from '@/features/dashboard-query-options'
import type {
  DashboardTradingLabStrategyScorecardAdvancedMetrics,
  DashboardTradingLabStrategyScorecardQualityFlag,
  DashboardTradingLabStrategyScorecardResponse,
} from '@/features/dashboard-types'
import {
  SCORECARD_FLAG_TONE,
  SCORECARD_GRADE_LABEL_FR,
  SCORECARD_GRADE_TONE,
} from '@/features/learning-loop-view-model'
import { toErrorMessage } from '@/lib/format'

interface StrategyScorecardCardProps {
  strategyId: number
  mode: AuthMode
  learningLoopEnabled: boolean
  defaultOpen?: boolean
}

const formatPct = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(1)} %`
}

const formatRatio = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return '—'
  return value.toFixed(2)
}

const gradeToneClass = (grade: DashboardTradingLabStrategyScorecardResponse['evidenceGrade']) => {
  switch (SCORECARD_GRADE_TONE[grade]) {
    case 'success':
      return 'text-emerald-500'
    case 'warning':
      return 'text-amber-500'
    case 'danger':
      return 'text-destructive'
    case 'info':
      return 'text-sky-500'
    case 'muted':
      return 'text-muted-foreground'
  }
}

const flagToneClass = (
  severity: DashboardTradingLabStrategyScorecardQualityFlag['severity']
): string => {
  switch (SCORECARD_FLAG_TONE[severity]) {
    case 'info':
      return 'text-sky-500'
    case 'warning':
      return 'text-amber-500'
    case 'danger':
      return 'text-destructive'
  }
}

const PERMANENT_BADGES = ['Paper only', 'Qualité de preuve', 'Recherche']

// PR14 — formatting helpers for advanced metrics. Keep them local and side-effect-free.
const formatNumber = (value: number | null, digits = 2): string => {
  if (value === null || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}
const formatPercent = (value: number | null, digits = 2): string => {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(digits)} %`
}
const formatCurrency = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return '—'
  return value.toFixed(2)
}

interface AdvancedMetricsSectionProps {
  data: DashboardTradingLabStrategyScorecardAdvancedMetrics | null
}

function AdvancedMetricsSection({ data }: AdvancedMetricsSectionProps) {
  const [open, setOpen] = useState(false)
  if (data === null) {
    return null
  }
  const allMetricsNull =
    data.calmarRatio === null &&
    data.marRatio === null &&
    data.recoveryFactor === null &&
    data.ulcerIndex === null &&
    data.tailRatio === null &&
    data.omegaRatio === null &&
    data.valueAtRisk95 === null &&
    data.expectedShortfall95 === null &&
    data.rollingSharpe.latest === null &&
    data.rollingMaxDrawdown.latest === null &&
    data.payoffRatio === null &&
    data.averageWin === null &&
    data.averageLoss === null
  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(prev => !prev)}
          aria-expanded={open}
        >
          {open ? 'Masquer les métriques avancées' : 'Afficher les métriques avancées'}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Métriques rétrospectives — ne prédit pas les résultats futurs.
        </span>
      </div>
      {open ? (
        <div className="mt-3 space-y-3">
          {allMetricsNull ? (
            <p className="text-xs text-muted-foreground">
              Données insuffisantes pour calculer des métriques avancées sur ce run.
            </p>
          ) : (
            <>
              <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Calmar</dt>
                  <dd className="text-foreground">{formatNumber(data.calmarRatio)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">MAR</dt>
                  <dd className="text-foreground">{formatNumber(data.marRatio)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Recovery factor</dt>
                  <dd className="text-foreground">{formatNumber(data.recoveryFactor)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ulcer index</dt>
                  <dd className="text-foreground">{formatNumber(data.ulcerIndex, 4)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tail ratio</dt>
                  <dd className="text-foreground">{formatNumber(data.tailRatio)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Omega</dt>
                  <dd className="text-foreground">{formatNumber(data.omegaRatio)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">VaR 95% (historique)</dt>
                  <dd className="text-foreground">{formatPercent(data.valueAtRisk95)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Expected shortfall 95% (historique)</dt>
                  <dd className="text-foreground">{formatPercent(data.expectedShortfall95)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Payoff ratio</dt>
                  <dd className="text-foreground">{formatNumber(data.payoffRatio)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Sharpe glissant (dernier)</dt>
                  <dd className="text-foreground">{formatNumber(data.rollingSharpe.latest)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Sharpe glissant (min/max/moy)</dt>
                  <dd className="text-foreground">
                    {formatNumber(data.rollingSharpe.min)} / {formatNumber(data.rollingSharpe.max)} /{' '}
                    {formatNumber(data.rollingSharpe.average)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">DD glissant (dernier / pire)</dt>
                  <dd className="text-foreground">
                    {formatPercent(data.rollingMaxDrawdown.latest)} /{' '}
                    {formatPercent(data.rollingMaxDrawdown.worst)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Gain moyen</dt>
                  <dd className="text-foreground">{formatCurrency(data.averageWin)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Perte moyenne</dt>
                  <dd className="text-foreground">{formatCurrency(data.averageLoss)}</dd>
                </div>
              </dl>

              <div className="rounded-md border border-border/30 bg-surface-1/35 px-2 py-1 text-[11px] text-muted-foreground">
                <p>
                  Hypothèses : annualisation ={' '}
                  {data.assumptions.annualizationPeriods === null
                    ? 'inconnue'
                    : `${data.assumptions.annualizationPeriods} périodes/an`}
                  ; taux sans risque ={' '}
                  {(data.assumptions.riskFreeRate * 100).toFixed(2)}% ; VaR confiance ={' '}
                  {Math.round(data.assumptions.varConfidence * 100)}% ; fenêtre glissante ={' '}
                  {data.assumptions.rollingWindow ?? 'n/a'}.
                </p>
                <p className="mt-1">
                  VaR / CVaR sont des estimations historiques, pas des garanties de pire cas.
                </p>
              </div>

              {data.warnings.length > 0 ? (
                <ul className="space-y-1 text-[11px] text-amber-500">
                  {data.warnings.map(warning => (
                    <li key={warning}>· {warning}</li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function StrategyScorecardCard({
  strategyId,
  mode,
  learningLoopEnabled,
  defaultOpen = false,
}: StrategyScorecardCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  const queryEnabled = learningLoopEnabled && open
  const query = useQuery({
    ...dashboardTradingLabStrategyScorecardQueryOptionsWithMode({
      mode,
      strategyId,
      learningLoopEnabled: queryEnabled,
    }),
    enabled:
      mode !== undefined &&
      queryEnabled &&
      Number.isFinite(strategyId) &&
      strategyId > 0,
  })

  if (!learningLoopEnabled) {
    return null
  }

  const data = query.data
  const isLoading = query.isPending && open
  const isError = query.isError

  return (
    <div className="rounded-lg border border-border/40 bg-surface-1/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOpen(prev => !prev)}
            aria-expanded={open}
          >
            {open ? 'Masquer le scorecard' : 'Afficher le scorecard de preuve'}
          </Button>
          {PERMANENT_BADGES.map(label => (
            <Badge key={label} variant="outline">
              {label}
            </Badge>
          ))}
          {data ? (
            <span className={`text-xs font-medium ${gradeToneClass(data.evidenceGrade)}`}>
              {SCORECARD_GRADE_LABEL_FR[data.evidenceGrade]}
            </span>
          ) : null}
        </div>
        <span className="text-[11px] text-muted-foreground">
          Ne constitue pas une recommandation.
        </span>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Chargement du scorecard…</p>
          ) : null}

          {isError ? (
            <p className="text-xs text-amber-500">
              Scorecard indisponible : {toErrorMessage(query.error)}
            </p>
          ) : null}

          {data ? (
            <>
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-md border border-border/40 bg-background/40 px-2 py-1">
                  <p className="text-muted-foreground">Backtests complétés</p>
                  <p className="font-medium text-foreground">
                    {data.summary.totalBacktests} ({data.summary.totalTrades} trades)
                  </p>
                </div>
                <div className="rounded-md border border-border/40 bg-background/40 px-2 py-1">
                  <p className="text-muted-foreground">Run le plus récent</p>
                  <p className="font-medium text-foreground">
                    {data.summary.latestRunAt
                      ? data.summary.latestRunAt.slice(0, 10)
                      : 'Aucun'}
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-border/40 bg-background/40 p-3 text-xs">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Métriques (run le plus récent)
                </p>
                <dl className="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">Win rate</dt>
                    <dd className="text-foreground">{formatPct(data.metrics.winRate)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Profit factor</dt>
                    <dd className="text-foreground">{formatRatio(data.metrics.profitFactor)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Drawdown max</dt>
                    <dd className="text-foreground">{formatPct(data.metrics.maxDrawdown)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Sharpe</dt>
                    <dd className="text-foreground">{formatRatio(data.metrics.sharpe)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Sortino</dt>
                    <dd className="text-foreground">{formatRatio(data.metrics.sortino)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Walk-forward</dt>
                    <dd className="text-foreground">
                      {data.metrics.walkForwardRuns > 0
                        ? `${data.metrics.walkForwardRuns} run(s)`
                        : 'Aucun'}
                    </dd>
                  </div>
                </dl>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <Badge variant="outline">
                    Frais inclus :{' '}
                    {data.metrics.feesIncluded === null
                      ? 'inconnu'
                      : data.metrics.feesIncluded
                        ? 'oui'
                        : 'non'}
                  </Badge>
                  <Badge variant="outline">
                    Slippage inclus :{' '}
                    {data.metrics.slippageIncluded === null
                      ? 'inconnu'
                      : data.metrics.slippageIncluded
                        ? 'oui'
                        : 'non'}
                  </Badge>
                </div>
              </div>

              {/* PR14 — collapsible advanced-metrics subsection. Render only if the response
                  carries the field; null means no completed run with usable data. */}
              <AdvancedMetricsSection data={data.advancedMetrics ?? null} />

              {data.qualityFlags.length > 0 ? (
                <ul className="space-y-1 text-xs">
                  {data.qualityFlags.map((flag, idx) => (
                    <li key={`${flag.kind}-${idx}`} className={flagToneClass(flag.severity)}>
                      · {flag.message}
                    </li>
                  ))}
                </ul>
              ) : null}

              {data.caveats.length > 0 ? (
                <ul className="space-y-1 text-[11px] text-muted-foreground">
                  {data.caveats.map(caveat => (
                    <li key={caveat}>· {caveat}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
