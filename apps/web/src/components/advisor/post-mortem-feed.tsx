// PR5 — Advisor Post-Mortem feed.
//
// Read-only feed of persisted post-mortem rows + an admin-only run button. Calls
// /dashboard/advisor/post-mortem and /dashboard/advisor/post-mortem/run.
// All wording is advisory-only / lessons-only — never a directive.

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button } from '@finance-os/ui/components'
import { Panel } from '@/components/surfaces/panel'
import type { AuthMode } from '@/features/auth-types'
import { postAdvisorPostMortemRun } from '@/features/dashboard-api'
import {
  LEARNING_LOOP_INVALIDATION_KEYS,
  dashboardAdvisorPostMortemsQueryOptionsWithMode,
} from '@/features/dashboard-query-options'
import type { DashboardAdvisorPostMortemRunResponse } from '@/features/dashboard-types'
import {
  buildPostMortemFeed,
  describePostMortemRunStatus,
  summarizePostMortemRunResponse,
} from '@/features/learning-loop-view-model'
import { formatDateTime, toErrorMessage } from '@/lib/format'

interface PostMortemFeedProps {
  mode: AuthMode
}

const STATUS_BADGE: Record<string, { label: string; variant: 'secondary' | 'outline' | 'destructive' }> = {
  completed: { label: 'Terminé', variant: 'secondary' },
  pending: { label: 'En attente', variant: 'outline' },
  skipped: { label: 'Ignoré', variant: 'outline' },
  failed: { label: 'Échec', variant: 'destructive' },
}

export function PostMortemFeed({ mode }: PostMortemFeedProps) {
  const queryClient = useQueryClient()
  const { data } = useQuery(dashboardAdvisorPostMortemsQueryOptionsWithMode({ mode }))
  const [lastRun, setLastRun] = useState<DashboardAdvisorPostMortemRunResponse | null>(null)
  const isAdmin = mode === 'admin'

  const runMutation = useMutation({
    mutationFn: () => postAdvisorPostMortemRun('manual'),
    onSuccess: async response => {
      setLastRun(response)
      await Promise.all(
        LEARNING_LOOP_INVALIDATION_KEYS.afterPostMortemRun().map(queryKey =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
    },
  })

  const feed = buildPostMortemFeed(data?.items)
  const lastRunSummary = lastRun ? summarizePostMortemRunResponse(lastRun) : null
  const lastRunTone = lastRunSummary
    ? lastRunSummary.view.tone === 'success'
      ? 'text-emerald-500'
      : lastRunSummary.view.tone === 'warn'
        ? 'text-amber-500'
        : lastRunSummary.view.tone === 'error'
          ? 'text-destructive'
          : 'text-sky-500'
    : ''

  return (
    <Panel
      title="Post-Mortems"
      description="Analyses rétrospectives advisory-only. Pas de directive d'exécution."
      icon={<span aria-hidden="true">⌘</span>}
      tone="plain"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">Advisory-only</Badge>
          <Badge variant="outline">Aucune action n&apos;est exécutée</Badge>
          {isAdmin ? (
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={runMutation.isPending}
              onClick={() => runMutation.mutate()}
            >
              {runMutation.isPending ? 'Lancement…' : 'Lancer une analyse'}
            </Button>
          ) : (
            <span className="text-muted-foreground">Lancement réservé au mode admin.</span>
          )}
        </div>

        {lastRunSummary ? (
          <div className="rounded-xl border border-border/45 bg-surface-1/45 px-3 py-2 text-sm">
            <p className={`font-medium ${lastRunTone}`}>{lastRunSummary.view.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{lastRunSummary.view.detail}</p>
            {lastRunSummary.meta.length > 0 ? (
              <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                {lastRunSummary.meta.map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {runMutation.isError ? (
          <p className="text-xs text-destructive">
            Échec de l&apos;analyse: {toErrorMessage(runMutation.error)}
          </p>
        ) : null}

        {feed.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/45 bg-surface-1/35 px-4 py-6 text-center text-sm text-muted-foreground">
            Aucune analyse rétrospective enregistrée pour l&apos;instant.
          </p>
        ) : (
          <ul className="space-y-3">
            {feed.map(row => {
              const statusBadge = STATUS_BADGE[row.status] ?? { label: row.status, variant: 'outline' as const }
              return (
                <li
                  key={row.id}
                  className="rounded-xl border border-border/50 bg-background/40 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">
                      {row.recommendationKey ?? `Analyse #${row.id}`}
                    </p>
                    <div className="flex items-center gap-1">
                      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                      {row.graphIngestDeferred ? (
                        <Badge variant="outline">Graph ingest différé</Badge>
                      ) : null}
                    </div>
                  </div>
                  {row.evaluatedAt ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Évalué le {formatDateTime(row.evaluatedAt)}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm leading-relaxed text-foreground/90">{row.summary}</p>
                  {row.calibrationFrom && row.calibrationTo ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Confiance recalibrée : {row.calibrationFrom} → {row.calibrationTo}
                    </p>
                  ) : null}
                  {row.learningActions.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {row.learningActions.map(action => (
                        <li
                          key={action.title}
                          className="rounded-md bg-surface-1/35 px-2 py-1 text-xs text-foreground/90"
                        >
                          <p className="font-medium">{action.title}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {action.description}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {row.errorCode ? (
                    <p className="mt-2 text-xs text-destructive">
                      Code d&apos;erreur : {row.errorCode}
                    </p>
                  ) : null}
                  {row.skippedReason ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Ignoré : {row.skippedReason}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Panel>
  )
}

// Tone descriptor exposed for downstream consumers; kept here so the file is self-contained.
export { describePostMortemRunStatus }
