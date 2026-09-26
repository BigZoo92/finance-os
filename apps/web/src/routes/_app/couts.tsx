import { css } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import {
  Button,
  CurrencyAmount,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  SegmentedControl,
  Status,
} from '@finance-os/ui/components'
import { CoinsPixelIcon } from '@finance-os/ui/icons/pixel'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { CostEvolutionChart } from '@/components/costs/cost-evolution-chart'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { COST_PERIODS, type CostPeriod, createCostsViewModel } from '@/features/costs-view-model'
import {
  dashboardAdvisorSpendQueryOptionsWithMode,
  dashboardCostOverviewQueryOptionsWithMode,
} from '@/features/dashboard-query-options'
import { useIsMobile } from '@/lib/use-is-mobile'

export const Route = createFileRoute('/_app/couts')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return
    await Promise.allSettled([
      context.queryClient.ensureQueryData(dashboardAdvisorSpendQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(dashboardCostOverviewQueryOptionsWithMode({ mode })),
    ])
  },
  component: CostsPage,
})

const demoNotice = css({
  borderYWidth: '1px',
  borderColor: 'border/60',
  py: '3',
  textStyle: 'sm',
  color: 'muted.foreground',
})

const eyebrow = css({
  fontFamily: 'mono',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: 'muted.foreground',
})

const totalSkeleton = css({
  h: '10',
  w: '44',
  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  rounded: 'control',
  bg: 'muted',
})

const sectionTitle = css({ textStyle: 'sm', fontWeight: 'semibold' })

const mutedText = css({ textStyle: 'sm', color: 'muted.foreground' })

const costLine = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: '4',
  borderBottomWidth: '1px',
  borderColor: 'border/50',
  py: '4',
  _last: { borderBottomWidth: '0' },
})

// `text-[10px]` on the Status chip: the recipe's `xs` text style keeps its line
// height, so it is pinned to the inherited one like the former `leading-[inherit]`.
const provenanceChip = css({
  fontFamily: 'mono',
  fontSize: '10px',
  textTransform: 'uppercase',
  lineHeight: 'inherit',
})

const breakdownRow = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '3',
  borderBottomWidth: '1px',
  borderColor: 'border/50',
  py: '3',
  _last: { borderBottomWidth: '0' },
})

function CostsPage() {
  const [period, setPeriod] = useState<CostPeriod>('month')
  const [aiDetailOpen, setAiDetailOpen] = useState(false)
  const isMobile = useIsMobile()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const mode: AuthMode | undefined =
    authViewState === 'admin' ? 'admin' : authViewState === 'demo' ? 'demo' : undefined
  const modeOptions = mode ? { mode } : {}
  const spendQuery = useQuery(dashboardAdvisorSpendQueryOptionsWithMode(modeOptions))
  const overviewQuery = useQuery(dashboardCostOverviewQueryOptionsWithMode(modeOptions))
  const model = createCostsViewModel({
    overview: overviewQuery.data,
    spend: spendQuery.data,
    period,
    overviewUnavailable: overviewQuery.isError,
    spendUnavailable: spendQuery.isError,
  })
  const pending = spendQuery.isPending || overviewQuery.isPending

  return (
    <styled.div spaceY="7">
      <PageHeader
        eyebrow="Ops"
        icon={<CoinsPixelIcon size={12} />}
        title="Coûts"
        description="Les dépenses mesurées, estimées et fixes de Finance-OS."
        actions={
          <SegmentedControl
            options={[...COST_PERIODS]}
            value={period}
            onChange={setPeriod}
            size="sm"
            aria-label="Période des coûts"
          />
        }
      />

      {authViewState === 'demo' ? (
        <div className={demoNotice}>
          Lecture seule avec données de démonstration. Aucune source réelle n’est interrogée.
        </div>
      ) : null}

      <styled.section
        borderYWidth="1px"
        borderColor="border/60"
        py="6"
        aria-labelledby="known-costs-title"
      >
        <styled.div
          display="flex"
          flexWrap="wrap"
          alignItems="flex-end"
          justifyContent="space-between"
          gap="4"
        >
          <div>
            <p id="known-costs-title" className={eyebrow}>
              Coûts connus {model.periodLabel}
            </p>
            <styled.div
              mt="2"
              display="flex"
              flexWrap="wrap"
              alignItems="baseline"
              columnGap="4"
              rowGap="2"
            >
              {pending ? (
                <span className={totalSkeleton} />
              ) : model.totals.length > 0 ? (
                model.totals.map(total => (
                  <CurrencyAmount
                    key={total.currency}
                    value={total.value}
                    currency={total.currency}
                    decimals={total.currency === 'USD' ? 4 : 2}
                    textStyle="3xl"
                    fontWeight="semibold"
                  />
                ))
              ) : (
                <CurrencyAmount value={null} currency={null} textStyle="xl" />
              )}
            </styled.div>
          </div>
          {model.partial ? (
            <Status tone="attention" label="Couverture partielle" />
          ) : (
            <Status tone="positive" label="Couverture complète" />
          )}
        </styled.div>
        {model.totals.length > 1 ? (
          <styled.p mt="3" textStyle="xs" color="muted.foreground">
            Les devises restent séparées. Aucun taux de conversion n’est supposé.
          </styled.p>
        ) : null}
      </styled.section>

      <Panel title="Évolution Advisor" description="Dépenses quotidiennes mesurées en USD">
        <CostEvolutionChart data={model.daily} />
      </Panel>

      <section aria-labelledby="cost-breakdown-title">
        <styled.div
          mb="2"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap="3"
        >
          <h2 id="cost-breakdown-title" className={sectionTitle}>
            Répartition
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => setAiDetailOpen(true)}>
            Détail IA
          </Button>
        </styled.div>
        <styled.div borderYWidth="1px" borderColor="border/60">
          {model.lines.map(line => (
            <div key={`${line.id}-${line.currency}`} className={costLine}>
              <styled.div minW="0">
                <styled.div display="flex" flexWrap="wrap" alignItems="center" gap="2">
                  <styled.p textStyle="sm" fontWeight="medium">
                    {line.label}
                  </styled.p>
                  <Status
                    tone={
                      line.provenance === 'estimated' || line.provenance === 'mixed'
                        ? 'attention'
                        : 'neutral'
                    }
                    label={line.provenanceLabel}
                    withDot={false}
                    className={provenanceChip}
                  />
                </styled.div>
                <styled.p mt="1" textStyle="xs" color="muted.foreground">
                  {line.detail}
                </styled.p>
              </styled.div>
              <CurrencyAmount
                value={line.value}
                currency={line.currency}
                decimals={line.currency === 'USD' ? 4 : 2}
                textAlign="right"
                textStyle="sm"
                fontWeight="semibold"
              />
            </div>
          ))}
        </styled.div>
      </section>

      <styled.section
        aria-labelledby="cost-anomalies-title"
        borderYWidth="1px"
        borderColor="border/60"
        py="5"
      >
        <h2 id="cost-anomalies-title" className={sectionTitle}>
          Anomalies
        </h2>
        {model.anomalies === null ? (
          <styled.p mt="2" textStyle="sm" color="muted.foreground">
            Analyse indisponible
          </styled.p>
        ) : model.anomalies.length === 0 ? (
          <styled.div mt="3">
            <Status tone="positive" label="Aucune anomalie" />
          </styled.div>
        ) : (
          <styled.ul mt="3" spaceY="3">
            {model.anomalies.map(anomaly => (
              <styled.li
                key={`${anomaly.kind}-${anomaly.message}`}
                display="flex"
                alignItems="flex-start"
                gap="3"
                textStyle="sm"
              >
                <Status
                  tone={anomaly.severity === 'critical' ? 'negative' : 'attention'}
                  label={anomaly.severity === 'critical' ? 'Échec' : 'Attention'}
                  mt="0.5"
                  flexShrink="0"
                />
                <span>{anomaly.message}</span>
              </styled.li>
            ))}
          </styled.ul>
        )}
      </styled.section>

      <Drawer open={aiDetailOpen} onOpenChange={setAiDetailOpen}>
        <DrawerContent side={isMobile ? 'bottom' : 'right'}>
          <DrawerHeader>
            <DrawerTitle>Détail IA</DrawerTitle>
            <DrawerDescription>Répartition du registre Advisor disponible.</DrawerDescription>
          </DrawerHeader>
          <styled.div spaceY="6" px="5" pb="6">
            {model.aiBreakdown === null ? (
              <p className={mutedText}>Détail indisponible</p>
            ) : (
              <>
                <Breakdown title="Par fonction" rows={model.aiBreakdown.byFeature} />
                <Breakdown title="Par modèle" rows={model.aiBreakdown.byModel} />
              </>
            )}
          </styled.div>
        </DrawerContent>
      </Drawer>
    </styled.div>
  )
}

function Breakdown({
  title,
  rows,
}: {
  title: string
  rows: Array<{ key: string; label: string; usd: number; eur: number }>
}) {
  return (
    <section>
      <h3 className={eyebrow}>{title}</h3>
      {rows.length === 0 ? (
        <styled.p mt="3" textStyle="sm" color="muted.foreground">
          Aucune donnée
        </styled.p>
      ) : (
        <styled.div mt="2" borderYWidth="1px" borderColor="border/60">
          {rows.map(row => (
            <div key={row.key} className={breakdownRow}>
              <styled.span textStyle="sm">{row.label}</styled.span>
              <CurrencyAmount value={row.usd} currency="USD" decimals={4} textStyle="sm" />
            </div>
          ))}
        </styled.div>
      )}
    </section>
  )
}
