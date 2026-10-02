// PR12 — Strategy Scorecard card.
//
// Collapsible per-hypothesis evidence-quality view. NEVER an execution path:
//   • Read-only query (`GET /dashboard/trading-lab/strategies/:id/scorecard`).
//   • Flag-gated: when `VITE_LEARNING_LOOP_UI_ENABLED=false`, the query never fires.
//   • Demo mode renders a deterministic fixture without contacting the API.
//   • Copy is paper-only / research-only; no buy/sell/order/execute wording.

import { css, cva, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Badge, Button } from '@finance-os/ui/components'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { AuthMode } from '@/features/auth-types'
import { dashboardTradingLabStrategyScorecardQueryOptionsWithMode } from '@/features/dashboard-query-options'
import type { DashboardTradingLabStrategyScorecardAdvancedMetrics } from '@/features/dashboard-types'
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
  if (value === null || !Number.isFinite(value)) return 'Indisponible'
  return `${(value * 100).toFixed(1)} %`
}

const formatRatio = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return 'Indisponible'
  return value.toFixed(2)
}

// Evidence-grade and quality-flag tones; the view model maps grades and severities to these keys.
const toneText = cva({
  base: {},
  variants: {
    tone: {
      success: { color: 'positive' },
      info: { color: 'teal' },
      warning: { color: 'warning' },
      danger: { color: 'destructive' },
      muted: { color: 'muted.foreground' },
    },
  },
})

const gradeLabel = css({ textStyle: 'xs', fontWeight: 'medium' })

const cardRoot = css({
  rounded: 'lg',
  borderWidth: '1px',
  borderColor: 'border/40',
  bg: 'surface.1/35',
  p: '3',
})

// Inset blocks of the expanded card (advanced metrics, latest-run metrics).
const insetBlock = css({
  rounded: 'md',
  borderWidth: '1px',
  borderColor: 'border/40',
  bg: 'background/40',
  p: '3',
  textStyle: 'xs',
})

const summaryTile = css({
  rounded: 'md',
  borderWidth: '1px',
  borderColor: 'border/40',
  bg: 'background/40',
  px: '2',
  py: '1',
})

const headerRow = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '2',
})

const footnote = css({ fontSize: '11px', color: 'muted.foreground' })

const mutedText = css({ color: 'muted.foreground' })

const metricValue = css({ color: 'foreground' })

const MetricList = styled('dl', {
  base: {
    display: 'grid',
    columnGap: '4',
    rowGap: '1',
    sm: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
  },
})

const assumptionsNote = css({
  rounded: 'md',
  borderWidth: '1px',
  borderColor: 'border/30',
  bg: 'surface.1/35',
  px: '2',
  py: '1',
  fontSize: '11px',
  color: 'muted.foreground',
})

const sectionLabel = css({
  textStyle: 'xs',
  fontWeight: 'semibold',
  textTransform: 'uppercase',
  letterSpacing: 'wide',
  color: 'muted.foreground',
})

const PERMANENT_BADGES = ['Paper only', 'Qualité de preuve', 'Recherche']

// PR14 — formatting helpers for advanced metrics. Keep them local and side-effect-free.
const formatNumber = (value: number | null, digits = 2): string => {
  if (value === null || !Number.isFinite(value)) return 'Indisponible'
  return value.toFixed(digits)
}
const formatPercent = (value: number | null, digits = 2): string => {
  if (value === null || !Number.isFinite(value)) return 'Indisponible'
  return `${(value * 100).toFixed(digits)} %`
}
const formatCurrency = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return 'Indisponible'
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
    <div className={insetBlock}>
      <div className={headerRow}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(prev => !prev)}
          aria-expanded={open}
        >
          {open ? 'Masquer les métriques avancées' : 'Afficher les métriques avancées'}
        </Button>
        <span className={footnote}>
          Métriques rétrospectives. Elles ne prédisent pas les résultats futurs.
        </span>
      </div>
      {open ? (
        <styled.div mt="3" spaceY="3">
          {allMetricsNull ? (
            <styled.p textStyle="xs" color="muted.foreground">
              Données insuffisantes pour calculer des métriques avancées sur ce run.
            </styled.p>
          ) : (
            <>
              <MetricList>
                <div>
                  <dt className={mutedText}>Calmar</dt>
                  <dd className={metricValue}>{formatNumber(data.calmarRatio)}</dd>
                </div>
                <div>
                  <dt className={mutedText}>MAR</dt>
                  <dd className={metricValue}>{formatNumber(data.marRatio)}</dd>
                </div>
                <div>
                  <dt className={mutedText}>Recovery factor</dt>
                  <dd className={metricValue}>{formatNumber(data.recoveryFactor)}</dd>
                </div>
                <div>
                  <dt className={mutedText}>Ulcer index</dt>
                  <dd className={metricValue}>{formatNumber(data.ulcerIndex, 4)}</dd>
                </div>
                <div>
                  <dt className={mutedText}>Tail ratio</dt>
                  <dd className={metricValue}>{formatNumber(data.tailRatio)}</dd>
                </div>
                <div>
                  <dt className={mutedText}>Omega</dt>
                  <dd className={metricValue}>{formatNumber(data.omegaRatio)}</dd>
                </div>
                <div>
                  <dt className={mutedText}>VaR 95% (historique)</dt>
                  <dd className={metricValue}>{formatPercent(data.valueAtRisk95)}</dd>
                </div>
                <div>
                  <dt className={mutedText}>Expected shortfall 95% (historique)</dt>
                  <dd className={metricValue}>{formatPercent(data.expectedShortfall95)}</dd>
                </div>
                <div>
                  <dt className={mutedText}>Payoff ratio</dt>
                  <dd className={metricValue}>{formatNumber(data.payoffRatio)}</dd>
                </div>
                <div>
                  <dt className={mutedText}>Sharpe glissant (dernier)</dt>
                  <dd className={metricValue}>{formatNumber(data.rollingSharpe.latest)}</dd>
                </div>
                <div>
                  <dt className={mutedText}>Sharpe glissant (min/max/moy)</dt>
                  <dd className={metricValue}>
                    {formatNumber(data.rollingSharpe.min)} / {formatNumber(data.rollingSharpe.max)}{' '}
                    / {formatNumber(data.rollingSharpe.average)}
                  </dd>
                </div>
                <div>
                  <dt className={mutedText}>DD glissant (dernier / pire)</dt>
                  <dd className={metricValue}>
                    {formatPercent(data.rollingMaxDrawdown.latest)} /{' '}
                    {formatPercent(data.rollingMaxDrawdown.worst)}
                  </dd>
                </div>
                <div>
                  <dt className={mutedText}>Gain moyen</dt>
                  <dd className={metricValue}>{formatCurrency(data.averageWin)}</dd>
                </div>
                <div>
                  <dt className={mutedText}>Perte moyenne</dt>
                  <dd className={metricValue}>{formatCurrency(data.averageLoss)}</dd>
                </div>
              </MetricList>

              <div className={assumptionsNote}>
                <p>
                  Hypothèses : annualisation ={' '}
                  {data.assumptions.annualizationPeriods === null
                    ? 'inconnue'
                    : `${data.assumptions.annualizationPeriods} périodes/an`}
                  , taux sans risque = {(data.assumptions.riskFreeRate * 100).toFixed(2)}%, VaR
                  confiance = {Math.round(data.assumptions.varConfidence * 100)}%, fenêtre glissante
                  = {data.assumptions.rollingWindow ?? 'n/a'}.
                </p>
                <styled.p mt="1">
                  VaR / CVaR sont des estimations historiques, pas des garanties de pire cas.
                </styled.p>
              </div>

              {data.warnings.length > 0 ? (
                <styled.ul spaceY="1" fontSize="11px" color="warning">
                  {data.warnings.map(warning => (
                    <li key={warning}>{warning}</li>
                  ))}
                </styled.ul>
              ) : null}
            </>
          )}
        </styled.div>
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
    enabled: mode !== undefined && queryEnabled && Number.isFinite(strategyId) && strategyId > 0,
  })

  if (!learningLoopEnabled) {
    return null
  }

  const data = query.data
  const isLoading = query.isPending && open
  const isError = query.isError

  return (
    <div className={cardRoot}>
      <div className={headerRow}>
        <styled.div display="flex" flexWrap="wrap" alignItems="center" gap="2" textStyle="xs">
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
            <span
              className={cx(
                gradeLabel,
                toneText({ tone: SCORECARD_GRADE_TONE[data.evidenceGrade] })
              )}
            >
              {SCORECARD_GRADE_LABEL_FR[data.evidenceGrade]}
            </span>
          ) : null}
        </styled.div>
        <span className={footnote}>Ne constitue pas une recommandation.</span>
      </div>

      {open ? (
        <styled.div mt="3" spaceY="3">
          {isLoading ? (
            <styled.p textStyle="xs" color="muted.foreground">
              Chargement du scorecard…
            </styled.p>
          ) : null}

          {isError ? (
            <styled.p textStyle="xs" color="warning">
              Scorecard indisponible : {toErrorMessage(query.error)}
            </styled.p>
          ) : null}

          {data ? (
            <>
              <styled.div
                display="grid"
                gap="2"
                textStyle="xs"
                sm={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
              >
                <div className={summaryTile}>
                  <p className={mutedText}>Backtests complétés</p>
                  <styled.p fontWeight="medium" color="foreground">
                    {data.summary.totalBacktests} ({data.summary.totalTrades} trades)
                  </styled.p>
                </div>
                <div className={summaryTile}>
                  <p className={mutedText}>Run le plus récent</p>
                  <styled.p fontWeight="medium" color="foreground">
                    {data.summary.latestRunAt ? data.summary.latestRunAt.slice(0, 10) : 'Aucun'}
                  </styled.p>
                </div>
              </styled.div>

              <div className={insetBlock}>
                <p className={sectionLabel}>Métriques (run le plus récent)</p>
                <MetricList mt="1">
                  <div>
                    <dt className={mutedText}>Win rate</dt>
                    <dd className={metricValue}>{formatPct(data.metrics.winRate)}</dd>
                  </div>
                  <div>
                    <dt className={mutedText}>Profit factor</dt>
                    <dd className={metricValue}>{formatRatio(data.metrics.profitFactor)}</dd>
                  </div>
                  <div>
                    <dt className={mutedText}>Drawdown max</dt>
                    <dd className={metricValue}>{formatPct(data.metrics.maxDrawdown)}</dd>
                  </div>
                  <div>
                    <dt className={mutedText}>Sharpe</dt>
                    <dd className={metricValue}>{formatRatio(data.metrics.sharpe)}</dd>
                  </div>
                  <div>
                    <dt className={mutedText}>Sortino</dt>
                    <dd className={metricValue}>{formatRatio(data.metrics.sortino)}</dd>
                  </div>
                  <div>
                    <dt className={mutedText}>Walk-forward</dt>
                    <dd className={metricValue}>
                      {data.metrics.walkForwardRuns > 0
                        ? `${data.metrics.walkForwardRuns} run(s)`
                        : 'Aucun'}
                    </dd>
                  </div>
                </MetricList>
                <styled.div mt="2" display="flex" flexWrap="wrap" gap="2" fontSize="11px">
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
                </styled.div>
              </div>

              {/* PR14 — collapsible advanced-metrics subsection. Render only if the response
                  carries the field; null means no completed run with usable data. */}
              <AdvancedMetricsSection data={data.advancedMetrics ?? null} />

              {data.qualityFlags.length > 0 ? (
                <styled.ul spaceY="1" textStyle="xs">
                  {data.qualityFlags.map(flag => (
                    <li
                      key={`${flag.kind}-${flag.message}`}
                      className={toneText({ tone: SCORECARD_FLAG_TONE[flag.severity] })}
                    >
                      {flag.message}
                    </li>
                  ))}
                </styled.ul>
              ) : null}

              {data.caveats.length > 0 ? (
                <styled.ul spaceY="1" fontSize="11px" color="muted.foreground">
                  {data.caveats.map(caveat => (
                    <li key={caveat}>{caveat}</li>
                  ))}
                </styled.ul>
              ) : null}
            </>
          ) : null}
        </styled.div>
      ) : null}
    </div>
  )
}
