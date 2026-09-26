import {
  Amount,
  CurrencyAmount,
  Freshness,
  Progress,
  ProviderStatus,
  Status,
  ValuationState,
  type ProviderStatusKind,
} from '@finance-os/ui/components'
import { BankPixelIcon } from '@finance-os/ui/icons/pixel'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ManualAssetsEditor } from '@/components/patrimoine/manual-assets-editor'
import { PersonalEmptyState } from '@/components/personal/personal-ux'
import { PageHeader } from '@/components/surfaces/page-header'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { dashboardSummaryQueryOptionsWithMode } from '@/features/dashboard-query-options'
import type { DashboardRange, DashboardSummaryResponse } from '@/features/dashboard-types'
import { buildPatrimoineViewModel } from '@/features/patrimoine-view-model'

const searchSchema = z.object({ range: z.enum(['7d', '30d', '90d']).optional() })
const resolveRange = (value: string | undefined): DashboardRange =>
  value === '7d' || value === '90d' ? value : '30d'

const connectionStatus = (
  status: DashboardSummaryResponse['connections'][number]['status']
): ProviderStatusKind => {
  if (status === 'connected') return 'connected'
  if (status === 'syncing') return 'syncing'
  if (status === 'reconnect_required') return 'reconnect_required'
  return 'error'
}

const assetTypeLabel = (type: DashboardSummaryResponse['assets'][number]['type']) => {
  if (type === 'cash') return 'Liquidités'
  if (type === 'investment') return 'Investissement'
  return 'Manuel'
}

export const Route = createFileRoute('/_app/patrimoine')({
  validateSearch: search => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ range: resolveRange(search.range) }),
  loader: async ({ context, deps }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return
    await context.queryClient.ensureQueryData(
      dashboardSummaryQueryOptionsWithMode({ range: deps.range, mode })
    )
  },
  component: PatrimoinePage,
})

function PatrimoinePage() {
  const { range: searchRange } = Route.useSearch()
  const range = resolveRange(searchRange)
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin
    ? 'admin'
    : authViewState === 'demo'
      ? 'demo'
      : undefined
  const summaryQuery = useQuery(
    dashboardSummaryQueryOptionsWithMode({ range, ...(authMode ? { mode: authMode } : {}) })
  )
  const summary = summaryQuery.data
  const model = buildPatrimoineViewModel(summary)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Vue consolidée"
        icon={<BankPixelIcon size={12} />}
        title="Patrimoine"
        status={
          summaryQuery.isPending ? (
            <Status tone="progress" label="Chargement" />
          ) : summaryQuery.isError ? (
            <Status tone="attention" label="Données indisponibles" />
          ) : model.totalValue === null ? (
            <Status tone="attention" label="Valorisation incomplète" />
          ) : (
            <Status tone="positive" label="Patrimoine consolidé" />
          )
        }
      />

      <section className="border-y border-border py-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)] md:items-end">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Valeur nette connue
            </p>
            <Amount
              value={model.totalValue}
              decimals={0}
              className="mt-2 block text-4xl font-semibold sm:text-5xl"
            />
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              <Freshness asOf={model.asOf} />
              {model.unknownValueCount > 0 ? (
                <Status
                  tone="attention"
                  label={`${model.unknownValueCount} valeur${model.unknownValueCount > 1 ? 's' : ''} inconnue${model.unknownValueCount > 1 ? 's' : ''}`}
                />
              ) : null}
            </div>
          </div>
          <div className="border-l border-border pl-5 max-md:border-l-0 max-md:border-t max-md:pl-0 max-md:pt-5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Couverture de valorisation</span>
              <span className="font-financial">
                {model.coveragePercent === null
                  ? 'Indisponible'
                  : `${model.coveragePercent.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`}
              </span>
            </div>
            <Progress
              value={model.coveragePercent}
              label="Couverture de valorisation"
              className="mt-3"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.48fr)]">
        <div>
          <h2 className="text-lg font-semibold">Composition connue</h2>
          <div className="mt-3 divide-y divide-border border-y border-border">
            {model.buckets.map(bucket => (
              <div
                key={bucket.key}
                className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div>
                  <p className="font-medium">{bucket.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {bucket.itemCount} actif{bucket.itemCount !== 1 ? 's' : ''}
                    {bucket.unknownValueCount > 0
                      ? `, ${bucket.unknownValueCount} sans conversion fiable`
                      : ''}
                  </p>
                </div>
                <Amount
                  value={bucket.value}
                  decimals={0}
                  className="text-lg font-semibold sm:text-right"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="border-l border-border pl-6 max-lg:border-l-0 max-lg:border-t max-lg:pl-0 max-lg:pt-6">
          <h2 className="text-lg font-semibold">Évolution</h2>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Données insuffisantes
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            L’historique actuel ne permet pas de calculer une performance patrimoniale fiable.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Connexions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            État des sources qui alimentent le patrimoine.
          </p>
        </div>
        {summary?.connections.length ? (
          <div className="divide-y divide-border border-y border-border">
            {summary.connections.map(connection => (
              <div
                key={connection.powensConnectionId}
                className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {connection.providerInstitutionName ?? 'Établissement non identifié'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {connection.accountCount} compte{connection.accountCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <Freshness asOf={connection.lastSuccessAt ?? connection.lastSyncAt} />
                  <ProviderStatus status={connectionStatus(connection.status)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <PersonalEmptyState
            title="Aucune connexion"
            description="Aucune source bancaire n’alimente actuellement le patrimoine."
          />
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Actifs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Valeurs natives et état de leur valorisation.
          </p>
        </div>
        {summary?.assets.length ? (
          <div className="divide-y divide-border border-y border-border">
            {summary.assets.map(asset => (
              <article
                key={asset.assetId}
                className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-medium">{asset.name}</p>
                    <ValuationState
                      state={
                        asset.valuationStatus ??
                        (asset.origin === 'manual' ? 'manual' : 'unavailable')
                      }
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {assetTypeLabel(asset.type)}
                    {asset.providerInstitutionName ? `, ${asset.providerInstitutionName}` : ''}
                  </p>
                </div>
                <div className="sm:text-right">
                  <CurrencyAmount
                    value={asset.valuation}
                    currency={asset.currency}
                    className="font-semibold"
                  />
                  <Freshness asOf={asset.valuationAsOf} className="mt-1 flex sm:justify-end" />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <PersonalEmptyState
            title="Aucun actif"
            description="Les actifs apparaîtront ici lorsqu’une source ou une saisie manuelle en fournit."
          />
        )}
      </section>

      {isAdmin ? <ManualAssetsEditor range={range} /> : null}
    </div>
  )
}
