import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@finance-os/ui/components'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import {
  opsRefreshStatusQueryOptionsWithMode,
  opsRefreshQueryKeys,
} from '@/features/ops-refresh/query-options'
import {
  cancelRefreshRun,
  recoverStaleRuns,
  runFullRefresh,
  runRefreshJob,
} from '@/features/ops-refresh/api'
import type { RefreshJobDefinition, RefreshJobStatus } from '@/features/ops-refresh/types'
import { PageHeader } from '@/components/surfaces/page-header'
import { StatusDot } from '@/components/surfaces/status-dot'
import { formatDateTime } from '@/lib/format'

export const Route = createFileRoute('/_app/orchestration')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) {
      return
    }
    await context.queryClient.ensureQueryData(opsRefreshStatusQueryOptionsWithMode({ mode }))
  },
  component: OrchestrationPage,
})

/**
 * Status taxonomy (must match `RefreshJobStatus` from
 * apps/api/src/routes/ops/refresh-registry.ts). Each status maps to:
 *
 *   - a `tone` (visual variant: positive / warning / destructive / outline / muted)
 *   - a `label` (short human FR string for the badge)
 *   - whether the row should expose a "Recover stale" affordance
 */
type StatusDescriptor = {
  tone: 'positive' | 'warning' | 'destructive' | 'outline'
  label: string
}

const STATUS_DESCRIPTORS: Record<string, StatusDescriptor> = {
  success: { tone: 'positive', label: 'succès' },
  pending: { tone: 'outline', label: 'planifié' },
  disabled: { tone: 'outline', label: 'désactivé' },
  completed: { tone: 'positive', label: 'succès' },
  partial: { tone: 'warning', label: 'partiel' },
  partial_success: { tone: 'warning', label: 'partiel' },
  degraded: { tone: 'warning', label: 'dégradé' },
  running: { tone: 'warning', label: 'en cours' },
  queued: { tone: 'warning', label: 'en file' },
  failed: { tone: 'destructive', label: 'échec' },
  timed_out: { tone: 'destructive', label: 'timeout' },
  cancelled: { tone: 'destructive', label: 'annulé' },
  skipped: { tone: 'outline', label: 'ignoré' },
  skipped_disabled: { tone: 'outline', label: 'désactivé' },
  skipped_missing_config: { tone: 'warning', label: 'config manquante' },
  skipped_budget: { tone: 'warning', label: 'budget épuisé' },
  skipped_dependency_failed: { tone: 'outline', label: 'dép. échec' },
}

const describeStatus = (status: string | null | undefined): StatusDescriptor => {
  if (!status) return { tone: 'outline', label: '—' }
  return STATUS_DESCRIPTORS[status] ?? { tone: 'outline', label: status }
}

const badgeVariantFromTone = (tone: StatusDescriptor['tone']) => {
  switch (tone) {
    case 'positive':
      return 'positive' as const
    case 'warning':
      return 'warning' as const
    case 'destructive':
      return 'destructive' as const
    default:
      return 'outline' as const
  }
}

const domainLabel: Record<RefreshJobDefinition['domain'], string> = {
  banking: 'Banque',
  transactions: 'Transactions',
  investments: 'Investissements',
  news: 'News',
  markets: 'Marchés',
  social: 'Social',
  advisor: 'Advisor',
}

const stepKeyByJobId: Partial<Record<string, string>> = {
  powens: 'personal_sync',
  ibkr: 'ibkr_sync',
  'binance-crypto': 'binance_sync',
  'market-data': 'market_refresh',
  'advisor-context': 'advisor_run',
  'news-finance': 'news_refresh',
  'news-crypto': 'news_refresh',
}

const findLatestStepForJob = (
  latest: NonNullable<
    import('@/features/ops-refresh/types').RefreshStatusResponse['latestRun']
  > | null,
  job: RefreshJobDefinition
) => {
  const expectedStepKey = stepKeyByJobId[job.id]
  return latest?.steps.find(item => {
    if (expectedStepKey) {
      return item.stepKey === expectedStepKey
    }
    return job.domain === 'news' && item.stepKey === 'news_refresh'
  })
}

type StatusFilter = 'all' | 'failed' | 'running' | 'missing_config' | 'success'

const matchesFilter = (
  filter: StatusFilter,
  job: RefreshJobDefinition,
  stepStatus: string | undefined
) => {
  switch (filter) {
    case 'all':
      return true
    case 'failed':
      return stepStatus === 'failed' || stepStatus === 'timed_out' || stepStatus === 'cancelled'
    case 'running':
      return stepStatus === 'running' || stepStatus === 'queued'
    case 'missing_config':
      return !job.enabled || stepStatus === 'skipped_missing_config'
    case 'success':
      return stepStatus === 'success' || stepStatus === 'completed'
    default:
      return true
  }
}

function OrchestrationPage() {
  const queryClient = useQueryClient()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin
    ? 'admin'
    : authViewState === 'demo'
      ? 'demo'
      : undefined
  const statusQuery = useQuery(opsRefreshStatusQueryOptionsWithMode({ mode: authMode }))
  const status = statusQuery.data
  const latest = status?.latestRun ?? null
  const jobs = status?.jobs ?? []
  const completedSteps = latest?.steps.filter(step => step.status === 'completed').length ?? 0
  const degradedSteps =
    latest?.steps.filter(step => step.status === 'degraded' || step.status === 'failed').length ?? 0

  const [filter, setFilter] = useState<StatusFilter>('all')
  const [recoveryFeedback, setRecoveryFeedback] = useState<string | null>(null)

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: opsRefreshQueryKeys.all,
    })

  const fullMutation = useMutation({
    mutationFn: runFullRefresh,
    onSuccess: invalidate,
  })

  const jobMutation = useMutation({
    mutationFn: (jobId: string) => runRefreshJob(jobId),
    onSuccess: invalidate,
  })

  const recoverMutation = useMutation({
    mutationFn: () => recoverStaleRuns(),
    onSuccess: result => {
      const warning = result.warning ? ` ${result.warning}` : ''
      setRecoveryFeedback(
        `${result.recoveredCount} run(s) marqué(s) en stale_timed_out, ${result.skippedCount} ignoré(s).${warning}`
      )
      invalidate()
    },
    onError: () => {
      setRecoveryFeedback('Échec de la recovery (voir logs admin).')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (runId: string) => cancelRefreshRun(runId),
    onSuccess: invalidate,
  })

  const isLatestActive = latest?.status === 'running' || latest?.status === 'queued'
  const filteredJobs = jobs.filter(job => {
    const step = findLatestStepForJob(latest, job)
    return matchesFilter(filter, job, step?.status)
  })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Intelligence & Admin"
        icon="<>"
        title="Orchestration"
        description="Relance quotidienne et manuelle des sources, enrichissements et contextes Advisor."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isAdmin || recoverMutation.isPending}
              onClick={() => recoverMutation.mutate()}
            >
              {recoverMutation.isPending ? 'Recovery…' : 'Recover stale runs'}
            </Button>
            {isLatestActive && latest?.operationId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isAdmin || cancelMutation.isPending}
                onClick={() => latest.operationId && cancelMutation.mutate(latest.operationId)}
              >
                Annuler run en cours
              </Button>
            ) : null}
            <Button
              type="button"
              variant="aurora"
              disabled={!isAdmin || fullMutation.isPending || isLatestActive}
              onClick={() => fullMutation.mutate()}
            >
              Relancer l'analyse complète
            </Button>
          </div>
        }
      />

      {!isAdmin && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Mode demo: lecture déterministe seulement. Aucun job réel, aucune DB et aucun provider
            ne sont appelés.
          </CardContent>
        </Card>
      )}

      {recoveryFeedback && (
        <Card>
          <CardContent className="p-3 text-sm text-muted-foreground">
            {recoveryFeedback}
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Dernier run</p>
            <p className="mt-2 font-financial text-lg font-semibold">{latest?.status ?? 'aucun'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Début</p>
            <p className="mt-2 text-sm">{formatDateTime(latest?.startedAt ?? null)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Étapes OK</p>
            <p className="mt-2 font-financial text-lg font-semibold">{completedSteps}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Dégradées</p>
            <p className="mt-2 font-financial text-lg font-semibold">{degradedSteps}</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">Jobs enregistrés</CardTitle>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['all', 'tous'],
                ['failed', 'échecs'],
                ['running', 'en cours'],
                ['missing_config', 'config manquante'],
                ['success', 'succès'],
              ] satisfies Array<[StatusFilter, string]>
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                variant={filter === key ? 'aurora' : 'outline'}
                size="sm"
                onClick={() => setFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredJobs.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Aucun job ne correspond au filtre.
            </p>
          )}
          {filteredJobs.map(job => {
            const step = findLatestStepForJob(latest, job)
            const stepStatus = step?.status ?? (job.enabled ? 'idle' : 'skipped_disabled')
            const descriptor = describeStatus(stepStatus)
            return (
              <div
                key={job.id}
                className="grid gap-3 rounded-lg border border-border/50 bg-surface-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusDot tone={job.enabled ? 'ok' : 'idle'} />
                    <p className="font-medium">{job.label}</p>
                    <Badge variant="outline" className="text-[11px]">
                      {domainLabel[job.domain]}
                    </Badge>
                    <Badge variant={badgeVariantFromTone(descriptor.tone)} className="text-[11px]">
                      {descriptor.label}
                    </Badge>
                    {step?.errorCode && (
                      <span className="font-mono text-[10px] text-muted-foreground/75">
                        {step.errorCode}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{job.description}</p>
                  {job.dependencies.length > 0 && (
                    <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground/75">
                      deps: {job.dependencies.join(', ')}
                    </p>
                  )}
                  {step?.errorMessage && (
                    <p className="mt-1 truncate text-xs text-negative">{step.errorMessage}</p>
                  )}
                </div>
                {job.manualTriggerAllowed ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!isAdmin || !job.enabled || jobMutation.isPending}
                    onClick={() => jobMutation.mutate(job.id)}
                  >
                    {jobMutation.variables === job.id && jobMutation.isPending ? '…' : 'Relancer'}
                  </Button>
                ) : (
                  <ManualTriggerHint domain={job.domain} />
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Légende des statuts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {(
            [
              ['success', 'Job terminé avec données utiles.'],
              ['partial', 'Au moins un provider a échoué; les autres ont produit des données.'],
              ['timed_out', 'Hard timeout — voir docs/ops/refresh-orchestrator.md.'],
              ['skipped_disabled', 'Feature flag désactivé.'],
              [
                'skipped_missing_config',
                'Feature activée mais secret/URL manquant — voir /ops/env/diagnostics.',
              ],
              ['skipped_budget', 'Budget pay-per-use épuisé (X, AI Advisor…).'],
              ['skipped_dependency_failed', 'Job amont a échoué; ce job a été ignoré.'],
              ['cancelled', "Run annulé via l'UI ou un appel admin."],
            ] satisfies Array<[RefreshJobStatus, string]>
          ).map(([key, description]) => {
            const descriptor = describeStatus(key)
            return (
              <div key={key} className="flex items-start gap-2">
                <Badge variant={badgeVariantFromTone(descriptor.tone)} className="text-[10px]">
                  {descriptor.label}
                </Badge>
                <span>{description}</span>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Replacement for the previously dead "Relancer" button on jobs whose
 * `manualTriggerAllowed` flag is false (currently: `tweets-finance`,
 * `tweets-ai`). The orchestrator never accepts a manual trigger for these
 * because they are owned by the Social Intelligence cockpit — driving them
 * from the orchestration page would bypass the budget guard and per-author
 * cap logic. Point the admin at the right cockpit instead of showing a
 * permanently grey button.
 */
function ManualTriggerHint({ domain }: { domain: string }) {
  if (domain === 'social') {
    return (
      <Link
        to="/signaux/social"
        className="inline-flex items-center justify-center rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        data-testid="manual-trigger-redirect-social"
        title="Lancer ce job depuis le cockpit Social Intelligence pour respecter budget et caps."
      >
        Gérer depuis Social Intelligence →
      </Link>
    )
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-md border border-border/40 px-3 py-1.5 text-[11px] text-muted-foreground/70"
      title="Ce job ne supporte pas de relance manuelle (planifié uniquement)."
    >
      Cron uniquement
    </span>
  )
}
