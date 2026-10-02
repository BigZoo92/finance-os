import { css, cva, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import {
  Amount,
  Badge,
  CurrencyAmount,
  Freshness,
  Progress,
  SegmentedControl,
  Status,
  ValuationState,
} from '@finance-os/ui/components'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { getAiAdvisorUiFlags } from '@/features/ai-advisor-config'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { buildCockpitViewModel } from '@/features/cockpit-view-model'
import {
  dashboardAdvisorRecommendationsQueryOptionsWithMode,
  dashboardSummaryQueryOptionsWithMode,
} from '@/features/dashboard-query-options'
import type { DashboardRange } from '@/features/dashboard-types'
import { financialGoalsQueryOptionsWithMode } from '@/features/goals/query-options'
import { powensStatusQueryOptionsWithMode } from '@/features/powens/query-options'
import type { AttentionItem } from '@/features/trading-lab-api'
import { attentionItemsQueryOptions } from '@/features/trading-lab-query-options'

const searchSchema = z.object({ range: z.enum(['7d', '30d', '90d']).optional() })
const resolveRange = (value: string | undefined): DashboardRange =>
  value === '7d' || value === '90d' ? value : '30d'

export const Route = createFileRoute('/_app/')({
  validateSearch: search => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ range: resolveRange(search.range) }),
  loader: async ({ context, deps }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    const advisorFlags = getAiAdvisorUiFlags()
    const advisorVisible = advisorFlags.enabled && (!advisorFlags.adminOnly || mode === 'admin')
    const prefetches: Array<Promise<unknown>> = [
      context.queryClient.ensureQueryData(
        dashboardSummaryQueryOptionsWithMode({ range: deps.range, mode })
      ),
      context.queryClient.ensureQueryData(financialGoalsQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(powensStatusQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(attentionItemsQueryOptions({ status: 'open' })),
    ]

    if (advisorVisible) {
      prefetches.push(
        context.queryClient.ensureQueryData(
          dashboardAdvisorRecommendationsQueryOptionsWithMode({ mode })
        )
      )
    }
    await Promise.all(prefetches)
  },
  component: CockpitPage,
})

const RANGES: Array<{ label: string; value: DashboardRange }> = [
  { label: '7 j', value: '7d' },
  { label: '30 j', value: '30d' },
  { label: '90 j', value: '90d' },
]

const eyebrow = css({
  fontFamily: 'mono',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: 'muted.foreground',
})

const breakdownSwatch = cva({
  base: {},
  variants: {
    tone: {
      available: { bg: 'primary' },
      savings: { bg: 'foreground/45' },
      investments: { bg: 'warmAccent' },
      manual: { bg: 'teal' },
    },
    shape: {
      bar: {},
      dot: { boxSize: '2', rounded: 'tile' },
    },
  },
})

const ledgerRow = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: '4',
  borderBottomWidth: '1px',
  borderColor: 'border',
  py: '3',
})

const ledgerDetail = css({
  mt: '1',
  truncate: true,
  fontFamily: 'mono',
  fontSize: '11px',
  color: 'muted.foreground',
})

const ledgerEmpty = css({
  borderBottomWidth: '1px',
  borderColor: 'border',
  py: '5',
  textStyle: 'sm',
  color: 'muted.foreground',
})

const panelColumn = css({
  borderTopWidth: '1px',
  borderColor: 'border',
  pt: '8',
  lg: { borderLeftWidth: '1px', borderTopWidth: '0', pl: '12', pt: '0' },
})

function CockpitPage() {
  const { range: searchRange } = Route.useSearch()
  const range = resolveRange(searchRange)
  const navigate = Route.useNavigate()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const authMode: AuthMode | undefined =
    authViewState === 'admin' ? 'admin' : authViewState === 'demo' ? 'demo' : undefined

  const summaryQuery = useQuery(
    dashboardSummaryQueryOptionsWithMode({
      range,
      ...(authMode ? { mode: authMode } : {}),
    })
  )
  const statusQuery = useQuery(powensStatusQueryOptionsWithMode(authMode ? { mode: authMode } : {}))
  const goalsQuery = useQuery(financialGoalsQueryOptionsWithMode({ mode: authMode }))
  const attentionQuery = useQuery(attentionItemsQueryOptions({ status: 'open' }))

  const advisorFlags = getAiAdvisorUiFlags()
  const advisorVisible =
    advisorFlags.enabled && (!advisorFlags.adminOnly || authViewState === 'admin')
  const recommendationsQuery = useQuery({
    ...dashboardAdvisorRecommendationsQueryOptionsWithMode(
      advisorVisible && authMode ? { mode: authMode } : {}
    ),
    enabled: advisorVisible && Boolean(authMode),
  })

  const viewModel = buildCockpitViewModel(summaryQuery.data)
  const activeGoals = (goalsQuery.data?.items ?? []).filter(goal => !goal.archivedAt)
  const connections = statusQuery.data?.connections ?? []
  const connectionFailures = connections.filter(
    connection => connection.status === 'error' || connection.status === 'reconnect_required'
  ).length
  const attentionItems: AttentionItem[] = attentionQuery.data?.items ?? []
  const lowProgressGoals = activeGoals.filter(
    goal => goal.targetAmount > 0 && goal.currentAmount / goal.targetAmount < 0.25
  ).length
  const highRiskRecommendations = (recommendationsQuery.data?.items ?? []).filter(
    recommendation => recommendation.riskLevel === 'high'
  ).length
  const attentionTotal =
    attentionItems.length + connectionFailures + lowProgressGoals + highRiskRecommendations

  const staleSummary = summaryQuery.isError && summaryQuery.data !== undefined
  const summaryUnavailable = summaryQuery.isError && summaryQuery.data === undefined
  const knownBreakdowns = viewModel.breakdowns.filter(
    breakdown => breakdown.value !== null && breakdown.value > 0
  )
  const breakdownTotal = knownBreakdowns.reduce((sum, breakdown) => sum + (breakdown.value ?? 0), 0)
  const savings = viewModel.breakdowns.find(breakdown => breakdown.key === 'savings')
  const investments = viewModel.breakdowns.find(breakdown => breakdown.key === 'investments')
  const available = viewModel.breakdowns.find(breakdown => breakdown.key === 'available')

  return (
    <styled.div spaceY="9" md={{ spaceY: '11' }}>
      <PageHeader
        title="Cockpit"
        status={authViewState === 'demo' ? <Badge variant="outline">Mode démo</Badge> : undefined}
        actions={
          <SegmentedControl
            options={RANGES}
            value={range}
            onChange={next => navigate({ search: { range: next } })}
            aria-label="Période"
          />
        }
      />

      <styled.section
        display="grid"
        gap="8"
        borderBottomWidth="1px"
        borderColor="border"
        pb="9"
        lg={{ gridTemplateColumns: 'minmax(0, 1.45fr) minmax(280px, 0.75fr)', gap: '12' }}
      >
        <div>
          <p className={cx(eyebrow, css({ display: 'flex', alignItems: 'center', gap: '2.5' }))}>
            <span
              className={breakdownSwatch({ tone: 'available', shape: 'dot' })}
              aria-hidden="true"
            />
            Argent disponible
          </p>
          <Amount
            value={available?.value}
            mt="3"
            display="block"
            fontSize="clamp(2.25rem, 7vw, 3.5rem)"
            fontWeight="medium"
            color="foreground"
          />
          <styled.div mt="6" maxW="xl" borderTopWidth="1px" borderColor="border">
            {available?.items.length ? (
              available.items.map(item => (
                <div key={item.id} className={ledgerRow}>
                  <styled.div minW="0">
                    <styled.p truncate textStyle="sm" fontWeight="medium" color="foreground">
                      {item.label}
                    </styled.p>
                    {item.detail ? <p className={ledgerDetail}>{item.detail}</p> : null}
                  </styled.div>
                  <Amount value={item.value} decimals={2} textStyle="sm" color="foreground" />
                </div>
              ))
            ) : (
              <p className={ledgerEmpty}>Données indisponibles</p>
            )}
          </styled.div>
        </div>

        <styled.div
          spaceY="6"
          borderTopWidth="1px"
          borderColor="border"
          pt="6"
          lg={{ borderLeftWidth: '1px', borderTopWidth: '0', pl: '12', pt: '1' }}
        >
          <div>
            <p className={eyebrow}>Patrimoine total</p>
            <Amount
              value={viewModel.totalWealth}
              mt="2"
              display="block"
              textStyle="2xl"
              fontWeight="medium"
            />
          </div>
          <div>
            <p className={eyebrow}>
              Performance {range === '7d' ? '7 j' : range === '90d' ? '90 j' : '30 j'}
            </p>
            <styled.p mt="2" textStyle="sm" color="muted.foreground">
              Données insuffisantes
            </styled.p>
          </div>
          <styled.div display="flex" flexWrap="wrap" columnGap="5" rowGap="2">
            {summaryUnavailable ? (
              <Status tone="negative" label="Données indisponibles" />
            ) : staleSummary ? (
              <Status tone="attention" label="Données anciennes" />
            ) : summaryQuery.isPending ? (
              <Status tone="progress" label="Chargement" />
            ) : (
              <ValuationState state={viewModel.valuationState} />
            )}
            <Freshness asOf={viewModel.valuationAsOf} />
          </styled.div>
          {viewModel.coveragePercent !== null ? (
            <div>
              <styled.div
                mb="2"
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gap="3"
                fontFamily="mono"
                fontSize="11px"
                color="muted.foreground"
              >
                <span>Couverture</span>
                <span>{viewModel.coveragePercent.toLocaleString('fr-FR')} %</span>
              </styled.div>
              <Progress value={viewModel.coveragePercent} label="Couverture de valorisation" />
            </div>
          ) : null}
        </styled.div>
      </styled.section>

      <section aria-labelledby="wealth-breakdown-title">
        <styled.div
          display="flex"
          flexWrap="wrap"
          alignItems="baseline"
          justifyContent="space-between"
          gap="3"
        >
          <h2 id="wealth-breakdown-title" className={eyebrow}>
            Répartition du patrimoine
          </h2>
          {viewModel.unknownValueCount > 0 ? (
            <Status
              tone="attention"
              label={`${viewModel.unknownValueCount} valeur${viewModel.unknownValueCount > 1 ? 's' : ''} à vérifier`}
            />
          ) : null}
        </styled.div>
        {breakdownTotal > 0 ? (
          <styled.div
            mt="4"
            display="flex"
            h="1.5"
            gap="0.5"
            overflow="hidden"
            rounded="3px"
            bg="foreground/9"
            aria-hidden="true"
          >
            {knownBreakdowns.map(breakdown => (
              <span
                key={breakdown.key}
                className={breakdownSwatch({ tone: breakdown.key, shape: 'bar' })}
                style={{ flexGrow: breakdown.value ?? 0 }}
              />
            ))}
          </styled.div>
        ) : (
          <styled.div
            mt="4"
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="border"
            px="4"
            py="5"
            textStyle="sm"
            color="muted.foreground"
          >
            Répartition indisponible
          </styled.div>
        )}
        <styled.div
          mt="4"
          display="grid"
          columnGap="8"
          rowGap="3"
          sm={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
          lg={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
        >
          {viewModel.breakdowns.map(breakdown => (
            <styled.div key={breakdown.key} display="flex" alignItems="center" gap="2.5">
              <span
                className={breakdownSwatch({ tone: breakdown.key, shape: 'dot' })}
                aria-hidden="true"
              />
              <styled.span textStyle="sm" color="foreground">
                {breakdown.label}
              </styled.span>
              <Amount value={breakdown.value} ml="auto" textStyle="xs" color="muted.foreground" />
            </styled.div>
          ))}
        </styled.div>
      </section>

      <styled.section
        display="grid"
        gap="9"
        borderTopWidth="1px"
        borderColor="border"
        pt="8"
        lg={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12' }}
      >
        <BreakdownList title="Épargne" breakdown={savings} />
        <BreakdownList title="Investissements" breakdown={investments} />
      </styled.section>

      <Panel
        bg="surface.2"
        bodyClassName={css({
          display: 'grid',
          gap: '9',
          lg: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12' },
        })}
      >
        <section aria-labelledby="top-expenses-title">
          <h2 id="top-expenses-title" className={eyebrow}>
            Top dépenses
          </h2>
          <styled.div mt="4" spaceY="4">
            {summaryQuery.data?.topExpenseGroups.length ? (
              summaryQuery.data.topExpenseGroups.slice(0, 4).map(group => {
                const max = summaryQuery.data?.topExpenseGroups[0]?.total ?? 0
                return (
                  <div key={`${group.category}-${group.merchant}`}>
                    <styled.div
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      gap="4"
                      textStyle="sm"
                    >
                      <styled.span truncate color="foreground">
                        {group.label}
                      </styled.span>
                      <CurrencyAmount
                        value={group.total}
                        currency="EUR"
                        flexShrink="0"
                        color="foreground"
                      />
                    </styled.div>
                    <Progress
                      value={max > 0 ? group.total : null}
                      max={max || 1}
                      tone="neutral"
                      label={`Dépenses ${group.label}`}
                      mt="2"
                    />
                  </div>
                )
              })
            ) : (
              <styled.p textStyle="sm" color="muted.foreground">
                {summaryQuery.isPending ? 'Chargement' : 'Aucune dépense'}
              </styled.p>
            )}
          </styled.div>
        </section>

        <section aria-labelledby="cockpit-goals-title" className={panelColumn}>
          <h2 id="cockpit-goals-title" className={eyebrow}>
            Objectifs
          </h2>
          <styled.div mt="4" spaceY="5">
            {activeGoals.length ? (
              activeGoals.slice(0, 3).map(goal => {
                const progress =
                  goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : null
                return (
                  <div key={goal.id}>
                    <styled.div
                      display="flex"
                      alignItems="baseline"
                      justifyContent="space-between"
                      gap="4"
                    >
                      <styled.span truncate textStyle="sm" color="foreground">
                        {goal.name}
                      </styled.span>
                      <styled.span flexShrink="0" fontFamily="mono" textStyle="xs" color="primary">
                        {progress === null
                          ? 'Indisponible'
                          : `${Math.min(100, Math.max(0, Math.round(progress)))} %`}
                      </styled.span>
                    </styled.div>
                    <Progress value={progress} label={goal.name} mt="2" />
                    <styled.p mt="2" fontFamily="mono" fontSize="11px" color="muted.foreground">
                      <Amount value={goal.currentAmount} decimals={0} /> sur{' '}
                      <Amount value={goal.targetAmount} decimals={0} />
                    </styled.p>
                  </div>
                )
              })
            ) : (
              <styled.p textStyle="sm" color="muted.foreground">
                {goalsQuery.isPending ? 'Chargement' : 'Aucun objectif actif'}
              </styled.p>
            )}
          </styled.div>
        </section>
      </Panel>

      {attentionTotal > 0 ? (
        <styled.div
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap="4"
          borderTopWidth="1px"
          borderColor="border"
          pt="5"
        >
          <Status
            tone="attention"
            label={`${attentionTotal} élément${attentionTotal > 1 ? 's' : ''} à vérifier`}
          />
        </styled.div>
      ) : null}
    </styled.div>
  )
}

function BreakdownList({
  title,
  breakdown,
}: {
  title: string
  breakdown: ReturnType<typeof buildCockpitViewModel>['breakdowns'][number] | undefined
}) {
  return (
    <section aria-label={title}>
      <styled.div display="flex" alignItems="baseline" justifyContent="space-between" gap="4">
        <h2 className={eyebrow}>{title}</h2>
        <Amount value={breakdown?.value} textStyle="lg" fontWeight="medium" color="foreground" />
      </styled.div>
      <styled.div mt="4" borderTopWidth="1px" borderColor="border">
        {breakdown?.items.length ? (
          breakdown.items.slice(0, 5).map(item => (
            <div key={item.id} className={ledgerRow}>
              <styled.div minW="0">
                <styled.p truncate textStyle="sm" color="foreground">
                  {item.label}
                </styled.p>
                {item.detail ? <p className={ledgerDetail}>{item.detail}</p> : null}
              </styled.div>
              <Amount value={item.value} textStyle="sm" color="foreground" />
            </div>
          ))
        ) : (
          <p className={ledgerEmpty}>Aucune donnée disponible</p>
        )}
      </styled.div>
    </section>
  )
}
