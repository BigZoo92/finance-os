// Eval Scorecard widget. PR5 introduced the read-only scorecard; PR9 adds the trend groups
// (quality / safety / economics) sourced from the new /dashboard/advisor/evals/trends endpoint.
//
// Trends are enrichment, never load-bearing. If the trends query is disabled (flag off) or fails,
// the scorecard still renders the deterministic case-count groupings. We never fabricate trends:
// `insufficient_data` is surfaced explicitly when fewer than two historical runs exist.

import { useQuery } from '@tanstack/react-query'
import { Badge } from '@finance-os/ui/components'
import { Panel } from '@/components/surfaces/panel'
import type { AuthMode } from '@/features/auth-types'
import {
  dashboardAdvisorEvalsQueryOptionsWithMode,
  dashboardAdvisorEvalsTrendsQueryOptionsWithMode,
} from '@/features/dashboard-query-options'
import { getLearningLoopUiFlags } from '@/features/learning-loop-config'
import {
  buildEvalScorecard,
  buildEvalScorecardTrends,
  TREND_STATUS_LABEL,
  type EvalTrendsCategoryView,
  type EvalTrendsGroupView,
  type EvalTrendsLoadState,
} from '@/features/learning-loop-view-model'

interface EvalScorecardProps {
  mode: AuthMode
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'Complet',
  degraded: 'Dégradé',
  running: 'En cours',
  failed: 'Échec',
  skipped: 'Ignoré',
  queued: 'En attente',
}

const STATUS_TONE: Record<string, 'success' | 'warn' | 'info' | 'error'> = {
  completed: 'success',
  degraded: 'warn',
  running: 'info',
  failed: 'error',
  skipped: 'info',
  queued: 'info',
}

const toneClass = (tone: 'success' | 'warn' | 'info' | 'error'): string => {
  switch (tone) {
    case 'success':
      return 'text-emerald-500'
    case 'warn':
      return 'text-amber-500'
    case 'info':
      return 'text-sky-500'
    case 'error':
      return 'text-destructive'
  }
}

const TREND_STATUS_TONE: Record<EvalTrendsCategoryView['status'], string> = {
  improving: 'text-emerald-500',
  stable: 'text-sky-500',
  regressing: 'text-destructive',
  insufficient_data: 'text-muted-foreground',
}

const formatPct = (value: number | null): string =>
  value === null ? '—' : `${Math.round(value * 100)} %`

const formatDelta = (value: number | null): string => {
  if (value === null) return '—'
  const pct = Math.round(value * 100)
  if (pct === 0) return '±0 pt'
  return pct > 0 ? `+${pct} pt` : `${pct} pt`
}

function TrendGroupCard({ group }: { group: EvalTrendsGroupView }) {
  return (
    <div className="rounded-xl border border-border/45 bg-surface-1/45 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tendance {group.label.toLowerCase()}
        </p>
        <span className={`text-xs font-medium ${TREND_STATUS_TONE[group.status]}`}>
          {TREND_STATUS_LABEL[group.status]}
        </span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">{formatPct(group.latestPassRate)}</span>
        <span className="text-xs text-muted-foreground">
          précédent {formatPct(group.previousPassRate)} · {formatDelta(group.delta)}
        </span>
      </div>
      {group.categories.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs">
          {group.categories.map(cat => (
            <li key={cat.category} className="flex items-center justify-between gap-2">
              <span className="text-foreground">{cat.category}</span>
              <span className={TREND_STATUS_TONE[cat.status]}>
                {TREND_STATUS_LABEL[cat.status]} · {formatDelta(cat.delta)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Aucun cas dans ce groupe.</p>
      )}
    </div>
  )
}

function TrendBadge({ state }: { state: EvalTrendsLoadState }) {
  switch (state.kind) {
    case 'flag_disabled':
      return <Badge variant="outline">Tendances : différé</Badge>
    case 'loading':
      return <Badge variant="outline">Tendances en chargement…</Badge>
    case 'unavailable':
      return <Badge variant="outline">Tendances indisponibles</Badge>
    case 'empty':
      return <Badge variant="outline">Données insuffisantes</Badge>
    case 'ready':
      return <Badge variant="outline">Basé sur les evals déterministes</Badge>
  }
}

export function EvalScorecard({ mode }: EvalScorecardProps) {
  const { data } = useQuery(dashboardAdvisorEvalsQueryOptionsWithMode({ mode }))
  const flagEnabled = getLearningLoopUiFlags().enabled
  const trendsQuery = useQuery(
    dashboardAdvisorEvalsTrendsQueryOptionsWithMode({ mode, learningLoopEnabled: flagEnabled })
  )
  const view = buildEvalScorecard(data)
  const trendsState = buildEvalScorecardTrends({
    flagEnabled,
    data: trendsQuery.data,
    isError: trendsQuery.isError,
    isPending: trendsQuery.isPending,
  })

  return (
    <Panel
      title="Garde-fous qualité"
      description="Évaluations déterministes. Aucun LLM-as-judge."
      icon={<span aria-hidden="true">⊟</span>}
      tone="plain"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">Déterministe</Badge>
          <Badge variant="outline">Aucun LLM-as-judge</Badge>
          <TrendBadge state={trendsState} />
        </div>

        {view.run.status ? (
          <div className="rounded-xl border border-border/45 bg-surface-1/45 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-foreground">Dernier run</p>
              <span className={`font-medium ${toneClass(STATUS_TONE[view.run.status] ?? 'info')}`}>
                {STATUS_LABEL[view.run.status] ?? view.run.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {view.run.passedCases} / {view.run.totalCases} cas réussis · {view.run.failedCases}{' '}
              échec
              {view.run.failedCases > 1 ? 's' : ''}
            </p>
            {view.run.failedCaseDetails.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {view.run.failedCaseDetails.slice(0, 5).map(detail => (
                  <li key={detail.caseId} className="rounded-md bg-background/50 px-2 py-1">
                    <p className="font-medium text-foreground">
                      {detail.caseId} · {detail.category}
                    </p>
                    {detail.failedExpectations.length > 0 ? (
                      <p className="mt-0.5 text-[11px] leading-snug">
                        {detail.failedExpectations.slice(0, 3).join(' · ')}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : view.run.failedCaseKeys.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Cas échoués : {view.run.failedCaseKeys.join(', ')}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Aucune exécution récente. Lancement déclenché par le mission run.
          </p>
        )}

        {trendsState.kind === 'ready' ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {trendsState.groups.map(group => (
              <TrendGroupCard key={group.group} group={group} />
            ))}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {view.groups.map(group => (
              <div
                key={group.group}
                className="rounded-xl border border-border/45 bg-background/40 p-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                {group.rows.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs">
                    {group.rows.map(row => (
                      <li key={row.category} className="flex items-center justify-between gap-2">
                        <span className="text-foreground">{row.category}</span>
                        <span className="text-muted-foreground">{row.caseCount} cas</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Aucun cas dans ce groupe.</p>
                )}
              </div>
            ))}
          </div>
        )}

        {trendsState.kind === 'ready' && trendsState.caveats.length > 0 ? (
          <ul className="space-y-1 text-[11px] text-muted-foreground">
            {trendsState.caveats.map(c => (
              <li key={c}>· {c}</li>
            ))}
          </ul>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Cas live ignorés sans contexte : transactions, recommandations, signaux & coûts
          requièrent un run advisor récent.
        </p>
      </div>
    </Panel>
  )
}
