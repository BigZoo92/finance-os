import { css, cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
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

const demoNotice = css({
  borderYWidth: '1px',
  borderColor: 'border/60',
  py: '3',
  textStyle: 'sm',
  color: 'muted.foreground',
})

const healthBanner = cva({
  base: { borderYWidth: '1px', py: '6' },
  variants: {
    state: {
      healthy: { borderColor: 'positive/30' },
      degraded: { borderColor: 'warning/40' },
      unknown: { borderColor: 'border/60' },
    },
  },
})

// `text-[10px]` on the Status chip: the recipe's `xs` text style keeps its line
// height, so it is pinned to the inherited one like the former `leading-[inherit]`.
const healthState = css({
  fontFamily: 'mono',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  lineHeight: 'inherit',
})

const sectionTitle = css({ textStyle: 'sm', fontWeight: 'semibold' })

const framedList = css({ mt: '2', borderYWidth: '1px', borderColor: 'border/60' })

const listRow = cva({
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: '1px',
    borderColor: 'border/50',
    py: '4',
    _last: { borderBottomWidth: '0' },
  },
  variants: {
    wrap: {
      true: { flexWrap: 'wrap', gap: '3' },
      false: { gap: '4' },
    },
  },
  defaultVariants: { wrap: false },
})

const itemTitle = css({ textStyle: 'sm', fontWeight: 'medium' })

const itemMeta = css({ mt: '1', textStyle: 'xs', color: 'muted.foreground' })

const coverageValue = css({
  textStyle: 'financial',
  fontSize: '2xl',
  lineHeight: '2xl',
  fontWeight: 'semibold',
})

const coverageCount = css({ textStyle: 'financial', fontSize: 'xs', lineHeight: 'xs' })

// Tailwind's `space-y-3` put the margin on every child but the last; the
// trailing inline-flex button keeps its own `mt-3` on top of it.
const stackedList = css({ '& > :not(:last-child)': { marginBlockEnd: '3' } })

const unresolvedItem = css({
  borderTopWidth: '1px',
  borderColor: 'border/60',
  pt: '4',
  _first: { borderTopWidth: '0', pt: '0' },
})

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
    <styled.div spaceY="7">
      <PageHeader
        eyebrow="Ops"
        icon={<HeartbeatIcon size={12} />}
        title="Santé"
        description="L’état des connexions, des données et de la valorisation."
      />

      {authViewState === 'demo' ? (
        <div className={demoNotice}>
          Lecture seule avec données de démonstration. Aucun diagnostic réel n’est lancé.
        </div>
      ) : null}

      <section className={healthBanner({ state: model.state })} aria-live="polite">
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
          className={healthState}
        />
        <styled.h2 mt="3" textStyle="2xl" fontWeight="semibold" letterSpacing="tight">
          {model.headline}
        </styled.h2>
        <styled.p mt="1" textStyle="sm" color="muted.foreground">
          {model.summary}
        </styled.p>
      </section>

      {model.problems.length > 0 ? (
        <section aria-labelledby="health-problems-title">
          <h2 id="health-problems-title" className={sectionTitle}>
            À examiner
          </h2>
          <div className={framedList}>
            {model.problems.map(problem => (
              <div key={problem.id} className={listRow({ wrap: true })}>
                <styled.div minW="0">
                  <p className={itemTitle}>{problem.label}</p>
                  <p className={itemMeta}>{problem.detail}</p>
                </styled.div>
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

      <styled.div display="grid" gap="7" lg={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <section aria-labelledby="provider-health-title">
          <h2 id="provider-health-title" className={sectionTitle}>
            Connexions
          </h2>
          <div className={framedList}>
            {model.providers.map(provider => (
              <div key={provider.id} className={listRow()}>
                <styled.div minW="0">
                  <p className={itemTitle}>{provider.label}</p>
                  <p className={itemMeta}>{provider.detail}</p>
                </styled.div>
                <ProviderStatus status={provider.state} flexShrink="0" />
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="freshness-title">
          <h2 id="freshness-title" className={sectionTitle}>
            Fraîcheur
          </h2>
          <div className={framedList}>
            {model.freshness.map(item => (
              <div key={item.id} className={listRow()}>
                <p className={itemTitle}>{item.label}</p>
                <Freshness asOf={item.asOf} flexShrink="0" />
              </div>
            ))}
          </div>
        </section>
      </styled.div>

      <styled.section
        aria-labelledby="valuation-health-title"
        borderYWidth="1px"
        borderColor="border/60"
        py="5"
      >
        <styled.div
          display="flex"
          flexWrap="wrap"
          alignItems="flex-start"
          justifyContent="space-between"
          gap="4"
        >
          <div>
            <h2 id="valuation-health-title" className={sectionTitle}>
              Valorisation des actifs
            </h2>
            <p className={itemMeta}>
              {model.valuation.resolvedItems === null || model.valuation.totalItems === null
                ? 'Couverture indisponible'
                : `${model.valuation.resolvedItems} actifs résolus sur ${model.valuation.totalItems}`}
            </p>
          </div>
          <span className={coverageValue}>
            {model.valuation.coveragePercent === null
              ? 'Indisponible'
              : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(model.valuation.coveragePercent)} %`}
          </span>
        </styled.div>
        <Progress
          value={model.valuation.coveragePercent}
          tone={model.valuation.unresolvedItems ? 'warning' : 'positive'}
          label="Couverture de valorisation"
          mt="4"
        />
        {model.valuation.statusCounts ? (
          <styled.div mt="4" display="flex" flexWrap="wrap" columnGap="5" rowGap="2">
            {valuationStates.map(state =>
              model.valuation.statusCounts?.[state] ? (
                <styled.div key={state} display="flex" alignItems="center" gap="2">
                  <ValuationState state={state} />
                  <span className={coverageCount}>{model.valuation.statusCounts[state]}</span>
                </styled.div>
              ) : null
            )}
          </styled.div>
        ) : null}
      </styled.section>

      <Drawer open={unresolvedOpen} onOpenChange={setUnresolvedOpen}>
        <DrawerContent side={isMobile ? 'bottom' : 'right'}>
          <DrawerHeader>
            <DrawerTitle>Actifs non résolus</DrawerTitle>
            <DrawerDescription>Actifs sans valorisation suffisamment fiable.</DrawerDescription>
          </DrawerHeader>
          <styled.div px="5" pb="6" className={stackedList}>
            {unresolvedItems.length === 0 ? (
              <styled.p textStyle="sm" color="muted.foreground">
                Aucun actif non résolu
              </styled.p>
            ) : (
              unresolvedItems.map(item => <UnresolvedAsset key={item.itemKey} item={item} />)
            )}
            <Button asChild variant="outline" mt="3" w="full">
              <Link to="/orchestration">Ouvrir Asset Valuation</Link>
            </Button>
          </styled.div>
        </DrawerContent>
      </Drawer>
    </styled.div>
  )
}

function UnresolvedAsset({ item }: { item: ValuationUnresolvedItem }) {
  const provider =
    item.provider === 'manual-import' || item.provider === 'manual'
      ? 'Saisie manuelle'
      : (item.provider ?? 'Source inconnue')
  return (
    <article className={unresolvedItem}>
      <styled.div
        display="flex"
        flexWrap="wrap"
        alignItems="center"
        justifyContent="space-between"
        gap="2"
      >
        <h3 className={itemTitle}>{item.name}</h3>
        <ValuationState state="unresolved" />
      </styled.div>
      <p className={itemMeta}>Source {provider}</p>
      <styled.p mt="2" textStyle="sm">
        Vérifier l’identité de l’actif ou compléter sa valorisation.
      </styled.p>
    </article>
  )
}
