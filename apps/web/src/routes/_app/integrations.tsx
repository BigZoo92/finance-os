import { css } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Freshness,
  ProviderStatus,
} from '@finance-os/ui/components'
import { LinkPixelIcon } from '@finance-os/ui/icons/pixel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { useState } from 'react'
import { PageHeader } from '@/components/surfaces/page-header'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { dashboardQueryKeys } from '@/features/dashboard-query-options'
import { postExternalInvestmentSync } from '@/features/external-investments/api'
import {
  externalInvestmentsQueryKeys,
  externalInvestmentsStatusQueryOptionsWithMode,
} from '@/features/external-investments/query-options'
import type { ExternalInvestmentProvider } from '@/features/external-investments/types'
import { financialGoalsQueryKeys } from '@/features/goals/query-options'
import {
  canRunIntegrationAction,
  createIntegrationProviders,
  getSafeIntegrationError,
  type IntegrationPrimaryAction,
  type IntegrationProviderId,
} from '@/features/integrations-view-model'
import {
  deletePowensConnection,
  fetchPowensConnectUrl,
  postPowensSync,
} from '@/features/powens/api'
import { getPowensDisconnectActionState } from '@/features/powens/disconnect-action-state'
import {
  getPowensManualSyncCooldownSnapshot,
  getPowensManualSyncCooldownUiConfig,
  getPowensManualSyncUiState,
  powensManualSyncCooldownStore,
  startPowensManualSyncCooldown,
} from '@/features/powens/manual-sync-cooldown'
import { powensQueryKeys, powensStatusQueryOptionsWithMode } from '@/features/powens/query-options'
import type { PowensConnectionStatus } from '@/features/powens/types'
import { pushToast } from '@/lib/toast-store'
import { useIsMobile } from '@/lib/use-is-mobile'

export const Route = createFileRoute('/_app/integrations')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return
    await Promise.allSettled([
      context.queryClient.ensureQueryData(powensStatusQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(externalInvestmentsStatusQueryOptionsWithMode({ mode })),
    ])
  },
  component: IntegrationsPage,
})

const demoNotice = css({
  borderYWidth: '1px',
  borderColor: 'border/60',
  py: '3',
  textStyle: 'sm',
  color: 'muted.foreground',
})

const providerCard = css({
  display: 'flex',
  minH: '64',
  flexDirection: 'column',
  rounded: 'surface',
  borderWidth: '1px',
  borderColor: 'border/70',
  bg: 'card',
  p: '5',
  shadow: 'surface',
})

const providerName = css({
  fontFamily: 'pixel',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: 'primary',
})

const eyebrow = css({
  fontFamily: 'mono',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: 'muted.foreground',
})

const mutedText = css({ textStyle: 'sm', color: 'muted.foreground' })

const connectionRow = css({
  borderBottomWidth: '1px',
  borderColor: 'border/50',
  py: '4',
  _last: { borderBottomWidth: '0' },
})

const disconnectPanel = css({
  w: 'full',
  rounded: 'control',
  borderWidth: '1px',
  borderColor: 'negative/30',
  p: '3',
})

function IntegrationsPage() {
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProviderId | null>(null)
  const [pendingDisconnectId, setPendingDisconnectId] = useState<string | null>(null)
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isAdmin = authViewState === 'admin'
  const mode: AuthMode | undefined = isAdmin
    ? 'admin'
    : authViewState === 'demo'
      ? 'demo'
      : undefined
  const modeOptions = mode ? { mode } : {}
  const powensQuery = useQuery(powensStatusQueryOptionsWithMode(modeOptions))
  const externalQuery = useQuery(externalInvestmentsStatusQueryOptionsWithMode(modeOptions))
  const providers = createIntegrationProviders({
    powens: powensQuery.data,
    external: externalQuery.data,
  })
  const selected = providers.find(provider => provider.id === selectedProvider) ?? null
  const cooldownConfig = getPowensManualSyncCooldownUiConfig()
  const cooldownState = useStore(powensManualSyncCooldownStore)
  const cooldownSnapshot = getPowensManualSyncCooldownSnapshot(cooldownState)

  const invalidatePowens = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: powensQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: financialGoalsQueryKeys.list() }),
    ])

  const connectMutation = useMutation({
    mutationFn: async (action: Extract<IntegrationPrimaryAction, 'connect' | 'reconnect'>) => {
      if (!isAdmin) throw new Error('ADMIN_REQUIRED')
      const payload = await fetchPowensConnectUrl({})
      return { ...payload, action }
    },
    onSuccess: payload => window.location.assign(payload.url),
    onError: (_error, action) => {
      pushToast({
        title: action === 'reconnect' ? 'Reconnexion impossible' : 'Connexion impossible',
        description: getSafeIntegrationError(action),
        tone: 'error',
      })
    },
  })

  const powensSyncMutation = useMutation({
    mutationFn: async () => {
      if (!isAdmin) throw new Error('ADMIN_REQUIRED')
      return postPowensSync()
    },
    onSuccess: async () => {
      if (cooldownConfig.enabled) startPowensManualSyncCooldown(cooldownConfig.durationSeconds)
      await invalidatePowens()
      pushToast({
        title: 'Synchronisation démarrée',
        description: 'Les nouvelles données apparaîtront après leur traitement.',
        tone: 'success',
      })
    },
    onError: () => {
      pushToast({
        title: 'Synchronisation impossible',
        description: getSafeIntegrationError('sync'),
        tone: 'error',
      })
    },
  })

  const externalSyncMutation = useMutation({
    mutationFn: async (provider: ExternalInvestmentProvider) => {
      if (!isAdmin) throw new Error('ADMIN_REQUIRED')
      return postExternalInvestmentSync(provider)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: externalInvestmentsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
      ])
      pushToast({
        title: 'Synchronisation démarrée',
        description: 'Le portefeuille sera actualisé après son traitement.',
        tone: 'success',
      })
    },
    onError: () => {
      pushToast({
        title: 'Synchronisation impossible',
        description: getSafeIntegrationError('sync'),
        tone: 'error',
      })
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      if (!isAdmin) throw new Error('ADMIN_REQUIRED')
      return deletePowensConnection(connectionId)
    },
    onSuccess: async () => {
      setPendingDisconnectId(null)
      await invalidatePowens()
      pushToast({
        title: 'Connexion retirée',
        description: 'Les comptes associés ne sont plus affichés dans les vues actives.',
        tone: 'success',
      })
    },
    onError: () => {
      pushToast({
        title: 'Retrait impossible',
        description: getSafeIntegrationError('disconnect'),
        tone: 'error',
      })
    },
  })

  const powensSyncState = getPowensManualSyncUiState({
    cooldownUiEnabled: cooldownConfig.enabled,
    cooldownSnapshot,
    isIntegrationsSafeMode: providers[0]?.safeMode ?? false,
    isSyncPending: powensSyncMutation.isPending,
    mode,
  })

  const runPrimaryAction = (
    providerId: IntegrationProviderId,
    action: IntegrationPrimaryAction
  ) => {
    if (providerId === 'powens') {
      if (action === 'connect' || action === 'reconnect') connectMutation.mutate(action)
      if (action === 'sync') powensSyncMutation.mutate()
      return
    }
    if (action === 'sync') externalSyncMutation.mutate(providerId)
  }

  return (
    <styled.div spaceY="7">
      <PageHeader
        eyebrow="Ops"
        icon={<LinkPixelIcon size={12} />}
        title="Intégrations"
        description="Les connexions financières externes de Finance-OS."
      />

      {authViewState === 'demo' ? (
        <div className={demoNotice}>
          Lecture seule avec données de démonstration. Les actions de connexion sont réservées à
          l’Admin.
        </div>
      ) : null}

      <styled.section
        display="grid"
        gap="4"
        lg={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
        aria-label="Fournisseurs connectés"
      >
        {providers.map(provider => {
          const pending =
            provider.id === 'powens'
              ? connectMutation.isPending || powensSyncMutation.isPending
              : externalSyncMutation.isPending && externalSyncMutation.variables === provider.id
          const actionAllowed =
            canRunIntegrationAction({
              isAdmin,
              pending,
              safeMode: provider.safeMode,
              action: provider.primaryAction,
            }) &&
            !(
              provider.id === 'powens' &&
              provider.primaryAction === 'sync' &&
              powensSyncState.blocked
            )
          return (
            <article key={provider.id} className={providerCard}>
              <styled.div
                display="flex"
                alignItems="flex-start"
                justifyContent="space-between"
                gap="3"
              >
                <div>
                  <p className={providerName}>{provider.label}</p>
                  <styled.h2 mt="3" textStyle="md" fontWeight="semibold">
                    {provider.role}
                  </styled.h2>
                </div>
                <ProviderStatus status={provider.state} />
              </styled.div>
              <styled.p mt="4" textStyle="sm" color="muted.foreground">
                {provider.detail}
              </styled.p>
              <styled.div mt="4">
                <p className={eyebrow}>Dernière synchronisation</p>
                <Freshness asOf={provider.lastSyncAt} mt="2" />
              </styled.div>
              <styled.div
                mt="auto"
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gap="2"
                pt="6"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProvider(provider.id)}
                >
                  Détails
                </Button>
                {isAdmin && provider.primaryAction !== 'none' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!actionAllowed}
                    onClick={() => runPrimaryAction(provider.id, provider.primaryAction)}
                  >
                    {pending ? 'En cours' : provider.primaryActionLabel}
                  </Button>
                ) : null}
              </styled.div>
            </article>
          )
        })}
      </styled.section>

      <Drawer
        open={selected !== null}
        onOpenChange={open => {
          if (!open) {
            setSelectedProvider(null)
            setPendingDisconnectId(null)
          }
        }}
      >
        <DrawerContent side={isMobile ? 'bottom' : 'right'}>
          {selected ? (
            <>
              <DrawerHeader>
                <styled.div
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  gap="3"
                >
                  <DrawerTitle>{selected.label}</DrawerTitle>
                  <ProviderStatus status={selected.state} />
                </styled.div>
                <DrawerDescription>{selected.role}</DrawerDescription>
              </DrawerHeader>
              <styled.div spaceY="5" px="5" pb="6">
                <styled.div borderYWidth="1px" borderColor="border/60" py="4">
                  <p className={eyebrow}>Dernière synchronisation réussie</p>
                  <Freshness asOf={selected.lastSyncAt} mt="2" />
                </styled.div>
                {selected.id === 'powens' ? (
                  <PowensConnections
                    connections={powensQuery.data?.connections ?? []}
                    isAdmin={isAdmin}
                    pendingDisconnectId={pendingDisconnectId}
                    disconnectPending={disconnectMutation.isPending}
                    onStartDisconnect={setPendingDisconnectId}
                    onCancelDisconnect={() => setPendingDisconnectId(null)}
                    onConfirmDisconnect={connectionId => disconnectMutation.mutate(connectionId)}
                  />
                ) : (
                  <p className={mutedText}>
                    La connexion est gérée côté serveur et reste strictement en lecture seule.
                  </p>
                )}
              </styled.div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </styled.div>
  )
}

function PowensConnections({
  connections,
  isAdmin,
  pendingDisconnectId,
  disconnectPending,
  onStartDisconnect,
  onCancelDisconnect,
  onConfirmDisconnect,
}: {
  connections: PowensConnectionStatus[]
  isAdmin: boolean
  pendingDisconnectId: string | null
  disconnectPending: boolean
  onStartDisconnect: (connectionId: string) => void
  onCancelDisconnect: () => void
  onConfirmDisconnect: (connectionId: string) => void
}) {
  if (connections.length === 0) {
    return <p className={mutedText}>Aucune banque connectée</p>
  }
  return (
    <section aria-labelledby="powens-banks-title">
      <h3 id="powens-banks-title" className={eyebrow}>
        Banques
      </h3>
      <styled.div mt="2" borderYWidth="1px" borderColor="border/60">
        {connections.map(connection => {
          const confirming = pendingDisconnectId === connection.powensConnectionId
          const action = getPowensDisconnectActionState({
            isAdmin,
            isConfirming: confirming,
            isPending: disconnectPending && confirming,
          })
          const providerState =
            connection.status === 'connected'
              ? 'connected'
              : connection.status === 'syncing'
                ? 'syncing'
                : connection.status === 'reconnect_required'
                  ? 'reconnect_required'
                  : 'error'
          return (
            <div key={connection.id} className={connectionRow}>
              <styled.div display="flex" alignItems="center" justifyContent="space-between" gap="3">
                <styled.p textStyle="sm" fontWeight="medium">
                  {connection.providerInstitutionName ?? 'Banque connectée'}
                </styled.p>
                <ProviderStatus status={providerState} />
              </styled.div>
              {isAdmin ? (
                <styled.div mt="3" display="flex" flexWrap="wrap" justifyContent="flex-end" gap="2">
                  {action.showConfirmation ? (
                    <div
                      className={disconnectPanel}
                      role="alertdialog"
                      aria-label="Confirmer le retrait de la connexion"
                    >
                      <styled.p textStyle="sm">Retirer cette connexion bancaire&nbsp;?</styled.p>
                      <styled.div mt="3" display="flex" justifyContent="flex-end" gap="2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!action.canCancel}
                          onClick={onCancelDisconnect}
                        >
                          Annuler
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={!action.canConfirm}
                          onClick={() => onConfirmDisconnect(connection.powensConnectionId)}
                        >
                          {disconnectPending ? 'Retrait en cours' : 'Confirmer le retrait'}
                        </Button>
                      </styled.div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!action.canStart}
                      onClick={() => onStartDisconnect(connection.powensConnectionId)}
                    >
                      Retirer
                    </Button>
                  )}
                </styled.div>
              ) : null}
            </div>
          )
        })}
      </styled.div>
    </section>
  )
}
