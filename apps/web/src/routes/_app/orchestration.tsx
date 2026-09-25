import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Status,
} from '@finance-os/ui/components'
import { RefreshPixelIcon } from '@finance-os/ui/icons/pixel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { SocialOperations } from '@/components/orchestration/social-operations'
import { PageHeader } from '@/components/surfaces/page-header'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { dashboardQueryKeys } from '@/features/dashboard-query-options'
import {
  cancelRefreshRun,
  recoverStaleRuns,
  runFullRefresh,
  runRefreshJob,
} from '@/features/ops-refresh/api'
import { invalidateAndRefetchAfterOpsMutation } from '@/features/ops-refresh/invalidate'
import {
  createOrchestrationJobs,
  describeOrchestrationStatus,
  formatOpsDuration,
  type OrchestrationJobModel,
} from '@/features/ops-refresh/orchestration-view-model'
import { opsRefreshStatusQueryOptionsWithMode } from '@/features/ops-refresh/query-options'
import {
  getRecoveryFeedbackMessage,
  isRefreshStatusActive,
} from '@/features/ops-refresh/view-state'
import { runValuationRefresh } from '@/features/valuation/api'
import { valuationQueryKeys } from '@/features/valuation/query-options'
import { pushToast } from '@/lib/toast-store'
import { useIsMobile } from '@/lib/use-is-mobile'

export const Route = createFileRoute('/_app/orchestration')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return
    await context.queryClient.ensureQueryData(opsRefreshStatusQueryOptionsWithMode({ mode }))
  },
  component: OrchestrationPage,
})

const GROUPS = ['Données', 'Intelligence', 'Calcul'] as const

const statusTone = (state: OrchestrationJobModel['state']) => {
  if (state === 'success') return 'positive' as const
  if (state === 'active') return 'progress' as const
  if (state === 'attention') return 'attention' as const
  if (state === 'failure') return 'negative' as const
  return 'neutral' as const
}

const formatRunTime = (value: string | null) => {
  if (!value) return 'Indisponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Indisponible'
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function OrchestrationPage() {
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isAdmin = authViewState === 'admin'
  const mode: AuthMode | undefined = isAdmin
    ? 'admin'
    : authViewState === 'demo'
      ? 'demo'
      : undefined
  const statusQuery = useQuery(opsRefreshStatusQueryOptionsWithMode({ mode }))
  const latestOperation = statusQuery.data?.latestRun ?? null
  const latestOperationId = latestOperation?.operationId ?? null
  const operationActive = isRefreshStatusActive(latestOperation?.status)
  const refreshAfterMutation = () => invalidateAndRefetchAfterOpsMutation(queryClient)

  const fullMutation = useMutation({
    mutationFn: runFullRefresh,
    onSuccess: async () => {
      setFeedback('L’ensemble des jobs a terminé son exécution.')
      await refreshAfterMutation()
    },
    onError: () => setFeedback('Le lancement global n’a pas pu démarrer.'),
  })
  const jobMutation = useMutation({
    mutationFn: (jobId: string) => runRefreshJob(jobId),
    onSuccess: async result => {
      setFeedback(
        result.status === 'failed' || result.status === 'timed_out'
          ? 'Le job n’a pas abouti.'
          : 'Le job a répondu.'
      )
      await refreshAfterMutation()
    },
    onError: () => setFeedback('Le job n’a pas pu démarrer.'),
  })
  const recoverMutation = useMutation({
    mutationFn: () => recoverStaleRuns(),
    onSuccess: async result => {
      setFeedback(getRecoveryFeedbackMessage(result))
      await refreshAfterMutation()
    },
    onError: () => setFeedback('La récupération n’a pas pu démarrer.'),
  })
  const cancelMutation = useMutation({
    mutationFn: (operationId: string) => cancelRefreshRun(operationId),
    onSuccess: async () => {
      setFeedback('L’exécution a été annulée.')
      await refreshAfterMutation()
    },
    onError: () => setFeedback('L’annulation n’a pas abouti.'),
  })
  const valuationDryRunMutation = useMutation({
    mutationFn: () => runValuationRefresh({ dryRun: true }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: valuationQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
      ])
      pushToast({
        title: 'Test de valorisation terminé',
        description: 'Aucun instantané n’a été enregistré.',
        tone: 'success',
      })
    },
    onError: () => pushToast({ title: 'Test de valorisation impossible', tone: 'error' }),
  })

  const busy = fullMutation.isPending || jobMutation.isPending || operationActive
  const jobs = createOrchestrationJobs({
    status: statusQuery.data,
    ...(jobMutation.data ? { currentResult: jobMutation.data } : {}),
    isAdmin,
    busy,
  })
  const selectedJob = jobs.find(job => job.id === selectedJobId) ?? null

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Ops"
        icon={<RefreshPixelIcon size={12} />}
        title="Orchestration"
        description="Lancez les jobs manuels et consultez leur dernier résultat."
        actions={
          isAdmin ? (
            <div className="flex flex-wrap gap-2">
              {operationActive && latestOperationId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(latestOperationId)}
                >
                  {cancelMutation.isPending ? 'Annulation' : 'Annuler'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={recoverMutation.isPending || busy}
                  onClick={() => recoverMutation.mutate()}
                >
                  {recoverMutation.isPending ? 'Récupération' : 'Récupérer'}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => fullMutation.mutate()}
              >
                {fullMutation.isPending ? 'En cours' : 'Tout lancer'}
              </Button>
            </div>
          ) : null
        }
      />

      {authViewState === 'demo' ? (
        <div className="border-y border-border/60 py-3 text-sm text-muted-foreground">
          Lecture seule avec registre de démonstration. Aucun job réel ne peut être lancé.
        </div>
      ) : null}
      {feedback ? (
        <div className="border-y border-border/60 py-3" aria-live="polite">
          <Status tone="neutral" label={feedback} />
        </div>
      ) : null}

      {GROUPS.map(group => {
        const groupedJobs = jobs.filter(job => job.group === group)
        if (groupedJobs.length === 0) return null
        return (
          <section key={group} aria-labelledby={`orchestration-${group}`}>
            <h2
              id={`orchestration-${group}`}
              className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {group}
            </h2>
            <div className="border-y border-border/60">
              {groupedJobs.map(job => {
                const rowPending =
                  jobMutation.isPending &&
                  Boolean(jobMutation.variables && job.memberIds.includes(jobMutation.variables))
                const state = rowPending ? 'active' : job.state
                const label = rowPending ? 'En cours' : job.stateLabel
                return (
                  <div
                    key={job.id}
                    className={`grid items-center gap-3 border-b border-border/50 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] ${state === 'active' ? 'bg-primary/[0.04]' : ''}`}
                  >
                    <button
                      type="button"
                      className="min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                      onClick={() => setSelectedJobId(job.id)}
                      aria-haspopup="dialog"
                    >
                      <span className="text-sm font-medium">{job.label}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {job.lastRunAt || job.durationMs !== null ? (
                          <>
                            <span>{formatRunTime(job.lastRunAt)}</span>
                            <span>{formatOpsDuration(job.durationMs)}</span>
                          </>
                        ) : (
                          <span>Jamais exécuté</span>
                        )}
                      </span>
                    </button>
                    <Status
                      tone={statusTone(state)}
                      label={label}
                      className="sm:justify-self-end"
                    />
                    <div className="sm:min-w-24 sm:justify-self-end">
                      <JobAction
                        job={job}
                        disabled={rowPending || busy}
                        onRun={jobId => jobMutation.mutate(jobId)}
                        onDetails={() => setSelectedJobId(job.id)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      <Drawer open={selectedJob !== null} onOpenChange={open => !open && setSelectedJobId(null)}>
        <DrawerContent side={isMobile ? 'bottom' : 'right'}>
          {selectedJob ? (
            <>
              <DrawerHeader>
                <div className="flex items-center justify-between gap-3">
                  <DrawerTitle>{selectedJob.label}</DrawerTitle>
                  <Status tone={statusTone(selectedJob.state)} label={selectedJob.stateLabel} />
                </div>
                <DrawerDescription>{selectedJob.detail}</DrawerDescription>
              </DrawerHeader>
              <div className="space-y-6 px-5 pb-6">
                <div className="grid grid-cols-2 gap-4 border-y border-border/60 py-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Dernière exécution
                    </p>
                    <p className="mt-2 text-sm">{formatRunTime(selectedJob.lastRunAt)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Durée
                    </p>
                    <p className="mt-2 font-financial text-sm">
                      {formatOpsDuration(selectedJob.durationMs)}
                    </p>
                  </div>
                </div>

                {selectedJob.id === 'social' && isAdmin ? <SocialOperations /> : null}
                {selectedJob.id === 'asset-valuation' && isAdmin ? (
                  <section className="border-t border-border/60 pt-4">
                    <h3 className="text-sm font-semibold">Test de valorisation</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Calcule la couverture sans enregistrer d’instantané.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      disabled={valuationDryRunMutation.isPending || busy}
                      onClick={() => valuationDryRunMutation.mutate()}
                    >
                      {valuationDryRunMutation.isPending
                        ? 'Test en cours'
                        : 'Tester sans enregistrer'}
                    </Button>
                  </section>
                ) : null}
                {selectedJob.id === 'asset-valuation' ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/sante">Voir la couverture dans Santé</Link>
                  </Button>
                ) : null}
                {selectedJob.action.kind === 'navigate' ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to={selectedJob.action.to}>Gérer la connexion</Link>
                  </Button>
                ) : null}

                <section aria-labelledby="job-history-title">
                  <h3
                    id="job-history-title"
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Résultats récents
                  </h3>
                  {selectedJob.history.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">Aucun résultat connu</p>
                  ) : (
                    <div className="mt-2 border-y border-border/60">
                      {selectedJob.history.slice(0, 4).map(run => {
                        const described = describeOrchestrationStatus(run.status, true)
                        return (
                          <div
                            key={`${run.jobId}-${run.finishedAt}-${run.durationMs}`}
                            className="flex items-center justify-between gap-3 border-b border-border/50 py-3 last:border-b-0"
                          >
                            <div>
                              <p className="text-xs">{formatRunTime(run.finishedAt)}</p>
                              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                                {formatOpsDuration(run.durationMs)}
                              </p>
                            </div>
                            <Status tone={statusTone(described.state)} label={described.label} />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function JobAction({
  job,
  disabled,
  onRun,
  onDetails,
}: {
  job: OrchestrationJobModel
  disabled: boolean
  onRun: (jobId: string) => void
  onDetails: () => void
}) {
  const action = job.action
  if (action.kind === 'run') {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onRun(action.jobId)}
      >
        {action.label}
      </Button>
    )
  }
  if (action.kind === 'navigate') {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link to={action.to}>{action.label}</Link>
      </Button>
    )
  }
  if (action.kind === 'details') {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={onDetails}>
        {action.label}
      </Button>
    )
  }
  return null
}
