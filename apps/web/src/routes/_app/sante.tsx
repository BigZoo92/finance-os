import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Freshness,
  Progress,
  ProviderStatus,
  Status,
  ValuationState,
} from '@finance-os/ui/components'
import { HeartbeatIcon } from '@phosphor-icons/react/dist/csr/Heartbeat'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { PageHeader } from '@/components/surfaces/page-header'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { dashboardDerivedRecomputeStatusQueryOptionsWithMode } from '@/features/dashboard-query-options'
import { externalInvestmentsStatusQueryOptionsWithMode } from '@/features/external-investments/query-options'
import { createHealthViewModel } from '@/features/health-view-model'
import { powensStatusQueryOptionsWithMode } from '@/features/powens/query-options'
import {
  valuationStatusQueryOptionsWithMode,
  valuationUnresolvedQueryOptionsWithMode,
} from '@/features/valuation/query-options'
import type { ValuationUnresolvedItem } from '@/features/valuation/types'
import { xHealthQueryOptionsWithMode } from '@/features/x-health-query-options'
import { useIsMobile } from '@/lib/use-is-mobile'

export const Route = createFileRoute('/_app/sante')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return
    const options = { mode }
    await Promise.allSettled([
      context.queryClient.ensureQueryData(powensStatusQueryOptionsWithMode(options)),
      context.queryClient.ensureQueryData(externalInvestmentsStatusQueryOptionsWithMode(options)),
      context.queryClient.ensureQueryData(
        dashboardDerivedRecomputeStatusQueryOptionsWithMode(options)
      ),
      context.queryClient.ensureQueryData(valuationStatusQueryOptionsWithMode(options)),
      context.queryClient.ensureQueryData(valuationUnresolvedQueryOptionsWithMode(options)),
      context.queryClient.ensureQueryData(xHealthQueryOptionsWithMode(options)),
    ])
  },
  component: HealthPage,
})

const valuationStates = [
  'priced',
  'derived',
  'estimated',
  'manual',
  'stale',
  'unresolved',
  'unavailable',
] as const

function HealthPage() {
  const [unresolvedOpen, setUnresolvedOpen] = useState(false)
  const isMobile = useIsMobile()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const mode: AuthMode | undefined =
    authViewState === 'admin' ? 'admin' : authViewState === 'demo' ? 'demo' : undefined
  const options = mode ? { mode } : {}
  const powensQuery = useQuery(powensStatusQueryOptionsWithMode(options))
  const externalQuery = useQuery(externalInvestmentsStatusQueryOptionsWithMode(options))
  const derivedQuery = useQuery(dashboardDerivedRecomputeStatusQueryOptionsWithMode(options))
  const valuationQuery = useQuery(valuationStatusQueryOptionsWithMode(options))
  const unresolvedQuery = useQuery(valuationUnresolvedQueryOptionsWithMode(options))
  const xHealthQuery = useQuery(xHealthQueryOptionsWithMode(options))
  const model = createHealthViewModel({
    powens: powensQuery.data,
    external: externalQuery.data,
    derived: derivedQuery.data,
    valuation: valuationQuery.data,
    unresolved: unresolvedQuery.data,
    xHealth: xHealthQuery.data,
  })
  const unresolvedItems = unresolvedQuery.data?.items ?? []

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Ops"
        icon={<HeartbeatIcon size={12} />}
        title="Santé"
        description="L’état des connexions, des données et de la valorisation."
      />

      {authViewState === 'demo' ? (
        <div className="border-y border-border/60 py-3 text-sm text-muted-foreground">
          Lecture seule avec données de démonstration. Aucun diagnostic réel n’est lancé.
        </div>
      ) : null}

      <section
        className={`border-y py-6 ${
          model.state === 'healthy'
            ? 'border-positive/30'
            : model.state === 'degraded'
              ? 'border-warning/40'
              : 'border-border/60'
        }`}
        aria-live="polite"
      >
        <Status
          tone={
            model.state === 'healthy'
              ? 'positive'
              : model.state === 'degraded'
                ? 'attention'
                : 'neutral'
          }
          label={
            model.state === 'healthy'
              ? 'À jour'
              : model.state === 'degraded'
                ? 'Attention'
                : 'Indisponible'
          }
          className="font-mono text-[10px] uppercase tracking-[0.14em] leading-[inherit]"
        />
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">{model.headline}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{model.summary}</p>
      </section>

      {model.problems.length > 0 ? (
        <section aria-labelledby="health-problems-title">
          <h2 id="health-problems-title" className="text-sm font-semibold">
            À examiner
          </h2>
          <div className="mt-2 border-y border-border/60">
            {model.problems.map(problem => (
              <div
                key={problem.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 py-4 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{problem.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{problem.detail}</p>
                </div>
                {problem.destination ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to={problem.destination}>Ouvrir</Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUnresolvedOpen(true)}
                  >
                    Voir les actifs
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-7 lg:grid-cols-2">
        <section aria-labelledby="provider-health-title">
          <h2 id="provider-health-title" className="text-sm font-semibold">
            Connexions
          </h2>
          <div className="mt-2 border-y border-border/60">
            {model.providers.map(provider => (
              <div
                key={provider.id}
                className="flex items-center justify-between gap-4 border-b border-border/50 py-4 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{provider.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{provider.detail}</p>
                </div>
                <ProviderStatus status={provider.state} className="shrink-0" />
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="freshness-title">
          <h2 id="freshness-title" className="text-sm font-semibold">
            Fraîcheur
          </h2>
          <div className="mt-2 border-y border-border/60">
            {model.freshness.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 border-b border-border/50 py-4 last:border-b-0"
              >
                <p className="text-sm font-medium">{item.label}</p>
                <Freshness asOf={item.asOf} className="shrink-0" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section aria-labelledby="valuation-health-title" className="border-y border-border/60 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="valuation-health-title" className="text-sm font-semibold">
              Valorisation des actifs
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {model.valuation.resolvedItems === null || model.valuation.totalItems === null
                ? 'Couverture indisponible'
                : `${model.valuation.resolvedItems} actifs résolus sur ${model.valuation.totalItems}`}
            </p>
          </div>
          <span className="font-financial text-2xl font-semibold">
            {model.valuation.coveragePercent === null
              ? 'Indisponible'
              : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(model.valuation.coveragePercent)} %`}
          </span>
        </div>
        <Progress
          value={model.valuation.coveragePercent}
          tone={model.valuation.unresolvedItems ? 'warning' : 'positive'}
          label="Couverture de valorisation"
          className="mt-4"
        />
        {model.valuation.statusCounts ? (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {valuationStates.map(state =>
              model.valuation.statusCounts?.[state] ? (
                <div key={state} className="flex items-center gap-2">
                  <ValuationState state={state} />
                  <span className="font-financial text-xs">
                    {model.valuation.statusCounts[state]}
                  </span>
                </div>
              ) : null
            )}
          </div>
        ) : null}
      </section>

      <Drawer open={unresolvedOpen} onOpenChange={setUnresolvedOpen}>
        <DrawerContent side={isMobile ? 'bottom' : 'right'}>
          <DrawerHeader>
            <DrawerTitle>Actifs non résolus</DrawerTitle>
            <DrawerDescription>Actifs sans valorisation suffisamment fiable.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-5 pb-6">
            {unresolvedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun actif non résolu</p>
            ) : (
              unresolvedItems.map(item => <UnresolvedAsset key={item.itemKey} item={item} />)
            )}
            <Button asChild variant="outline" className="mt-3 w-full">
              <Link to="/orchestration">Ouvrir Asset Valuation</Link>
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function UnresolvedAsset({ item }: { item: ValuationUnresolvedItem }) {
  const provider =
    item.provider === 'manual-import' || item.provider === 'manual'
      ? 'Saisie manuelle'
      : (item.provider ?? 'Source inconnue')
  return (
    <article className="border-t border-border/60 pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{item.name}</h3>
        <ValuationState state="unresolved" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Source {provider}</p>
      <p className="mt-2 text-sm">Vérifier l’identité de l’actif ou compléter sa valorisation.</p>
    </article>
  )
}
