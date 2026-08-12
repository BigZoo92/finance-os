import { CurrencyAmount, Progress, Status } from '@finance-os/ui/components'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { PersonalFinancialGoalsCard } from '@/components/dashboard/personal-financial-goals-card'
import { PageHeader } from '@/components/surfaces/page-header'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { financialGoalsQueryOptionsWithMode } from '@/features/goals/query-options'
import { buildActiveGoalsAggregate } from '@/features/goals/view-model'

export const Route = createFileRoute('/_app/objectifs')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return
    await context.queryClient.ensureQueryData(financialGoalsQueryOptionsWithMode({ mode }))
  },
  component: ObjectifsPage,
})

function ObjectifsPage() {
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined
  const goalsQuery = useQuery(financialGoalsQueryOptionsWithMode({ mode: authMode }))
  const aggregate = buildActiveGoalsAggregate(goalsQuery.data?.items ?? [])

  return (
    <div className="space-y-8 md:space-y-10">
      <PageHeader title="Objectifs" />

      {aggregate.activeGoals.length > 0 ? (
        <section className="border-y border-border py-6" aria-labelledby="goals-progress-title">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <h2
              id="goals-progress-title"
              className="shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
            >
              Progression globale
            </h2>
            <Progress
              value={aggregate.progress}
              label="Progression globale des objectifs actifs"
              className="min-w-0 flex-1"
            />
            <p className="shrink-0 font-mono text-xs text-foreground">
              <CurrencyAmount
                value={aggregate.currentAmount}
                currency={aggregate.currency}
                decimals={0}
              />{' '}
              <span className="text-muted-foreground">sur</span>{' '}
              <CurrencyAmount
                value={aggregate.targetAmount}
                currency={aggregate.currency}
                decimals={0}
              />
              {aggregate.progress !== null ? (
                <span className="text-muted-foreground">
                  , {aggregate.progress.toLocaleString('fr-FR')} %
                </span>
              ) : null}
            </p>
          </div>
          {aggregate.currency === null ? (
            <Status
              tone="attention"
              label="Progression globale indisponible pour plusieurs devises"
              className="mt-3"
            />
          ) : null}
        </section>
      ) : null}

      <PersonalFinancialGoalsCard authMode={authMode} isAdmin={isAdmin} isDemo={isDemo} />
    </div>
  )
}
