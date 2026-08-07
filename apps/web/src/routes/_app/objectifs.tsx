import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { financialGoalsQueryOptionsWithMode } from '@/features/goals/query-options'
import { PersonalFinancialGoalsCard } from '@/components/dashboard/personal-financial-goals-card'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'

export const Route = createFileRoute('/_app/objectifs')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined = auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
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
  const goals = goalsQuery.data?.items ?? []
  const completed = goals.filter(g => g.targetAmount > 0 && g.currentAmount / g.targetAmount >= 1).length
  const inProgress = goals.filter(g => !g.archivedAt).length
  const activeGoals = goals.filter(g => !g.archivedAt)
  const goalsNeedingAttention = activeGoals.filter(
    goal => goal.targetAmount > 0 && goal.currentAmount / goal.targetAmount < 0.25
  )
  const nextMilestone = [...activeGoals]
    .filter(goal => goal.targetAmount > 0 && goal.currentAmount < goal.targetAmount)
    .sort((left, right) => {
      if (!left.targetDate && !right.targetDate) return left.id - right.id
      if (!left.targetDate) return 1
      if (!right.targetDate) return -1
      return left.targetDate.localeCompare(right.targetDate)
    })[0]
  const overallProgress = goals.length
    ? Math.round(
        (goals.reduce((sum, g) => sum + Math.min(1, g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0), 0) /
          goals.length) *
          100,
      )
    : 0

  return (
    <div className="space-y-8">
      <PageHeader
        icon="◎"
        title="Objectifs"
        description="Ce que tu veux financer, où tu en es, et ce qui mérite une action."
      />

      <Panel title="Progression globale">
        <p className="text-5xl font-bold tracking-tighter md:text-6xl">
          <span className="font-financial text-aurora">{overallProgress}%</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {goals.length === 0
            ? 'Définis ton premier objectif ci-dessous.'
            : `${completed} terminé${completed > 1 ? 's' : ''} · ${inProgress - completed} en cours sur ${goals.length}.`}
        </p>
        {nextMilestone ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Prochaine cible: <span className="text-foreground">{nextMilestone.name}</span>
            {nextMilestone.targetDate ? ` · ${nextMilestone.targetDate}` : ''}
          </p>
        ) : null}
        {goalsNeedingAttention.length > 0 ? (
          <p className="mt-2 text-sm text-warning">
            {goalsNeedingAttention.length} objectif{goalsNeedingAttention.length > 1 ? 's' : ''} à reprendre.
          </p>
        ) : null}
      </Panel>

      <PersonalFinancialGoalsCard authMode={authMode} isAdmin={isAdmin} isDemo={isDemo} />
    </div>
  )
}
