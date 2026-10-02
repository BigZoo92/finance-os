import { css } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import {
  Amount,
  CurrencyAmount,
  Freshness,
  Progress,
  ProviderStatus,
  type ProviderStatusKind,
  Status,
  ValuationState,
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

// `divide-y divide-border border-y border-border`: framed list with a rule between rows.
const dividedList = css({
  borderYWidth: '1px',
  borderColor: 'border',
  '& > :not(:last-child)': { borderBottomWidth: '1px', borderColor: 'border' },
})

const sectionTitle = css({ textStyle: 'lg', fontWeight: 'semibold' })

const sectionLead = css({ mt: '1', textStyle: 'sm', color: 'muted.foreground' })

const itemMeta = css({ mt: '1', textStyle: 'xs', color: 'muted.foreground' })

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
    <styled.div spaceY="8">
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

      <styled.section borderYWidth="1px" borderColor="border" py="6">
        <styled.div
          display="grid"
          gap="6"
          md={{
            gridTemplateColumns: 'minmax(0, 1.3fr) minmax(16rem, 0.7fr)',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <styled.p
              fontFamily="mono"
              fontSize="11px"
              textTransform="uppercase"
              letterSpacing="0.16em"
              color="muted.foreground"
            >
              Valeur nette connue
            </styled.p>
            <Amount
              value={model.totalValue}
              decimals={0}
              mt="2"
              display="block"
              textStyle="4xl"
              fontWeight="semibold"
              sm={{ textStyle: '5xl' }}
            />
            <styled.div mt="3" display="flex" flexWrap="wrap" columnGap="5" rowGap="2">
              <Freshness asOf={model.asOf} />
              {model.unknownValueCount > 0 ? (
                <Status
                  tone="attention"
                  label={`${model.unknownValueCount} valeur${model.unknownValueCount > 1 ? 's' : ''} inconnue${model.unknownValueCount > 1 ? 's' : ''}`}
                />
              ) : null}
            </styled.div>
          </div>
          <styled.div
            borderLeftWidth="1px"
            borderColor="border"
            pl="5"
            mdDown={{ borderLeftWidth: '0', borderTopWidth: '1px', pl: '0', pt: '5' }}
          >
            <styled.div
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              gap="4"
              textStyle="sm"
            >
              <styled.span color="muted.foreground">Couverture de valorisation</styled.span>
              <span className={css({ textStyle: 'financial' })}>
                {model.coveragePercent === null
                  ? 'Indisponible'
                  : `${model.coveragePercent.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`}
              </span>
            </styled.div>
            <Progress value={model.coveragePercent} label="Couverture de valorisation" mt="3" />
          </styled.div>
        </styled.div>
      </styled.section>

      <styled.section
        display="grid"
        gap="6"
        lg={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(18rem, 0.48fr)' }}
      >
        <div>
          <h2 className={sectionTitle}>Composition connue</h2>
          <styled.div mt="3" className={dividedList}>
            {model.buckets.map(bucket => (
              <styled.div
                key={bucket.key}
                display="grid"
                gap="2"
                py="4"
                sm={{ gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center' }}
              >
                <div>
                  <styled.p fontWeight="medium">{bucket.label}</styled.p>
                  <p className={itemMeta}>
                    {bucket.itemCount} actif{bucket.itemCount !== 1 ? 's' : ''}
                    {bucket.unknownValueCount > 0
                      ? `, ${bucket.unknownValueCount} sans conversion fiable`
                      : ''}
                  </p>
                </div>
                <Amount
                  value={bucket.value}
                  decimals={0}
                  textStyle="lg"
                  fontWeight="semibold"
                  sm={{ textAlign: 'right' }}
                />
              </styled.div>
            ))}
          </styled.div>
        </div>
        <styled.div
          borderLeftWidth="1px"
          borderColor="border"
          pl="6"
          lgDown={{ borderLeftWidth: '0', borderTopWidth: '1px', pl: '0', pt: '6' }}
        >
          <h2 className={sectionTitle}>Évolution</h2>
          <styled.p
            mt="4"
            fontFamily="mono"
            textStyle="xs"
            textTransform="uppercase"
            letterSpacing="0.12em"
            color="muted.foreground"
          >
            Données insuffisantes
          </styled.p>
          <styled.p mt="2" textStyle="sm" lineHeight="relaxed" color="muted.foreground">
            L’historique actuel ne permet pas de calculer une performance patrimoniale fiable.
          </styled.p>
        </styled.div>
      </styled.section>

      <styled.section spaceY="4">
        <div>
          <h2 className={sectionTitle}>Connexions</h2>
          <p className={sectionLead}>État des sources qui alimentent le patrimoine.</p>
        </div>
        {summary?.connections.length ? (
          <div className={dividedList}>
            {summary.connections.map(connection => (
              <styled.div
                key={connection.powensConnectionId}
                display="flex"
                flexDirection="column"
                gap="2"
                py="4"
                sm={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div>
                  <styled.p fontWeight="medium">
                    {connection.providerInstitutionName ?? 'Établissement non identifié'}
                  </styled.p>
                  <p className={itemMeta}>
                    {connection.accountCount} compte{connection.accountCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <styled.div display="flex" flexWrap="wrap" alignItems="center" gap="4">
                  <Freshness asOf={connection.lastSuccessAt ?? connection.lastSyncAt} />
                  <ProviderStatus status={connectionStatus(connection.status)} />
                </styled.div>
              </styled.div>
            ))}
          </div>
        ) : (
          <PersonalEmptyState
            title="Aucune connexion"
            description="Aucune source bancaire n’alimente actuellement le patrimoine."
          />
        )}
      </styled.section>

      <styled.section spaceY="4">
        <div>
          <h2 className={sectionTitle}>Actifs</h2>
          <p className={sectionLead}>Valeurs natives et état de leur valorisation.</p>
        </div>
        {summary?.assets.length ? (
          <div className={dividedList}>
            {summary.assets.map(asset => (
              <styled.article
                key={asset.assetId}
                display="grid"
                gap="3"
                py="4"
                sm={{ gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center' }}
              >
                <styled.div minW="0">
                  <styled.div display="flex" flexWrap="wrap" alignItems="center" gap="3">
                    <styled.p fontWeight="medium">{asset.name}</styled.p>
                    <ValuationState
                      state={
                        asset.valuationStatus ??
                        (asset.origin === 'manual' ? 'manual' : 'unavailable')
                      }
                    />
                  </styled.div>
                  <p className={itemMeta}>
                    {assetTypeLabel(asset.type)}
                    {asset.providerInstitutionName ? `, ${asset.providerInstitutionName}` : ''}
                  </p>
                </styled.div>
                <styled.div sm={{ textAlign: 'right' }}>
                  <CurrencyAmount
                    value={asset.valuation}
                    currency={asset.currency}
                    fontWeight="semibold"
                  />
                  <Freshness
                    asOf={asset.valuationAsOf}
                    mt="1"
                    display="flex"
                    sm={{ justifyContent: 'flex-end' }}
                  />
                </styled.div>
              </styled.article>
            ))}
          </div>
        ) : (
          <PersonalEmptyState
            title="Aucun actif"
            description="Les actifs apparaîtront ici lorsqu’une source ou une saisie manuelle en fournit."
          />
        )}
      </styled.section>

      {isAdmin ? <ManualAssetsEditor range={range} /> : null}
    </styled.div>
  )
}
