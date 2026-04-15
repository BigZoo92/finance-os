import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { financialGoalsQueryOptionsWithMode } from '@/features/goals/query-options'
import { PersonalFinancialGoalsCard } from '@/components/dashboard/personal-financial-goals-card'
import { PageHeader } from '@/components/surfaces/page-header'

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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Épargne & cibles"
        icon="◎"
        title="Objectifs"
        description="Suivi de vos cibles d'épargne et de patrimoine personnel, avec projections."
      />

      <PersonalFinancialGoalsCard authMode={authMode} isAdmin={isAdmin} isDemo={isDemo} />
    </div>
  )
}
