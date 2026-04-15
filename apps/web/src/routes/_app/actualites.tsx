import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { getAiAdvisorUiFlags } from '@/features/ai-advisor-config'
import {
  postDashboardAdvisorChat,
  postDashboardAdvisorManualRefreshAndRun,
} from '@/features/dashboard-api'
import {
  dashboardAdvisorAssumptionsQueryOptionsWithMode,
  dashboardAdvisorChatQueryOptionsWithMode,
  dashboardAdvisorEvalsQueryOptionsWithMode,
  dashboardAdvisorManualOperationLatestQueryOptionsWithMode,
  dashboardAdvisorQueryOptionsWithMode,
  dashboardAdvisorRecommendationsQueryOptionsWithMode,
  dashboardAdvisorRunsQueryOptionsWithMode,
  dashboardAdvisorSignalsQueryOptionsWithMode,
  dashboardAdvisorSpendQueryOptionsWithMode,
  dashboardNewsQueryOptionsWithMode,
  dashboardQueryKeys,
} from '@/features/dashboard-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { AiAdvisorPanel } from '@/components/dashboard/ai-advisor-panel'
import { NewsFeed } from '@/components/dashboard/news-feed'
import { toErrorMessage } from '@/lib/format'
import { PageHeader } from '@/components/surfaces/page-header'
import PixelTransition from '@/components/reactbits/pixel-transition'

const advisorThreadKey = 'default'

export const Route = createFileRoute('/_app/actualites')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) {
      return
    }

    const advisorFlags = getAiAdvisorUiFlags()
    const advisorVisible = advisorFlags.enabled && (!advisorFlags.adminOnly || mode === 'admin')

    const prefetches: Array<Promise<unknown>> = [
      context.queryClient.ensureQueryData(
        dashboardNewsQueryOptionsWithMode({
          mode,
        })
      ),
    ]

    if (advisorVisible) {
      prefetches.push(
        context.queryClient.ensureQueryData(
          dashboardAdvisorQueryOptionsWithMode({
            range: '30d',
            mode,
          })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorRecommendationsQueryOptionsWithMode({
            mode,
          })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorSignalsQueryOptionsWithMode({
            mode,
          })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorSpendQueryOptionsWithMode({
            mode,
          })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorRunsQueryOptionsWithMode({
            mode,
          })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorManualOperationLatestQueryOptionsWithMode({
            mode,
          })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorAssumptionsQueryOptionsWithMode({
            mode,
          })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorChatQueryOptionsWithMode({
            mode,
            threadKey: advisorThreadKey,
          })
        ),
        context.queryClient.ensureQueryData(
          dashboardAdvisorEvalsQueryOptionsWithMode({
            mode,
          })
        )
      )
    }

    await Promise.all(prefetches)
  },
  component: ActualitesPage,
})

function ActualitesPage() {
  const queryClient = useQueryClient()
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
  const aiAdvisorHiddenReason = !aiAdvisorFlags.enabled
    ? 'disabled'
    : aiAdvisorFlags.adminOnly && !isAdmin
      ? 'admin_only'
      : null

  const manualOperationQuery = useQuery({
    ...dashboardAdvisorManualOperationLatestQueryOptionsWithMode({
      ...(aiAdvisorVisible && authMode ? { mode: authMode } : {}),
    }),
    refetchInterval: query => {
      const status = query.state.data?.status
      return status === 'queued' || status === 'running' ? 3_000 : false
    },
  })
  const manualOperationActive =
    manualOperationQuery.data?.status === 'queued' || manualOperationQuery.data?.status === 'running'
  const advisorRefetchInterval = manualOperationActive ? 4_000 : false

  const overviewQuery = useQuery(
    {
      ...dashboardAdvisorQueryOptionsWithMode({
        range: '30d',
        ...(aiAdvisorVisible && authMode ? { mode: authMode } : {}),
      }),
      refetchInterval: advisorRefetchInterval,
    }
  )
  const recommendationsQuery = useQuery(
    {
      ...dashboardAdvisorRecommendationsQueryOptionsWithMode({
        ...(aiAdvisorVisible && authMode ? { mode: authMode } : {}),
      }),
      refetchInterval: advisorRefetchInterval,
    }
  )
  const signalsQuery = useQuery(
    {
      ...dashboardAdvisorSignalsQueryOptionsWithMode({
        ...(aiAdvisorVisible && authMode ? { mode: authMode } : {}),
      }),
      refetchInterval: advisorRefetchInterval,
    }
  )
  const spendQuery = useQuery(
    {
      ...dashboardAdvisorSpendQueryOptionsWithMode({
        ...(aiAdvisorVisible && authMode ? { mode: authMode } : {}),
      }),
      refetchInterval: advisorRefetchInterval,
    }
  )
  const runsQuery = useQuery(
    {
      ...dashboardAdvisorRunsQueryOptionsWithMode({
        ...(aiAdvisorVisible && authMode ? { mode: authMode } : {}),
      }),
      refetchInterval: advisorRefetchInterval,
    }
  )
  const assumptionsQuery = useQuery(
    {
      ...dashboardAdvisorAssumptionsQueryOptionsWithMode({
        ...(aiAdvisorVisible && authMode ? { mode: authMode } : {}),
      }),
      refetchInterval: advisorRefetchInterval,
    }
  )
  const chatQuery = useQuery(
    {
      ...dashboardAdvisorChatQueryOptionsWithMode({
        ...(aiAdvisorVisible && authMode ? { mode: authMode } : {}),
        threadKey: advisorThreadKey,
      }),
      refetchInterval: advisorRefetchInterval,
    }
  )
  const evalsQuery = useQuery(
    {
      ...dashboardAdvisorEvalsQueryOptionsWithMode({
        ...(aiAdvisorVisible && authMode ? { mode: authMode } : {}),
      }),
      refetchInterval: advisorRefetchInterval,
    }
  )

  const invalidateAdvisorQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisor('30d') }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorRecommendations(12) }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorSignals(24) }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorSpend() }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorRuns(12) }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorManualOperationLatest() }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorAssumptions(24) }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorChat(advisorThreadKey) }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorEvals() }),
    ])
  }

  const manualRefreshAndRunMutation = useMutation({
    mutationFn: postDashboardAdvisorManualRefreshAndRun,
    onSuccess: async () => {
      await invalidateAdvisorQueries()
    },
  })

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      postDashboardAdvisorChat({
        threadKey: advisorThreadKey,
        message,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorChat(advisorThreadKey) })
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorRuns(12) })
    },
  })

  const advisorError = [
    overviewQuery.error,
    recommendationsQuery.error,
    signalsQuery.error,
    spendQuery.error,
    runsQuery.error,
    assumptionsQuery.error,
    chatQuery.error,
    evalsQuery.error,
  ]
    .find(Boolean)
  const manualOperationError = manualOperationQuery.error ? toErrorMessage(manualOperationQuery.error) : null

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Signaux & advisor"
        icon="▣"
        title="Actualités"
        description="Flux macro-financier, signaux externes et advisor IA ancré sur des artefacts persistants."
      />

      {/* Featured PixelTransition strip — hover/tap each card to flip it */}
      <div className="grid gap-3 sm:grid-cols-3">
        <PixelTransition
          className="!w-full !rounded-2xl !border-border/60 !bg-card !text-foreground"
          gridSize={9}
          pixelColor="oklch(from var(--primary) l c h / 95%)"
          animationStepDuration={0.32}
          aspectRatio="38%"
          firstContent={
            <div className="flex h-full w-full flex-col justify-between p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/85">▣ signal</p>
              <p className="text-[15px] font-semibold leading-snug text-foreground">
                Macro · taux & inflation
              </p>
            </div>
          }
          secondContent={
            <div className="flex h-full w-full flex-col justify-between bg-[linear-gradient(135deg,oklch(from_var(--aurora-a)_l_c_h/95%),oklch(from_var(--aurora-c)_l_c_h/95%))] p-5 text-primary-foreground">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em]">deep dive</p>
              <p className="text-[13px] leading-snug">
                Surveillez la prochaine réunion FED, les attentes sur les taux courts et l'impact sur vos liquidités.
              </p>
            </div>
          }
        />
        <PixelTransition
          className="!w-full !rounded-2xl !border-border/60 !bg-card !text-foreground"
          gridSize={9}
          pixelColor="oklch(from var(--accent-2) l c h / 95%)"
          animationStepDuration={0.32}
          aspectRatio="38%"
          firstContent={
            <div className="flex h-full w-full flex-col justify-between p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-2/85">▣ signal</p>
              <p className="text-[15px] font-semibold leading-snug text-foreground">
                Marchés · breadth & volat.
              </p>
            </div>
          }
          secondContent={
            <div className="flex h-full w-full flex-col justify-between bg-[linear-gradient(135deg,oklch(from_var(--accent-2)_l_c_h/95%),oklch(from_var(--aurora-b)_l_c_h/95%))] p-5 text-primary-foreground">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em]">deep dive</p>
              <p className="text-[13px] leading-snug">
                Plus de 60 % des indices clés sont en hausse cette semaine. Vol implicite contenue.
              </p>
            </div>
          }
        />
        <PixelTransition
          className="!w-full !rounded-2xl !border-border/60 !bg-card !text-foreground"
          gridSize={9}
          pixelColor="oklch(from var(--positive) l c h / 95%)"
          animationStepDuration={0.32}
          aspectRatio="38%"
          firstContent={
            <div className="flex h-full w-full flex-col justify-between p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-positive/90">▣ signal</p>
              <p className="text-[15px] font-semibold leading-snug text-foreground">
                Advisor · revue mensuelle
              </p>
            </div>
          }
          secondContent={
            <div className="flex h-full w-full flex-col justify-between bg-[linear-gradient(135deg,oklch(from_var(--positive)_l_c_h/90%),oklch(from_var(--chart-4)_l_c_h/90%))] p-5 text-primary-foreground">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em]">deep dive</p>
              <p className="text-[13px] leading-snug">
                3 recommandations actives, 2 anomalies détectées. Lancez un nouveau brief depuis le panneau ci-dessous.
              </p>
            </div>
          }
        />
      </div>

      <div className="grid gap-6">
        <div>
          {authMode ? (
            <NewsFeed mode={authMode} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Chargement...
              </CardContent>
            </Card>
          )}
        </div>

        {aiAdvisorVisible ? (
          <AiAdvisorPanel
            mode={authMode}
            overview={overviewQuery.data}
            recommendations={recommendationsQuery.data}
            assumptions={assumptionsQuery.data}
            signals={signalsQuery.data}
            spend={spendQuery.data}
            runs={runsQuery.data}
            manualOperation={manualOperationQuery.data}
            chat={chatQuery.data}
            evals={evalsQuery.data}
            isPending={
              overviewQuery.isPending ||
              recommendationsQuery.isPending ||
              signalsQuery.isPending ||
              spendQuery.isPending
            }
            errorMessage={advisorError ? toErrorMessage(advisorError) : null}
            manualOperationErrorMessage={manualOperationError}
            canTriggerRun={isAdmin}
            isTriggeringRun={manualRefreshAndRunMutation.isPending || manualOperationActive}
            onTriggerRun={() => manualRefreshAndRunMutation.mutate()}
            isSendingChat={chatMutation.isPending}
            onSendChat={message => chatMutation.mutate(message)}
          />
        ) : aiAdvisorHiddenReason ? (
          <Card>
            <CardContent className="space-y-2 py-8 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Advisor IA indisponible sur cette session</p>
              <p>
                {aiAdvisorHiddenReason === 'disabled'
                  ? 'La surface advisor est desactivee par configuration runtime.'
                  : 'La surface advisor est reservee a la session admin. Connecte-toi en admin pour afficher le brief, les runs, le chat et le bouton de refresh complet.'}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
