// PR15A — Advisor Behavior Analytics card.
//
// Compact read-only visual over the journal + outcomes + post-mortem aggregations. Purely
// retrospective, never recommends an action, never shows freeNote text. Mounted on `/ia`
// behind the existing `VITE_LEARNING_LOOP_UI_ENABLED` flag.

import { useQuery } from '@tanstack/react-query'
import { Badge } from '@finance-os/ui/components'
import { Panel } from '@/components/surfaces/panel'
import type { AuthMode } from '@/features/auth-types'
import { dashboardAdvisorBehaviorAnalyticsQueryOptionsWithMode } from '@/features/dashboard-query-options'
import type {
  DashboardAdvisorBehaviorDecisionBreakdownEntry,
  DashboardAdvisorBehaviorLearningSignal,
  DashboardAdvisorBehaviorReasonCodeBreakdownEntry,
} from '@/features/dashboard-types'
import { toErrorMessage } from '@/lib/format'

interface BehaviorAnalyticsCardProps {
  mode: AuthMode
  learningLoopEnabled: boolean
}

const DECISION_LABEL: Record<
  DashboardAdvisorBehaviorDecisionBreakdownEntry['decision'],
  string
> = {
  accepted: 'Acceptées',
  rejected: 'Rejetées',
  deferred: 'Différées',
  ignored: 'Ignorées',
}

const SIGNAL_LABEL: Record<DashboardAdvisorBehaviorLearningSignal['kind'], string> = {
  low_outcome_coverage: 'Couverture des outcomes faible',
  over_deferral: 'Différé fréquent',
  high_negative_acceptance: 'Acceptations à outcome négatif élevé',
  ignored_followups: 'Décisions ignorées avec outcome positif',
  positive_rejections: 'Rejets à outcome positif',
  insufficient_sample: 'Échantillon insuffisant',
}

const SIGNAL_TONE: Record<DashboardAdvisorBehaviorLearningSignal['severity'], string> = {
  info: 'text-sky-500',
  warning: 'text-amber-500',
  danger: 'text-destructive',
}

const formatPct = (value: number | null): string =>
  value === null ? '—' : `${Math.round(value * 100)} %`

const formatRate = (value: number | null): string =>
  value === null ? '—' : `${(value * 100).toFixed(0)}%`

export function BehaviorAnalyticsCard({ mode, learningLoopEnabled }: BehaviorAnalyticsCardProps) {
  const query = useQuery(
    dashboardAdvisorBehaviorAnalyticsQueryOptionsWithMode({ mode, learningLoopEnabled })
  )
  if (!learningLoopEnabled) return null

  const data = query.data
  return (
    <Panel
      title="Analyse comportementale"
      description="Basé sur le journal de décisions. Ne constitue pas une recommandation."
      icon={<span aria-hidden="true">⌗</span>}
      tone="plain"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">Paper only</Badge>
          <Badge variant="outline">Rétrospectif</Badge>
          <Badge variant="outline">Aucune recommandation</Badge>
          {data ? (
            <span className="text-[11px] text-muted-foreground">
              Fenêtre : {data.windowDays} jours · {data.summary.totalDecisions} décisions
            </span>
          ) : null}
        </div>

        {query.isPending && !data ? (
          <p className="text-xs text-muted-foreground">Chargement de l&apos;analyse…</p>
        ) : null}

        {query.isError ? (
          <p className="text-xs text-amber-500">
            Analyse indisponible : {toErrorMessage(query.error)}
          </p>
        ) : null}

        {data ? (
          <>
            {data.summary.totalDecisions === 0 ? (
              <p className="rounded-md border border-dashed border-border/45 bg-surface-1/35 px-3 py-2 text-xs text-muted-foreground">
                Échantillon insuffisant — aucune décision sur la fenêtre demandée.
              </p>
            ) : (
              <>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-md border border-border/40 bg-background/40 px-3 py-2">
                    <p className="text-muted-foreground">Couverture des outcomes</p>
                    <p className="font-medium text-foreground">
                      {formatPct(data.summary.outcomeCoverageRate)}{' '}
                      <span className="text-muted-foreground">
                        ({data.summary.decisionsWithOutcomes} / {data.summary.totalDecisions})
                      </span>
                    </p>
                  </div>
                  <div className="rounded-md border border-border/40 bg-background/40 px-3 py-2">
                    <p className="text-muted-foreground">Mix de décisions</p>
                    <p className="font-medium text-foreground">
                      A {formatRate(data.summary.acceptedRate)} · R{' '}
                      {formatRate(data.summary.rejectedRate)} · D{' '}
                      {formatRate(data.summary.deferredRate)} · I{' '}
                      {formatRate(data.summary.ignoredRate)}
                    </p>
                  </div>
                </div>

                <div className="rounded-md border border-border/40 bg-background/40 p-3 text-xs">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Décisions × outcomes
                  </p>
                  <ul className="mt-2 space-y-1">
                    {data.decisionBreakdown.map(entry => (
                      <li
                        key={entry.decision}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="text-foreground">
                          {DECISION_LABEL[entry.decision]}{' '}
                          <span className="text-muted-foreground">
                            ({entry.count} · {formatRate(entry.rate)})
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          + {entry.outcomeMix.positive} · − {entry.outcomeMix.negative} · ~{' '}
                          {entry.outcomeMix.neutral} · ?{' '}
                          {entry.outcomeMix.unknown}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {data.reasonCodeBreakdown.length > 0 ? (
                  <div className="rounded-md border border-border/40 bg-background/40 p-3 text-xs">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Codes de raison
                    </p>
                    <ul className="mt-2 space-y-1">
                      {data.reasonCodeBreakdown.slice(0, 8).map(
                        (entry: DashboardAdvisorBehaviorReasonCodeBreakdownEntry) => (
                          <li
                            key={entry.reasonCode}
                            className="flex flex-wrap items-center justify-between gap-2"
                          >
                            <span className="text-foreground">{entry.reasonCode}</span>
                            <span className="text-muted-foreground">
                              {entry.count} · + {entry.positiveOutcomes} · −{' '}
                              {entry.negativeOutcomes} · ? {entry.unknownOutcomes}
                            </span>
                            {entry.caution ? (
                              <span className="basis-full text-amber-500">· {entry.caution}</span>
                            ) : null}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                ) : null}
              </>
            )}

            {data.learningSignals.length > 0 ? (
              <ul className="space-y-1 text-xs">
                {data.learningSignals.map(signal => (
                  <li key={signal.kind} className={SIGNAL_TONE[signal.severity]}>
                    · <span className="font-medium">{SIGNAL_LABEL[signal.kind]}</span> —{' '}
                    {signal.message}
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
    </Panel>
  )
}
