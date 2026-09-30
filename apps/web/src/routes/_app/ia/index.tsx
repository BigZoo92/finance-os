import { css, cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
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

const eyebrow = css({
  fontFamily: 'mono',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.19em',
  color: 'muted.foreground',
})

const titleRow = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '3',
})

const mutedText = css({ textStyle: 'sm', color: 'muted.foreground' })

const mutedIcon = css({ color: 'muted.foreground' })

const planTotalRow = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderTopWidth: '1px',
  borderColor: 'border/70',
  pt: '4',
  fontFamily: 'mono',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: 'muted.foreground',
})

const journalSummary = css({
  display: 'flex',
  minH: '11',
  cursor: 'pointer',
  listStyleType: 'none',
  alignItems: 'center',
  gap: '3',
  rounded: 'control',
  textStyle: 'sm',
  fontWeight: 'medium',
  outlineStyle: 'none',
  _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
  '&::-webkit-details-marker': { display: 'none' },
})

// The chevron follows the open state of its `<details>` group.
const journalChevron = css({
  color: 'muted.foreground',
  transitionProperty: 'transform, translate, scale, rotate',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  '[data-group=disclosure][open] &': { rotate: '180deg' },
  _motionReduce: { transitionProperty: 'none' },
})

const journalEntry = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  borderLeftWidth: '1px',
  borderColor: 'border/70',
  py: '1',
  pl: '3',
  sm: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: '4' },
})

const actionRow = css({
  borderBottomWidth: '1px',
  borderColor: 'border/70',
  _last: { borderBottomWidth: '0' },
})

const actionRowButton = css({
  display: 'grid',
  minH: '74px',
  w: 'full',
  gridTemplateColumns: '88px minmax(0, 1fr) auto',
  alignItems: 'center',
  columnGap: '3',
  py: '3',
  textAlign: 'left',
  outlineStyle: 'none',
  transitionProperty: 'colors',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  _hover: { bg: 'accent/25' },
  _focusVisible: {
    boxShadow: 'inset 0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)',
  },
  sm: { gridTemplateColumns: '105px minmax(0, 1.2fr) minmax(120px, 0.7fr) auto', columnGap: '5' },
})

const actionMeta = css({
  mt: '1',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: '2',
  fontFamily: 'mono',
  fontSize: '10px',
  color: 'muted.foreground',
})

const bucketTone = cva({
  base: {},
  variants: {
    bucket: {
      core: { color: 'foreground' },
      growth: { color: 'ai' },
      asymmetric: { color: 'warning' },
    },
  },
})

const rowChevron = cva({
  base: {
    color: 'muted.foreground',
    transitionProperty: 'transform, translate, scale, rotate',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    _motionReduce: { transitionProperty: 'none' },
  },
  variants: {
    expanded: {
      true: { rotate: '180deg' },
      false: {},
    },
  },
})

const actionDetail = css({
  display: 'grid',
  gap: '4',
  bg: 'surface.1/45',
  px: '3',
  py: '4',
  textStyle: 'xs',
  sm: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', px: '4' },
})

const detailLabel = css({
  fontFamily: 'mono',
  fontSize: '9px',
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: 'muted.foreground',
})

// Tailwind's `divide-y` drew the rule under every row but the last.
const loadingRows = css({
  display: 'block',
  '& > :not(:last-child)': { borderBottomWidth: '1px', borderColor: 'border/70' },
})

const skeleton = cva({
  base: {
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    bg: 'muted',
    _motionReduce: { animation: 'none' },
  },
  variants: {
    shape: {
      control: { rounded: 'control' },
      pill: { rounded: 'full' },
      flat: {},
    },
  },
  defaultVariants: { shape: 'control' },
})

const Skeleton = styled('span', skeleton)
const SkeletonBlock = styled('div', skeleton)

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
      <styled.div spaceY="8">
        <PageHeader icon={<RobotPixelIcon size={13} />} eyebrow="IA" title="Advisor" />
        <styled.section
          borderYWidth="1px"
          borderColor="border/60"
          py="10"
          aria-labelledby="advisor-unavailable"
        >
          <styled.h2 id="advisor-unavailable" textStyle="md" fontWeight="medium">
            Advisor indisponible sur cette session
          </styled.h2>
          <styled.p mt="2" maxW="xl" textStyle="sm" lineHeight="relaxed" color="muted.foreground">
            {flags.enabled
              ? 'Cette expérience est réservée à la session administrateur.'
              : 'Cette expérience est désactivée par la configuration actuelle.'}
          </styled.p>
        </styled.section>
      </styled.div>
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
    <styled.div spaceY="7">
      <PageHeader
        icon={<RobotPixelIcon size={13} />}
        eyebrow="IA"
        title="Advisor"
        status={
          <styled.div display="flex" flexWrap="wrap" alignItems="center" columnGap="4" rowGap="2">
            <PlanStatus plan={plan} isLoading={isLoading} />
            {plan?.generatedAt ? (
              <styled.span fontFamily="mono" fontSize="11px" color="muted.foreground">
                Mis à jour {formatDateTime(plan.generatedAt)}
              </styled.span>
            ) : null}
            {isDemo ? <Badge variant="warning">Démo déterministe</Badge> : null}
          </styled.div>
        }
        actions={
          <styled.div display="flex" w="full" gap="2" sm={{ w: 'auto' }}>
            <Button
              type="button"
              variant="outline"
              minH="11"
              flex="1"
              sm={{ minH: '9', flex: 'none' }}
              onClick={() => setProfileOpen(true)}
            >
              <CogPixelIcon size={14} aria-hidden="true" />
              Profil
            </Button>
            {isAdmin ? (
              <Button
                type="button"
                variant="outline"
                minH="11"
                flex="1"
                sm={{ minH: '9', flex: 'none' }}
                onClick={() => generatePlanMutation.mutate()}
                disabled={generatePlanMutation.isPending}
              >
                <RefreshPixelIcon size={14} aria-hidden="true" />
                {generatePlanMutation.isPending ? 'Calcul en cours' : 'Actualiser le plan'}
              </Button>
            ) : null}
          </styled.div>
        }
      />

      {hasError ? (
        <styled.output display="block" borderLeftWidth="2px" borderColor="warning" pl="3">
          <Status tone="attention" label="Certaines données sont momentanément indisponibles" />
        </styled.output>
      ) : null}

      <styled.section
        display="grid"
        borderYWidth="1px"
        borderColor="border/70"
        lg={{ gridTemplateColumns: 'minmax(0, 1.55fr) minmax(320px, 0.85fr)' }}
        aria-labelledby="current-investment-plan"
      >
        <styled.div minW="0" py="7" lg={{ pr: '12' }}>
          <styled.div
            display="flex"
            flexWrap="wrap"
            alignItems="flex-end"
            justifyContent="space-between"
            gap="4"
          >
            <div>
              <p className={eyebrow}>Plan d’investissement actuel</p>
              <styled.h2
                id="current-investment-plan"
                mt="3"
                display="flex"
                flexWrap="wrap"
                alignItems="baseline"
                columnGap="3"
                rowGap="1"
              >
                <CurrencyAmount
                  value={allocation.plan.value}
                  currency={allocation.plan.currency}
                  decimals={0}
                  unavailableLabel="Montant indisponible"
                  textStyle="3xl"
                  fontWeight="medium"
                  sm={{ textStyle: '4xl' }}
                />
                {allocation.plan.value !== null ? (
                  <styled.span
                    fontFamily="mono"
                    textStyle="sm"
                    fontWeight="normal"
                    color="muted.foreground"
                    sm={{ textStyle: 'md' }}
                  >
                    à orienter
                  </styled.span>
                ) : null}
              </styled.h2>
              {allocation.plan.reason === 'mixed_currency' ? (
                <styled.p mt="2" textStyle="xs" color="warning">
                  Le total n’est pas affiché car plusieurs devises sont présentes.
                </styled.p>
              ) : null}
            </div>
            {plan ? (
              <Badge variant={plan.dataQualityStatus === 'ready' ? 'positive' : 'warning'}>
                {plan.dataQualityStatus === 'ready' ? 'Plan disponible' : 'Plan partiel'}
              </Badge>
            ) : null}
          </styled.div>

          <styled.div mt="7" borderTopWidth="1px" borderColor="border/70">
            {isLoading ? (
              <PlanRowsLoading />
            ) : plan === null ? (
              <EmptyPlan isAdmin={isAdmin} onGenerate={() => generatePlanMutation.mutate()} />
            ) : rows.length === 0 ? (
              <styled.p py="8" textStyle="sm" color="muted.foreground">
                Aucune action n’est définie dans le plan actuel.
              </styled.p>
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
          </styled.div>

          {rows.length > 0 ? (
            <div className={planTotalRow}>
              <span>Total du plan</span>
              <CurrencyAmount
                value={allocation.plan.value}
                currency={allocation.plan.currency}
                decimals={0}
                unavailable="dash"
                textStyle="sm"
                color="foreground"
              />
            </div>
          ) : null}
        </styled.div>

        <styled.div
          borderTopWidth="1px"
          borderColor="border/70"
          py="7"
          lg={{ borderLeftWidth: '1px', borderTopWidth: '0', pl: '10' }}
        >
          <AllocationComparison comparison={allocation} />
          <styled.section
            mt="7"
            borderTopWidth="1px"
            borderColor="border/70"
            pt="6"
            aria-labelledby="flash-title"
          >
            <div className={titleRow}>
              <h2 id="flash-title" className={eyebrow}>
                Flash
              </h2>
              <styled.span aria-hidden="true" boxSize="1" rounded="full" bg="muted.foreground/45" />
            </div>
            {!flash.supported ? (
              <styled.p mt="3" textStyle="sm" lineHeight="relaxed" color="muted.foreground">
                {flash.message}
              </styled.p>
            ) : null}
          </styled.section>
        </styled.div>
      </styled.section>

      <styled.details
        data-group="disclosure"
        borderBottomWidth="1px"
        borderColor="border/60"
        pb="6"
      >
        <summary className={journalSummary}>
          <NotebookPixelIcon size={15} aria-hidden="true" className={mutedIcon} />
          <span>Journal de décisions</span>
          <styled.span ml="auto" fontFamily="mono" fontSize="11px" color="muted.foreground">
            {journalQuery.data?.items.length ?? 0}
          </styled.span>
          <ChevronDownPixelIcon size={14} aria-hidden="true" className={journalChevron} />
        </summary>
        <styled.div mt="3" spaceY="2" pl="7">
          {journalQuery.isPending ? (
            <p className={mutedText}>Chargement du journal…</p>
          ) : journalQuery.isError ? (
            <p className={mutedText}>Journal momentanément indisponible.</p>
          ) : (journalQuery.data?.items.length ?? 0) === 0 ? (
            <p className={mutedText}>Aucune décision enregistrée.</p>
          ) : (
            journalQuery.data?.items.map(entry => (
              <article key={entry.id} className={journalEntry}>
                <div>
                  <styled.p textStyle="sm" color="foreground">
                    {DECISION_LABEL[entry.decision]}
                  </styled.p>
                  {entry.freeNote ? (
                    <styled.p mt="0.5" lineClamp="2" textStyle="xs" color="muted.foreground">
                      {entry.freeNote}
                    </styled.p>
                  ) : null}
                </div>
                <styled.time
                  dateTime={entry.decidedAt}
                  flexShrink="0"
                  fontFamily="mono"
                  fontSize="10px"
                  color="muted.foreground"
                >
                  {formatDateTime(entry.decidedAt)}
                </styled.time>
              </article>
            ))
          )}
        </styled.div>
      </styled.details>

      <styled.p maxW="3xl" textStyle="xs" lineHeight="relaxed" color="muted.foreground">
        Finance-OS prépare des recommandations. Il ne passe aucun ordre et ne transfère aucun fonds.
        Toute décision reste soumise à votre validation.
      </styled.p>

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
    </styled.div>
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

  return (
    <article className={actionRow}>
      <button
        type="button"
        className={actionRowButton}
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={onToggle}
      >
        <CurrencyAmount
          value={row.amount}
          currency={row.currency}
          decimals={0}
          unavailable="dash"
          textStyle="lg"
          fontWeight="medium"
          color="foreground"
        />
        <styled.span minW="0">
          <styled.span
            display="block"
            truncate
            textStyle="sm"
            fontWeight="medium"
            color="foreground"
          >
            {row.asset}
          </styled.span>
          <span className={actionMeta}>
            <span>{row.destination}</span>
            <span className={bucketTone({ bucket: row.bucket })}>{row.bucketLabel}</span>
          </span>
        </styled.span>
        <styled.span
          display="none"
          textStyle="xs"
          lineHeight="relaxed"
          color="muted.foreground"
          sm={{ display: 'block' }}
        >
          {row.shortReason}
        </styled.span>
        <styled.span display="flex" alignItems="center" justifyContent="flex-end" gap="2">
          <Badge variant={badgeVariant}>{row.actionLabel}</Badge>
          <ChevronDownPixelIcon size={13} aria-hidden="true" className={rowChevron({ expanded })} />
        </styled.span>
      </button>
      {expanded ? (
        <div id={detailId} className={actionDetail}>
          <div>
            <p className={detailLabel}>Pourquoi</p>
            <styled.p mt="1.5" lineHeight="relaxed" color="foreground">
              {row.shortReason}
            </styled.p>
            {row.caveat && row.caveat !== row.shortReason ? (
              <styled.p mt="1" lineHeight="relaxed" color="warning">
                {row.caveat}
              </styled.p>
            ) : null}
          </div>
          <div>
            <p className={detailLabel}>Allocation</p>
            <styled.p mt="1.5" color="muted.foreground">
              Cible {formatPercent(row.targetWeightPct)}
            </styled.p>
            <styled.p mt="1" color="muted.foreground">
              Actuelle {formatPercent(row.currentWeightPct)}
            </styled.p>
          </div>
          <div>
            <p className={detailLabel}>Données</p>
            <styled.p mt="1.5" color="foreground">
              {row.freshnessLabel}
            </styled.p>
            <styled.p mt="1" lineHeight="relaxed" color="muted.foreground">
              {row.amountKind === 'contribution'
                ? 'Montant d’apport proposé, sans exécution.'
                : row.amountKind === 'trade'
                  ? 'Montant indicatif soumis à validation.'
                  : 'Montant non déterminé.'}
            </styled.p>
          </div>
        </div>
      ) : null}
    </article>
  )
}

function AllocationComparison({ comparison }: { comparison: AdvisorAllocationComparison }) {
  return (
    <section aria-labelledby="allocation-comparison-title">
      <div className={titleRow}>
        <h2 id="allocation-comparison-title" className={eyebrow}>
          Cible et plan actuel
        </h2>
        <Status
          tone={comparison.targetIsValid ? 'positive' : 'attention'}
          label={comparison.targetIsValid ? 'Cible complète' : 'Cible à vérifier'}
        />
      </div>
      <styled.div mt="5" spaceY="5">
        {comparison.rows.map(row => (
          <div key={row.bucket}>
            <styled.div
              mb="2"
              display="flex"
              alignItems="baseline"
              justifyContent="space-between"
              gap="3"
            >
              <styled.p textStyle="xs" fontWeight="medium" color="foreground">
                {row.label}
              </styled.p>
              <styled.p fontFamily="mono" fontSize="10px" color="muted.foreground">
                cible {formatPercent(row.targetPct)}, plan {formatPercent(row.planPct)}
              </styled.p>
            </styled.div>
            <Progress
              value={row.planPct}
              tone={bucketProgressTone(row.bucket)}
              label={`${row.label}, part du plan actuel`}
            />
          </div>
        ))}
      </styled.div>
      <styled.p mt="4" fontSize="11px" lineHeight="relaxed" color="muted.foreground">
        La cible décrit le profil long terme. Le plan montre uniquement l’orientation proposée
        maintenant.
      </styled.p>
    </section>
  )
}

function EmptyPlan({ isAdmin, onGenerate }: { isAdmin: boolean; onGenerate: () => void }) {
  return (
    <styled.div py="8">
      <styled.p textStyle="sm" fontWeight="medium" color="foreground">
        Aucun plan d’investissement actuel
      </styled.p>
      <styled.p mt="1" maxW="lg" textStyle="sm" lineHeight="relaxed" color="muted.foreground">
        Finance-OS n’affiche pas de recommandation chiffrée tant qu’aucun plan réel n’est
        disponible.
      </styled.p>
      {isAdmin ? (
        <Button type="button" variant="outline" mt="4" minH="11" onClick={onGenerate}>
          Calculer un plan
        </Button>
      ) : null}
    </styled.div>
  )
}

function PlanRowsLoading() {
  return (
    <output aria-label="Chargement des actions" className={loadingRows}>
      {[0, 1, 2].map(index => (
        <styled.div
          key={index}
          display="grid"
          minH="74px"
          gridTemplateColumns="88px 1fr auto"
          alignItems="center"
          gap="3"
        >
          <Skeleton h="5" w="16" />
          <styled.span spaceY="2">
            <Skeleton display="block" h="4" w="32" />
            <Skeleton display="block" h="3" w="24" bg="muted/70" />
          </styled.span>
          <Skeleton shape="pill" h="6" w="20" />
        </styled.div>
      ))}
    </output>
  )
}

function AdvisorLoading() {
  return (
    <styled.output display="block" spaceY="8" aria-label="Chargement de l’Advisor">
      <SkeletonBlock h="8" w="36" />
      <SkeletonBlock
        shape="flat"
        h="72"
        borderYWidth="1px"
        borderColor="border/60"
        bg="surface.1/35"
      />
    </styled.output>
  )
}
