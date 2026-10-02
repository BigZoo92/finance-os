import { css, cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
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
import { createFileRoute, Link } from '@tanstack/react-router'
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

const demoNotice = css({
  borderYWidth: '1px',
  borderColor: 'border/60',
  py: '3',
  textStyle: 'sm',
  color: 'muted.foreground',
})

const feedbackBar = css({ borderYWidth: '1px', borderColor: 'border/60', py: '3' })

const groupTitle = css({
  mb: '2',
  fontFamily: 'mono',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: 'muted.foreground',
})

const eyebrow = css({
  fontFamily: 'mono',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: 'muted.foreground',
})

const jobRow = cva({
  base: {
    display: 'grid',
    alignItems: 'center',
    gap: '3',
    borderBottomWidth: '1px',
    borderColor: 'border/50',
    py: '4',
    _last: { borderBottomWidth: '0' },
    sm: { gridTemplateColumns: 'minmax(0, 1fr) auto auto' },
  },
  variants: {
    active: {
      true: { bg: 'primary/4' },
      false: {},
    },
  },
})

const jobTrigger = css({
  minW: '0',
  textAlign: 'left',
  outlineStyle: 'none',
  _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
})

const jobStatus = css({ sm: { justifySelf: 'flex-end' } })

const durationValue = css({ mt: '2', textStyle: 'financial', fontSize: 'sm', lineHeight: 'sm' })

const historyRow = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '3',
  borderBottomWidth: '1px',
  borderColor: 'border/50',
  py: '3',
  _last: { borderBottomWidth: '0' },
})

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
    <styled.div spaceY="7">
      <PageHeader
        eyebrow="Ops"
        icon={<RefreshPixelIcon size={12} />}
        title="Orchestration"
        description="Lancez les jobs manuels et consultez leur dernier résultat."
        actions={
          isAdmin ? (
            <styled.div display="flex" flexWrap="wrap" gap="2">
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
            </styled.div>
          ) : null
        }
      />

      {authViewState === 'demo' ? (
        <div className={demoNotice}>
          Lecture seule avec registre de démonstration. Aucun job réel ne peut être lancé.
        </div>
      ) : null}
      {feedback ? (
        <div className={feedbackBar} aria-live="polite">
          <Status tone="neutral" label={feedback} />
        </div>
      ) : null}

      {GROUPS.map(group => {
        const groupedJobs = jobs.filter(job => job.group === group)
        if (groupedJobs.length === 0) return null
        return (
          <section key={group} aria-labelledby={`orchestration-${group}`}>
            <h2 id={`orchestration-${group}`} className={groupTitle}>
              {group}
            </h2>
            <styled.div borderYWidth="1px" borderColor="border/60">
              {groupedJobs.map(job => {
                const rowPending =
                  jobMutation.isPending &&
                  Boolean(jobMutation.variables && job.memberIds.includes(jobMutation.variables))
                const state = rowPending ? 'active' : job.state
                const label = rowPending ? 'En cours' : job.stateLabel
                return (
                  <div key={job.id} className={jobRow({ active: state === 'active' })}>
                    <button
                      type="button"
                      className={jobTrigger}
                      onClick={() => setSelectedJobId(job.id)}
                      aria-haspopup="dialog"
                    >
                      <styled.span textStyle="sm" fontWeight="medium">
                        {job.label}
                      </styled.span>
                      <styled.span
                        mt="1"
                        display="flex"
                        flexWrap="wrap"
                        alignItems="center"
                        columnGap="3"
                        rowGap="1"
                        textStyle="xs"
                        color="muted.foreground"
                      >
                        {job.lastRunAt || job.durationMs !== null ? (
                          <>
                            <span>{formatRunTime(job.lastRunAt)}</span>
                            <span>{formatOpsDuration(job.durationMs)}</span>
                          </>
                        ) : (
                          <span>Jamais exécuté</span>
                        )}
                      </styled.span>
                    </button>
                    <Status tone={statusTone(state)} label={label} className={jobStatus} />
                    <styled.div sm={{ minW: '24', justifySelf: 'flex-end' }}>
                      <JobAction
                        job={job}
                        disabled={rowPending || busy}
                        onRun={jobId => jobMutation.mutate(jobId)}
                        onDetails={() => setSelectedJobId(job.id)}
                      />
                    </styled.div>
                  </div>
                )
              })}
            </styled.div>
          </section>
        )
      })}

      <Drawer open={selectedJob !== null} onOpenChange={open => !open && setSelectedJobId(null)}>
        <DrawerContent side={isMobile ? 'bottom' : 'right'}>
          {selectedJob ? (
            <>
              <DrawerHeader>
                <styled.div
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  gap="3"
                >
                  <DrawerTitle>{selectedJob.label}</DrawerTitle>
                  <Status tone={statusTone(selectedJob.state)} label={selectedJob.stateLabel} />
                </styled.div>
                <DrawerDescription>{selectedJob.detail}</DrawerDescription>
              </DrawerHeader>
              <styled.div spaceY="6" px="5" pb="6">
                <styled.div
                  display="grid"
                  gridTemplateColumns="repeat(2, minmax(0, 1fr))"
                  gap="4"
                  borderYWidth="1px"
                  borderColor="border/60"
                  py="4"
                >
                  <div>
                    <p className={eyebrow}>Dernière exécution</p>
                    <styled.p mt="2" textStyle="sm">
                      {formatRunTime(selectedJob.lastRunAt)}
                    </styled.p>
                  </div>
                  <div>
                    <p className={eyebrow}>Durée</p>
                    <p className={durationValue}>{formatOpsDuration(selectedJob.durationMs)}</p>
                  </div>
                </styled.div>

                {selectedJob.id === 'social' && isAdmin ? <SocialOperations /> : null}
                {selectedJob.id === 'asset-valuation' && isAdmin ? (
                  <styled.section borderTopWidth="1px" borderColor="border/60" pt="4">
                    <styled.h3 textStyle="sm" fontWeight="semibold">
                      Test de valorisation
                    </styled.h3>
                    <styled.p mt="1" textStyle="xs" color="muted.foreground">
                      Calcule la couverture sans enregistrer d’instantané.
                    </styled.p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      mt="3"
                      disabled={valuationDryRunMutation.isPending || busy}
                      onClick={() => valuationDryRunMutation.mutate()}
                    >
                      {valuationDryRunMutation.isPending
                        ? 'Test en cours'
                        : 'Tester sans enregistrer'}
                    </Button>
                  </styled.section>
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
                  <h3 id="job-history-title" className={eyebrow}>
                    Résultats récents
                  </h3>
                  {selectedJob.history.length === 0 ? (
                    <styled.p mt="3" textStyle="sm" color="muted.foreground">
                      Aucun résultat connu
                    </styled.p>
                  ) : (
                    <styled.div mt="2" borderYWidth="1px" borderColor="border/60">
                      {selectedJob.history.slice(0, 4).map(run => {
                        const described = describeOrchestrationStatus(run.status, true)
                        return (
                          <div
                            key={`${run.jobId}-${run.finishedAt}-${run.durationMs}`}
                            className={historyRow}
                          >
                            <div>
                              <styled.p textStyle="xs">{formatRunTime(run.finishedAt)}</styled.p>
                              <styled.p
                                mt="1"
                                fontFamily="mono"
                                fontSize="10px"
                                color="muted.foreground"
                              >
                                {formatOpsDuration(run.durationMs)}
                              </styled.p>
                            </div>
                            <Status tone={statusTone(described.state)} label={described.label} />
                          </div>
                        )
                      })}
                    </styled.div>
                  )}
                </section>
              </styled.div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </styled.div>
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
