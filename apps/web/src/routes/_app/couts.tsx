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
import { COST_PERIODS, createCostsViewModel, type CostPeriod } from '@/features/costs-view-model'
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
    <div className="space-y-7">
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
        <div className="border-y border-border/60 py-3 text-sm text-muted-foreground">
          Lecture seule avec données de démonstration. Aucune source réelle n’est interrogée.
        </div>
      ) : null}

      <section className="border-y border-border/60 py-6" aria-labelledby="known-costs-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              id="known-costs-title"
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
            >
              Coûts connus {model.periodLabel}
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              {pending ? (
                <span className="h-10 w-44 animate-pulse rounded-control bg-muted" />
              ) : model.totals.length > 0 ? (
                model.totals.map(total => (
                  <CurrencyAmount
                    key={total.currency}
                    value={total.value}
                    currency={total.currency}
                    decimals={total.currency === 'USD' ? 4 : 2}
                    className="text-3xl font-semibold tracking-tight"
                  />
                ))
              ) : (
                <CurrencyAmount value={null} currency={null} className="text-xl" />
              )}
            </div>
          </div>
          {model.partial ? (
            <Status tone="attention" label="Couverture partielle" />
          ) : (
            <Status tone="positive" label="Couverture complète" />
          )}
        </div>
        {model.totals.length > 1 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Les devises restent séparées. Aucun taux de conversion n’est supposé.
          </p>
        ) : null}
      </section>

      <Panel title="Évolution Advisor" description="Dépenses quotidiennes mesurées en USD">
        <CostEvolutionChart data={model.daily} />
      </Panel>

      <section aria-labelledby="cost-breakdown-title">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="cost-breakdown-title" className="text-sm font-semibold">
            Répartition
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => setAiDetailOpen(true)}>
            Détail IA
          </Button>
        </div>
        <div className="border-y border-border/60">
          {model.lines.map((line, index) => (
            <div
              key={`${line.id}-${line.currency}-${index}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/50 py-4 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{line.label}</p>
                  <Status
                    tone={
                      line.provenance === 'estimated' || line.provenance === 'mixed'
                        ? 'attention'
                        : 'neutral'
                    }
                    label={line.provenanceLabel}
                    withDot={false}
                    className="font-mono text-[10px] uppercase"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{line.detail}</p>
              </div>
              <CurrencyAmount
                value={line.value}
                currency={line.currency}
                decimals={line.currency === 'USD' ? 4 : 2}
                className="text-right text-sm font-semibold"
              />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="cost-anomalies-title" className="border-y border-border/60 py-5">
        <h2 id="cost-anomalies-title" className="text-sm font-semibold">
          Anomalies
        </h2>
        {model.anomalies === null ? (
          <p className="mt-2 text-sm text-muted-foreground">Analyse indisponible</p>
        ) : model.anomalies.length === 0 ? (
          <div className="mt-3">
            <Status tone="positive" label="Aucune anomalie" />
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {model.anomalies.map(anomaly => (
              <li
                key={`${anomaly.kind}-${anomaly.message}`}
                className="flex items-start gap-3 text-sm"
              >
                <Status
                  tone={anomaly.severity === 'critical' ? 'negative' : 'attention'}
                  label={anomaly.severity === 'critical' ? 'Échec' : 'Attention'}
                  className="mt-0.5 shrink-0"
                />
                <span>{anomaly.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Drawer open={aiDetailOpen} onOpenChange={setAiDetailOpen}>
        <DrawerContent side={isMobile ? 'bottom' : 'right'}>
          <DrawerHeader>
            <DrawerTitle>Détail IA</DrawerTitle>
            <DrawerDescription>Répartition du registre Advisor disponible.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-6 px-5 pb-6">
            {model.aiBreakdown === null ? (
              <p className="text-sm text-muted-foreground">Détail indisponible</p>
            ) : (
              <>
                <Breakdown title="Par fonction" rows={model.aiBreakdown.byFeature} />
                <Breakdown title="Par modèle" rows={model.aiBreakdown.byModel} />
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
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
      <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Aucune donnée</p>
      ) : (
        <div className="mt-2 border-y border-border/60">
          {rows.map(row => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-3 border-b border-border/50 py-3 last:border-b-0"
            >
              <span className="text-sm">{row.label}</span>
              <CurrencyAmount value={row.usd} currency="USD" decimals={4} className="text-sm" />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
