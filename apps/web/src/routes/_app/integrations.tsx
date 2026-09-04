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
    <div className="space-y-7">
      <PageHeader
        eyebrow="Ops"
        icon={<LinkPixelIcon size={12} />}
        title="Intégrations"
        description="Les connexions financières externes de Finance-OS."
      />

      {authViewState === 'demo' ? (
        <div className="border-y border-border/60 py-3 text-sm text-muted-foreground">
          Lecture seule avec données de démonstration. Les actions de connexion sont réservées à
          l’Admin.
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3" aria-label="Fournisseurs connectés">
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
            <article
              key={provider.id}
              className="flex min-h-64 flex-col rounded-surface border border-border/70 bg-card p-5 shadow-surface"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-pixel text-[10px] uppercase tracking-[0.14em] text-primary">
                    {provider.label}
                  </p>
                  <h2 className="mt-3 text-base font-semibold">{provider.role}</h2>
                </div>
                <ProviderStatus status={provider.state} />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{provider.detail}</p>
              <div className="mt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Dernière synchronisation
                </p>
                <Freshness asOf={provider.lastSyncAt} className="mt-2" />
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-6">
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
              </div>
            </article>
          )
        })}
      </section>

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
                <div className="flex items-center justify-between gap-3">
                  <DrawerTitle>{selected.label}</DrawerTitle>
                  <ProviderStatus status={selected.state} />
                </div>
                <DrawerDescription>{selected.role}</DrawerDescription>
              </DrawerHeader>
              <div className="space-y-5 px-5 pb-6">
                <div className="border-y border-border/60 py-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Dernière synchronisation réussie
                  </p>
                  <Freshness asOf={selected.lastSyncAt} className="mt-2" />
                </div>
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
                  <p className="text-sm text-muted-foreground">
                    La connexion est gérée côté serveur et reste strictement en lecture seule.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
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
    return <p className="text-sm text-muted-foreground">Aucune banque connectée</p>
  }
  return (
    <section aria-labelledby="powens-banks-title">
      <h3
        id="powens-banks-title"
        className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
      >
        Banques
      </h3>
      <div className="mt-2 border-y border-border/60">
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
            <div key={connection.id} className="border-b border-border/50 py-4 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  {connection.providerInstitutionName ?? 'Banque connectée'}
                </p>
                <ProviderStatus status={providerState} />
              </div>
              {isAdmin ? (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {action.showConfirmation ? (
                    <div
                      className="w-full rounded-control border border-negative/30 p-3"
                      role="alertdialog"
                      aria-label="Confirmer le retrait de la connexion"
                    >
                      <p className="text-sm">Retirer cette connexion bancaire&nbsp;?</p>
                      <div className="mt-3 flex justify-end gap-2">
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
                      </div>
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
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
