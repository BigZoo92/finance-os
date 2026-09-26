import { Badge, Button, CurrencyAmount, Progress, Status } from '@finance-os/ui/components'
import {
  ChevronDownPixelIcon,
  CogPixelIcon,
  NotebookPixelIcon,
  RefreshPixelIcon,
  RobotPixelIcon,
} from '@finance-os/ui/icons/pixel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { AdvisorProfileDrawer } from '@/components/advisor/advisor-profile-drawer'
import { PageHeader } from '@/components/surfaces/page-header'
import { getAiAdvisorUiFlags } from '@/features/ai-advisor-config'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import {
  postDashboardInvestmentPlanGenerate,
  putDashboardInvestmentStrategy,
} from '@/features/dashboard-api'
import {
  dashboardAdvisorJournalQueryOptionsWithMode,
  dashboardInvestmentPlanLatestQueryOptionsWithMode,
  dashboardInvestmentStrategyQueryOptionsWithMode,
  dashboardQueryKeys,
} from '@/features/dashboard-query-options'
import type {
  DashboardAdvisorDecisionKind,
  DashboardInvestmentActionPlan,
} from '@/features/dashboard-types'
import {
  type AdvisorAllocationComparison,
  type AdvisorPlanRow,
  advisorAllocationComparison,
  advisorFlashState,
  advisorPlanRows,
} from '@/features/investment-strategy-view-model'
import { formatDateTime } from '@/lib/format'
import { pushToast } from '@/lib/toast-store'

export const Route = createFileRoute('/_app/ia/')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    const flags = getAiAdvisorUiFlags()
    const visible = flags.enabled && (!flags.adminOnly || mode === 'admin')
    if (!visible) return

    await Promise.allSettled([
      context.queryClient.ensureQueryData(
        dashboardInvestmentStrategyQueryOptionsWithMode({ mode })
      ),
      context.queryClient.ensureQueryData(
        dashboardInvestmentPlanLatestQueryOptionsWithMode({ mode })
      ),
    ])
  },
  component: AdvisorPage,
})

const DECISION_LABEL: Record<DashboardAdvisorDecisionKind, string> = {
  accepted: 'Suivie',
  rejected: 'Écartée',
  deferred: 'Reportée',
  ignored: 'Sans suite',
}

const formatPercent = (value: number | null) =>
  value === null
    ? 'Indisponible'
    : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)} %`

const bucketProgressTone = (
  bucket: AdvisorAllocationComparison['rows'][number]['bucket']
): 'brand' | 'positive' | 'warning' => {
  if (bucket === 'core') return 'brand'
  if (bucket === 'growth') return 'positive'
  return 'warning'
}

function AdvisorPage() {
  const queryClient = useQueryClient()
  const [profileOpen, setProfileOpen] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isAdmin = authViewState === 'admin'
  const isDemo = authViewState === 'demo'
  const mode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined
  const flags = getAiAdvisorUiFlags()
  const advisorVisible = flags.enabled && (!flags.adminOnly || isAdmin)
  const modeOptions = advisorVisible && mode ? { mode } : {}

  const strategyQuery = useQuery(dashboardInvestmentStrategyQueryOptionsWithMode(modeOptions))
  const planQuery = useQuery(dashboardInvestmentPlanLatestQueryOptionsWithMode(modeOptions))
  const journalQuery = useQuery(
    dashboardAdvisorJournalQueryOptionsWithMode({
      ...modeOptions,
      limit: 4,
    })
  )

  const generatePlanMutation = useMutation({
    mutationFn: () => postDashboardInvestmentPlanGenerate(false),
    onSuccess: async response => {
      queryClient.setQueryData(dashboardQueryKeys.investmentPlanLatest('admin'), response)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentPlanLatest() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentStatus() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentHypotheses() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentScorecard() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.investmentLessons() }),
      ])
      pushToast({
        title: 'Plan actualisé',
        description: 'Le nouveau plan reste une recommandation à valider.',
        tone: 'success',
      })
    },
    onError: () => {
      pushToast({
        title: 'Actualisation impossible',
        description: 'Le plan actuel reste affiché sans modification.',
        tone: 'error',
      })
    },
  })

  const updateProfileMutation = useMutation({
    mutationFn: putDashboardInvestmentStrategy,
    onSuccess: async response => {
      queryClient.setQueryData(dashboardQueryKeys.investmentStrategy('admin'), response)
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.investmentPlanLatest(),
      })
      setProfileOpen(false)
      pushToast({
        title: 'Profil enregistré',
        description: 'Le plan actuel n’a pas été recalculé. Actualisez-le quand vous êtes prêt.',
        tone: 'success',
      })
    },
    onError: () => {
      pushToast({
        title: 'Enregistrement impossible',
        description: 'Le profil précédent est conservé.',
        tone: 'error',
      })
    },
  })

  if (authViewState === 'pending') {
    return <AdvisorLoading />
  }

  if (!advisorVisible) {
    return (
      <div className="space-y-8">
        <PageHeader icon={<RobotPixelIcon size={13} />} eyebrow="IA" title="Advisor" />
        <section className="border-y border-border/60 py-10" aria-labelledby="advisor-unavailable">
          <h2 id="advisor-unavailable" className="text-base font-medium">
            Advisor indisponible sur cette session
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {flags.enabled
              ? 'Cette expérience est réservée à la session administrateur.'
              : 'Cette expérience est désactivée par la configuration actuelle.'}
          </p>
        </section>
      </div>
    )
  }

  const strategyResponse = strategyQuery.data
  const strategy = strategyResponse?.strategy ?? null
  const buckets = strategyResponse?.buckets ?? []
  const planResponse = planQuery.data
  const plan = planResponse?.plan ?? null
  const rows = advisorPlanRows(plan)
  const allocation = advisorAllocationComparison({ buckets, plan })
  const flash = advisorFlashState()
  const isLoading = strategyQuery.isPending || planQuery.isPending
  const hasError = strategyQuery.isError || planQuery.isError

  return (
    <div className="space-y-7">
      <PageHeader
        icon={<RobotPixelIcon size={13} />}
        eyebrow="IA"
        title="Advisor"
        status={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <PlanStatus plan={plan} isLoading={isLoading} />
            {plan?.generatedAt ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                Mis à jour {formatDateTime(plan.generatedAt)}
              </span>
            ) : null}
            {isDemo ? <Badge variant="warning">Démo déterministe</Badge> : null}
          </div>
        }
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1 sm:min-h-9 sm:flex-none"
              onClick={() => setProfileOpen(true)}
            >
              <CogPixelIcon size={14} aria-hidden="true" />
              Profil
            </Button>
            {isAdmin ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1 sm:min-h-9 sm:flex-none"
                onClick={() => generatePlanMutation.mutate()}
                disabled={generatePlanMutation.isPending}
              >
                <RefreshPixelIcon size={14} aria-hidden="true" />
                {generatePlanMutation.isPending ? 'Calcul en cours' : 'Actualiser le plan'}
              </Button>
            ) : null}
          </div>
        }
      />

      {hasError ? (
        <output className="block border-l-2 border-warning pl-3">
          <Status tone="attention" label="Certaines données sont momentanément indisponibles" />
        </output>
      ) : null}

      <section
        className="grid border-y border-border/70 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]"
        aria-labelledby="current-investment-plan"
      >
        <div className="min-w-0 py-7 lg:pr-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.19em] text-muted-foreground">
                Plan d’investissement actuel
              </p>
              <h2
                id="current-investment-plan"
                className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1"
              >
                <CurrencyAmount
                  value={allocation.plan.value}
                  currency={allocation.plan.currency}
                  decimals={0}
                  unavailableLabel="Montant indisponible"
                  className="text-3xl font-medium sm:text-4xl"
                />
                {allocation.plan.value !== null ? (
                  <span className="font-mono text-sm font-normal text-muted-foreground sm:text-base">
                    à orienter
                  </span>
                ) : null}
              </h2>
              {allocation.plan.reason === 'mixed_currency' ? (
                <p className="mt-2 text-xs text-warning">
                  Le total n’est pas affiché car plusieurs devises sont présentes.
                </p>
              ) : null}
            </div>
            {plan ? (
              <Badge variant={plan.dataQualityStatus === 'ready' ? 'positive' : 'warning'}>
                {plan.dataQualityStatus === 'ready' ? 'Plan disponible' : 'Plan partiel'}
              </Badge>
            ) : null}
          </div>

          <div className="mt-7 border-t border-border/70">
            {isLoading ? (
              <PlanRowsLoading />
            ) : plan === null ? (
              <EmptyPlan isAdmin={isAdmin} onGenerate={() => generatePlanMutation.mutate()} />
            ) : rows.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">
                Aucune action n’est définie dans le plan actuel.
              </p>
            ) : (
              rows.map(row => (
                <AdvisorActionRow
                  key={row.key}
                  row={row}
                  expanded={expandedRow === row.key}
                  onToggle={() => setExpandedRow(current => (current === row.key ? null : row.key))}
                />
              ))
            )}
          </div>

          {rows.length > 0 ? (
            <div className="flex items-center justify-between border-t border-border/70 pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>Total du plan</span>
              <CurrencyAmount
                value={allocation.plan.value}
                currency={allocation.plan.currency}
                decimals={0}
                unavailable="dash"
                className="text-sm text-foreground"
              />
            </div>
          ) : null}
        </div>

        <div className="border-t border-border/70 py-7 lg:border-l lg:border-t-0 lg:pl-10">
          <AllocationComparison comparison={allocation} />
          <section className="mt-7 border-t border-border/70 pt-6" aria-labelledby="flash-title">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="flash-title"
                className="font-mono text-[10px] uppercase tracking-[0.19em] text-muted-foreground"
              >
                Flash
              </h2>
              <span aria-hidden="true" className="size-1 rounded-full bg-muted-foreground/45" />
            </div>
            {!flash.supported ? (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{flash.message}</p>
            ) : null}
          </section>
        </div>
      </section>

      <details className="group border-b border-border/60 pb-6">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-control text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/70 [&::-webkit-details-marker]:hidden">
          <NotebookPixelIcon size={15} aria-hidden="true" className="text-muted-foreground" />
          <span>Journal de décisions</span>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {journalQuery.data?.items.length ?? 0}
          </span>
          <ChevronDownPixelIcon
            size={14}
            aria-hidden="true"
            className="text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div className="mt-3 space-y-2 pl-7">
          {journalQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Chargement du journal…</p>
          ) : journalQuery.isError ? (
            <p className="text-sm text-muted-foreground">Journal momentanément indisponible.</p>
          ) : (journalQuery.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune décision enregistrée.</p>
          ) : (
            journalQuery.data?.items.map(entry => (
              <article
                key={entry.id}
                className="flex flex-col gap-1 border-l border-border/70 py-1 pl-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <div>
                  <p className="text-sm text-foreground">{DECISION_LABEL[entry.decision]}</p>
                  {entry.freeNote ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {entry.freeNote}
                    </p>
                  ) : null}
                </div>
                <time
                  dateTime={entry.decidedAt}
                  className="shrink-0 font-mono text-[10px] text-muted-foreground"
                >
                  {formatDateTime(entry.decidedAt)}
                </time>
              </article>
            ))
          )}
        </div>
      </details>

      <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Finance-OS prépare des recommandations. Il ne passe aucun ordre et ne transfère aucun fonds.
        Toute décision reste soumise à votre validation.
      </p>

      <AdvisorProfileDrawer
        open={profileOpen}
        onOpenChange={setProfileOpen}
        profile={strategy}
        buckets={buckets}
        isAdmin={isAdmin}
        isPending={updateProfileMutation.isPending}
        mutationError={updateProfileMutation.isError}
        onSubmit={input => updateProfileMutation.mutate(input)}
      />
    </div>
  )
}

function PlanStatus({
  plan,
  isLoading,
}: {
  plan: DashboardInvestmentActionPlan | null
  isLoading: boolean
}) {
  if (isLoading) return <Status tone="progress" label="Chargement du plan" />
  if (!plan) return <Status tone="neutral" label="Aucun plan actuel" />
  if (plan.dataQualityStatus === 'ready') {
    return <Status tone="positive" label="Plan actuel disponible" />
  }
  if (plan.dataQualityStatus === 'degraded') {
    return <Status tone="attention" label="Plan actuel partiel" />
  }
  return <Status tone="attention" label="Données insuffisantes" />
}

function AdvisorActionRow({
  row,
  expanded,
  onToggle,
}: {
  row: AdvisorPlanRow
  expanded: boolean
  onToggle: () => void
}) {
  const detailId = `advisor-action-${row.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`
  const badgeVariant =
    row.actionTone === 'positive'
      ? 'positive'
      : row.actionTone === 'attention'
        ? 'warning'
        : 'outline'
  const riskClass =
    row.bucket === 'asymmetric'
      ? 'text-warning'
      : row.bucket === 'growth'
        ? 'text-ai'
        : 'text-foreground'

  return (
    <article className="border-b border-border/70 last:border-b-0">
      <button
        type="button"
        className="grid min-h-[74px] w-full grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-x-3 py-3 text-left outline-none transition-colors hover:bg-accent/25 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70 sm:grid-cols-[105px_minmax(0,1.2fr)_minmax(120px,0.7fr)_auto] sm:gap-x-5"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={onToggle}
      >
        <CurrencyAmount
          value={row.amount}
          currency={row.currency}
          decimals={0}
          unavailable="dash"
          className="text-lg font-medium text-foreground"
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{row.asset}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[10px] text-muted-foreground">
            <span>{row.destination}</span>
            <span className={riskClass}>{row.bucketLabel}</span>
          </span>
        </span>
        <span className="hidden text-xs leading-relaxed text-muted-foreground sm:block">
          {row.shortReason}
        </span>
        <span className="flex items-center justify-end gap-2">
          <Badge variant={badgeVariant}>{row.actionLabel}</Badge>
          <ChevronDownPixelIcon
            size={13}
            aria-hidden="true"
            className={`text-muted-foreground transition-transform motion-reduce:transition-none ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>
      {expanded ? (
        <div
          id={detailId}
          className="grid gap-4 bg-surface-1/45 px-3 py-4 text-xs sm:grid-cols-3 sm:px-4"
        >
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Pourquoi
            </p>
            <p className="mt-1.5 leading-relaxed text-foreground">{row.shortReason}</p>
            {row.caveat && row.caveat !== row.shortReason ? (
              <p className="mt-1 leading-relaxed text-warning">{row.caveat}</p>
            ) : null}
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Allocation
            </p>
            <p className="mt-1.5 text-muted-foreground">
              Cible {formatPercent(row.targetWeightPct)}
            </p>
            <p className="mt-1 text-muted-foreground">
              Actuelle {formatPercent(row.currentWeightPct)}
            </p>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Données
            </p>
            <p className="mt-1.5 text-foreground">{row.freshnessLabel}</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              {row.amountKind === 'contribution'
                ? 'Montant d’apport proposé, sans exécution.'
                : row.amountKind === 'trade'
                  ? 'Montant indicatif soumis à validation.'
                  : 'Montant non déterminé.'}
            </p>
          </div>
        </div>
      ) : null}
    </article>
  )
}

function AllocationComparison({ comparison }: { comparison: AdvisorAllocationComparison }) {
  return (
    <section aria-labelledby="allocation-comparison-title">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="allocation-comparison-title"
          className="font-mono text-[10px] uppercase tracking-[0.19em] text-muted-foreground"
        >
          Cible et plan actuel
        </h2>
        <Status
          tone={comparison.targetIsValid ? 'positive' : 'attention'}
          label={comparison.targetIsValid ? 'Cible complète' : 'Cible à vérifier'}
        />
      </div>
      <div className="mt-5 space-y-5">
        {comparison.rows.map(row => (
          <div key={row.bucket}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="text-xs font-medium text-foreground">{row.label}</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                cible {formatPercent(row.targetPct)}, plan {formatPercent(row.planPct)}
              </p>
            </div>
            <Progress
              value={row.planPct}
              tone={bucketProgressTone(row.bucket)}
              label={`${row.label}, part du plan actuel`}
            />
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        La cible décrit le profil long terme. Le plan montre uniquement l’orientation proposée
        maintenant.
      </p>
    </section>
  )
}

function EmptyPlan({ isAdmin, onGenerate }: { isAdmin: boolean; onGenerate: () => void }) {
  return (
    <div className="py-8">
      <p className="text-sm font-medium text-foreground">Aucun plan d’investissement actuel</p>
      <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
        Finance-OS n’affiche pas de recommandation chiffrée tant qu’aucun plan réel n’est
        disponible.
      </p>
      {isAdmin ? (
        <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={onGenerate}>
          Calculer un plan
        </Button>
      ) : null}
    </div>
  )
}

function PlanRowsLoading() {
  return (
    <output aria-label="Chargement des actions" className="block divide-y divide-border/70">
      {[0, 1, 2].map(index => (
        <div key={index} className="grid min-h-[74px] grid-cols-[88px_1fr_auto] items-center gap-3">
          <span className="h-5 w-16 animate-pulse rounded-control bg-muted motion-reduce:animate-none" />
          <span className="space-y-2">
            <span className="block h-4 w-32 animate-pulse rounded-control bg-muted motion-reduce:animate-none" />
            <span className="block h-3 w-24 animate-pulse rounded-control bg-muted/70 motion-reduce:animate-none" />
          </span>
          <span className="h-6 w-20 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
        </div>
      ))}
    </output>
  )
}

function AdvisorLoading() {
  return (
    <output className="block space-y-8" aria-label="Chargement de l’Advisor">
      <div className="h-8 w-36 animate-pulse rounded-control bg-muted motion-reduce:animate-none" />
      <div className="h-72 animate-pulse border-y border-border/60 bg-surface-1/35 motion-reduce:animate-none" />
    </output>
  )
}
