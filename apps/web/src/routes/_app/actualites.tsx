import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { getAiAdvisorUiFlags } from '@/features/ai-advisor-config'
import { dashboardAdvisorQueryOptionsWithMode, dashboardNewsQueryOptionsWithMode } from '@/features/dashboard-query-options'
import { NewsFeed } from '@/components/dashboard/news-feed'
import { AiAdvisorPanel } from '@/components/dashboard/ai-advisor-panel'
import { toErrorMessage } from '@/lib/format'

export const Route = createFileRoute('/_app/actualites')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined = auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return
    await context.queryClient.ensureQueryData(
      dashboardNewsQueryOptionsWithMode({ mode })
    )
  },
  component: ActualitesPage,
})

function ActualitesPage() {
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const aiAdvisorFlags = getAiAdvisorUiFlags()
  const aiAdvisorVisible = aiAdvisorFlags.enabled && (!aiAdvisorFlags.adminOnly || isAdmin)

  const advisorQuery = useQuery(
    dashboardAdvisorQueryOptionsWithMode({
      range: '30d',
      ...(aiAdvisorVisible && authMode ? { mode: authMode } : {}),
    })
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Actualités</h2>
        <p className="text-sm text-muted-foreground">Flux d'actualités financières et conseils IA</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* News feed */}
        <div className="lg:col-span-2">
          {authMode ? <NewsFeed mode={authMode} /> : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Chargement...
              </CardContent>
            </Card>
          )}
        </div>

        {/* AI Advisor */}
        {aiAdvisorVisible && (
          <div className="lg:col-span-2">
            <AiAdvisorPanel
              advisor={advisorQuery.data}
              isPending={advisorQuery.isPending}
              isError={advisorQuery.isError}
              errorMessage={advisorQuery.isError ? toErrorMessage(advisorQuery.error) : null}
            />
          </div>
        )}
      </div>
    </div>
  )
}
