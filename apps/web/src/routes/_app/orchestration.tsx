import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@finance-os/ui/components'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { opsRefreshStatusQueryOptionsWithMode, opsRefreshQueryKeys } from '@/features/ops-refresh/query-options'
import { runFullRefresh, runRefreshJob } from '@/features/ops-refresh/api'
import type { RefreshJobDefinition } from '@/features/ops-refresh/types'
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

const statusVariant = (status: string | null | undefined) => {
  if (status === 'completed' || status === 'success') {
    return 'positive' as const
  }
  if (status === 'degraded' || status === 'partial' || status === 'running' || status === 'queued') {
    return 'warning' as const
  }
  if (status === 'failed') {
    return 'destructive' as const
  }
  return 'outline' as const
}

const domainLabel: Record<RefreshJobDefinition['domain'], string> = {
  banking: 'Banque',
  transactions: 'Transactions',
  investments: 'Investissements',
  news: 'News',
  markets: 'Marches',
  social: 'Social',
  advisor: 'Advisor',
}

const stepKeyByJobId: Partial<Record<string, string>> = {
  powens: 'personal_sync',
  ibkr: 'ibkr_sync',
  'binance-crypto': 'binance_sync',
  'market-data': 'market_refresh',
  'advisor-context': 'advisor_run',
}

const findLatestStepForJob = (
  latest: NonNullable<import('@/features/ops-refresh/types').RefreshStatusResponse['latestRun']> | null,
  job: RefreshJobDefinition,
) => {
  const expectedStepKey = stepKeyByJobId[job.id]
  return latest?.steps.find(item => {
    if (expectedStepKey) {
      return item.stepKey === expectedStepKey
    }
    return job.domain === 'news' && item.stepKey === 'news_refresh'
  })
}

function OrchestrationPage() {
  const queryClient = useQueryClient()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : authViewState === 'demo' ? 'demo' : undefined
  const statusQuery = useQuery(opsRefreshStatusQueryOptionsWithMode({ mode: authMode }))
  const status = statusQuery.data
  const latest = status?.latestRun ?? null
  const jobs = status?.jobs ?? []
  const completedSteps = latest?.steps.filter(step => step.status === 'completed').length ?? 0
  const degradedSteps =
    latest?.steps.filter(step => step.status === 'degraded' || step.status === 'failed').length ?? 0

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: opsRefreshQueryKeys.all,
    })

  const fullMutation = useMutation({
    mutationFn: runFullRefresh,
    onSuccess: invalidate,
  })

  const jobMutation = useMutation({
    mutationFn: runRefreshJob,
    onSuccess: invalidate,
  })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Intelligence & Admin"
        icon="<>"
        title="Orchestration"
        description="Relance quotidienne et manuelle des sources, enrichissements et contextes Advisor."
        actions={
          <Button
            type="button"
            variant="aurora"
            disabled={!isAdmin || fullMutation.isPending || latest?.status === 'running' || latest?.status === 'queued'}
            onClick={() => fullMutation.mutate()}
          >
            Relancer l'analyse complete
          </Button>
        }
      />

      {!isAdmin && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Mode demo: lecture deterministe seulement. Aucun job reel, aucune DB et aucun provider ne sont appeles.
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
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Debut</p>
            <p className="mt-2 text-sm">{formatDateTime(latest?.startedAt ?? null)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Etapes OK</p>
            <p className="mt-2 font-financial text-lg font-semibold">{completedSteps}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Degradees</p>
            <p className="mt-2 font-financial text-lg font-semibold">{degradedSteps}</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jobs enregistres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {jobs.map(job => {
            const step = findLatestStepForJob(latest, job)
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
                    <Badge variant={statusVariant(step?.status)} className="text-[11px]">
                      {step?.status ?? (job.enabled ? 'idle' : 'disabled')}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{job.description}</p>
                  {job.dependencies.length > 0 && (
                    <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground/75">
                      deps: {job.dependencies.join(', ')}
                    </p>
                  )}
                  {step?.errorMessage && <p className="mt-1 truncate text-xs text-negative">{step.errorMessage}</p>}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!isAdmin || !job.enabled || !job.manualTriggerAllowed || jobMutation.isPending}
                  onClick={() => jobMutation.mutate(job.id)}
                >
                  Relancer
                </Button>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limites connues</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Les jobs provider restent read-only et fail-soft; un echec marque le run comme degrade sans bloquer les autres etapes.</p>
          <p>Les recommandations crypto exposent signaux, risques, exposition et concentration; elles ne declenchent jamais d'ordre ni promesse de rendement.</p>
        </CardContent>
      </Card>
    </div>
  )
}
