import { css } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
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

const progressTitle = css({
  flexShrink: '0',
  fontFamily: 'mono',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: 'muted.foreground',
})

const progressBar = css({ minW: '0', flex: '1' })

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
    <styled.div spaceY="8" md={{ spaceY: '10' }}>
      <PageHeader title="Objectifs" />

      {aggregate.activeGoals.length > 0 ? (
        <styled.section
          borderYWidth="1px"
          borderColor="border"
          py="6"
          aria-labelledby="goals-progress-title"
        >
          <styled.div
            display="flex"
            flexDirection="column"
            gap="4"
            lg={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <h2 id="goals-progress-title" className={progressTitle}>
              Progression globale
            </h2>
            <Progress
              value={aggregate.progress}
              label="Progression globale des objectifs actifs"
              className={progressBar}
            />
            <styled.p flexShrink="0" fontFamily="mono" textStyle="xs" color="foreground">
              <CurrencyAmount
                value={aggregate.currentAmount}
                currency={aggregate.currency}
                decimals={0}
              />{' '}
              <styled.span color="muted.foreground">sur</styled.span>{' '}
              <CurrencyAmount
                value={aggregate.targetAmount}
                currency={aggregate.currency}
                decimals={0}
              />
              {aggregate.progress !== null ? (
                <styled.span color="muted.foreground">
                  , {aggregate.progress.toLocaleString('fr-FR')} %
                </styled.span>
              ) : null}
            </styled.p>
          </styled.div>
          {aggregate.currency === null ? (
            <Status
              tone="attention"
              label="Progression globale indisponible pour plusieurs devises"
              mt="3"
            />
          ) : null}
        </styled.section>
      ) : null}

      <PersonalFinancialGoalsCard authMode={authMode} isAdmin={isAdmin} isDemo={isDemo} />
    </styled.div>
  )
}
