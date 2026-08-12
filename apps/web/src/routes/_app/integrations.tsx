import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@finance-os/ui/components'
import { LinkPixelIcon, RefreshPixelIcon } from '@finance-os/ui/icons/pixel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { useState } from 'react'
import { ActionDock } from '@/components/surfaces/action-dock'
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
import { getPowensConnectionSyncBadgeModel } from '@/features/powens/sync-status'
import { formatDateTime, toErrorMessage } from '@/lib/format'
import { pushToast } from '@/lib/toast-store'

const EXTERNAL_PROVIDERS: ExternalInvestmentProvider[] = ['ibkr', 'binance']

const providerLabel = (provider: ExternalInvestmentProvider) =>
  provider === 'ibkr' ? 'IBKR Flex' : 'Binance Spot'

export const Route = createFileRoute('/_app/integrations')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    const opts = { mode }
    await Promise.all([
      context.queryClient.ensureQueryData(powensStatusQueryOptionsWithMode(opts)),
      context.queryClient.ensureQueryData(externalInvestmentsStatusQueryOptionsWithMode(opts)),
    ])
  },
  component: IntegrationsPage,
})

function IntegrationsPage() {
  const queryClient = useQueryClient()
  const [pendingDisconnectConnectionId, setPendingDisconnectConnectionId] = useState<string | null>(
    null
  )
  const manualSyncCooldownUiConfig = getPowensManualSyncCooldownUiConfig()
  const manualSyncCooldownState = useStore(powensManualSyncCooldownStore)
  const manualSyncCooldownSnapshot = getPowensManualSyncCooldownSnapshot(manualSyncCooldownState)

  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const statusQuery = useQuery(powensStatusQueryOptionsWithMode(authMode ? { mode: authMode } : {}))
  const externalStatusQuery = useQuery(
    externalInvestmentsStatusQueryOptionsWithMode(authMode ? { mode: authMode } : {})
  )

  const statusConnections = statusQuery.data?.connections ?? []
  const externalConnections = externalStatusQuery.data?.connections ?? []
  const externalHealth = externalStatusQuery.data?.health ?? []
  const isIntegrationsSafeMode = statusQuery.data?.safeModeActive ?? false
  const isExternalSafeMode = externalStatusQuery.data?.safeModeActive ?? false
  const syncStatusPersistenceEnabled = statusQuery.data?.syncStatusPersistenceEnabled ?? false

  const manualSyncUiState = getPowensManualSyncUiState({
    cooldownUiEnabled: manualSyncCooldownUiConfig.enabled,
    cooldownSnapshot: manualSyncCooldownSnapshot,
    isIntegrationsSafeMode,
    isSyncPending: false,
    mode: authMode,
  })

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!isAdmin) throw new Error('Admin session required')
      return fetchPowensConnectUrl({})
    },
    onSuccess: payload => {
      window.location.assign(payload.url)
    },
    onError: error => {
      pushToast({
        title: 'Connexion impossible',
        description: toErrorMessage(error),
        tone: 'error',
      })
    },
  })

  const syncMutation = useMutation({
    mutationFn: async ({ connectionId }: { connectionId?: string } = {}) => {
      if (!isAdmin) throw new Error('Admin session required')
      return postPowensSync(connectionId ? { connectionId } : {})
    },
    onSuccess: async () => {
      if (manualSyncCooldownUiConfig.enabled) {
        startPowensManualSyncCooldown(manualSyncCooldownUiConfig.durationSeconds)
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.status() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.syncRuns() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.diagnostics() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: financialGoalsQueryKeys.list() }),
      ])
      pushToast({
        title: 'Sync enfilée',
        description: 'Le worker va traiter la synchronisation.',
        tone: 'success',
      })
    },
    onError: error => {
      pushToast({ title: 'Sync refusée', description: toErrorMessage(error), tone: 'error' })
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: async ({ connectionId }: { connectionId: string }) => {
      if (!isAdmin) throw new Error('Admin session required')
      return deletePowensConnection(connectionId)
    },
    onSuccess: async payload => {
      setPendingDisconnectConnectionId(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.status() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.syncRuns() }),
        queryClient.invalidateQueries({ queryKey: powensQueryKeys.diagnostics() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: financialGoalsQueryKeys.list() }),
      ])
      pushToast({
        title: payload.disconnected ? 'Connexion retiree' : 'Connexion deja retiree',
        description: 'Les comptes lies sont caches des vues actives.',
        tone: 'success',
      })
    },
    onError: error => {
      pushToast({ title: 'Retrait refuse', description: toErrorMessage(error), tone: 'error' })
    },
  })

  const invalidateExternalInvestments = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: externalInvestmentsQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
    ])
  }

  const externalSyncMutation = useMutation({
    mutationFn: async ({ provider }: { provider?: ExternalInvestmentProvider } = {}) => {
      if (!isAdmin) throw new Error('Admin session required')
      return postExternalInvestmentSync(provider)
    },
    onSuccess: async payload => {
      await invalidateExternalInvestments()
      pushToast({
        title: 'Sync investissements enfilee',
        description: `${payload.enqueued.length} provider${payload.enqueued.length !== 1 ? 's' : ''} en file worker.`,
        tone: 'success',
      })
    },
    onError: error => {
      pushToast({ title: 'Sync refusee', description: toErrorMessage(error), tone: 'error' })
    },
  })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Intelligence & Admin"
        icon={<LinkPixelIcon size={12} />}
        title="Intégrations"
        description="Connexions, synchronisations et diagnostics provider. Le cockpit reste utilisable si une source est dégradée."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate({})}
              disabled={manualSyncUiState.blocked || syncMutation.isPending}
            >
              <span aria-hidden="true">⟳</span>
              {syncMutation.isPending ? 'Sync…' : 'Lancer une sync'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="aurora"
              onClick={() => connectMutation.mutate()}
              disabled={!isAdmin || isIntegrationsSafeMode || connectMutation.isPending}
            >
              {connectMutation.isPending ? 'Ouverture…' : 'Connecter une banque'}
            </Button>
          </>
        }
      />

      {isIntegrationsSafeMode && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm text-warning">
            Safe mode actif : connexions et synchronisations Powens temporairement bloquées.
          </CardContent>
        </Card>
      )}

      {isExternalSafeMode && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm text-warning">
            Safe mode investissements actif : IBKR et Binance ne seront pas appeles par le worker.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Investissements externes</CardTitle>
              <CardDescription>
                IBKR Flex et Binance Spot sont configurés côté serveur et restent strictement en
                lecture seule.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                !isAdmin ||
                isExternalSafeMode ||
                externalSyncMutation.isPending ||
                !EXTERNAL_PROVIDERS.some(
                  provider => externalStatusQuery.data?.providerConfigured?.[provider]
                )
              }
              onClick={() => externalSyncMutation.mutate({})}
            >
              <RefreshPixelIcon size={14} />
              {externalSyncMutation.isPending && !externalSyncMutation.variables?.provider
                ? 'Sync...'
                : 'Sync IBKR + Binance'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-2">
            {EXTERNAL_PROVIDERS.map(provider => {
              const connection = externalConnections.find(item => item.provider === provider)
              const health = externalHealth.find(item => item.provider === provider)
              const configured = externalStatusQuery.data?.providerConfigured?.[provider] ?? false
              const isProviderSyncPending =
                externalSyncMutation.isPending &&
                externalSyncMutation.variables?.provider === provider
              return (
                <div key={provider} className="rounded-lg border border-border/50 bg-surface-1 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{providerLabel(provider)}</p>
                      <p className="text-xs text-muted-foreground">
                        {provider === 'ibkr'
                          ? 'Flex Web Service reporting; aucun endpoint trading.'
                          : 'Spot USER_DATA / Wallet GET; trading, transfert et retrait interdits.'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Dernier succes :{' '}
                        {formatDateTime(health?.lastSuccessAt ?? connection?.lastSuccessAt ?? null)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge variant={configured ? 'positive' : 'outline'}>
                        {configured ? 'Configuré via l’environnement' : 'Non configuré'}
                      </Badge>
                      <Badge
                        variant={
                          health?.status === 'healthy'
                            ? 'positive'
                            : health?.status === 'failing'
                              ? 'destructive'
                              : health?.status === 'degraded'
                                ? 'warning'
                                : 'outline'
                        }
                      >
                        {health?.status ?? 'idle'}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      disabled={
                        !isAdmin || !configured || isExternalSafeMode || isProviderSyncPending
                      }
                      onClick={() => externalSyncMutation.mutate({ provider })}
                    >
                      {isProviderSyncPending ? 'Sync...' : 'Synchroniser'}
                    </Button>
                  </div>
                  {connection?.lastErrorMessage && (
                    <p className="mt-2 text-xs text-destructive">{connection.lastErrorMessage}</p>
                  )}
                  {health?.lastRequestId && (
                    <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
                      request {health.lastRequestId}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connexions</CardTitle>
          <CardDescription>
            {statusConnections.length} connexion{statusConnections.length !== 1 ? 's' : ''}{' '}
            enregistrée{statusConnections.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {statusQuery.isPending ? (
            <div className="space-y-3">
              {Array.from(
                { length: 2 },
                (_, index) => `integration-status-skeleton-${index + 1}`
              ).map(key => (
                <div key={key} className="h-20 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : statusConnections.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aucune connexion Powens.
            </p>
          ) : (
            statusConnections.map(connection => {
              const syncBadge = getPowensConnectionSyncBadgeModel({
                connection,
                persistenceEnabled: syncStatusPersistenceEnabled,
              })
              const isConfirmingDisconnect =
                pendingDisconnectConnectionId === connection.powensConnectionId
              const isDisconnectPending =
                disconnectMutation.isPending &&
                disconnectMutation.variables?.connectionId === connection.powensConnectionId
              const disconnectAction = getPowensDisconnectActionState({
                isAdmin,
                isConfirming: isConfirmingDisconnect,
                isPending: isDisconnectPending,
              })
              return (
                <div
                  key={connection.id}
                  className="rounded-lg border border-border/50 bg-surface-1 p-4 transition-colors hover:bg-surface-2"
                  style={{ transitionDuration: 'var(--duration-fast)' }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">
                        {connection.providerInstitutionName ??
                          `Connexion #${connection.powensConnectionId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {connection.provider} · ref {connection.providerConnectionId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Dernière sync : {formatDateTime(connection.lastSyncAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={syncBadge.badgeVariant}
                        className={syncBadge.badgeClassName}
                        title={syncBadge.tooltipLabel}
                      >
                        {syncBadge.badgeLabel}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        disabled={
                          manualSyncUiState.blocked || syncMutation.isPending || isDisconnectPending
                        }
                        onClick={() =>
                          syncMutation.mutate({ connectionId: connection.powensConnectionId })
                        }
                      >
                        Sync
                      </Button>
                      {disconnectAction.showConfirmation ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            disabled={!disconnectAction.canCancel}
                            onClick={() => setPendingDisconnectConnectionId(null)}
                          >
                            Annuler
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="text-xs"
                            disabled={!disconnectAction.canConfirm}
                            onClick={() =>
                              disconnectMutation.mutate({
                                connectionId: connection.powensConnectionId,
                              })
                            }
                          >
                            {isDisconnectPending ? 'Retrait...' : 'Confirmer'}
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          disabled={!disconnectAction.canStart}
                          onClick={() =>
                            setPendingDisconnectConnectionId(connection.powensConnectionId)
                          }
                        >
                          Retirer
                        </Button>
                      )}
                    </div>
                  </div>
                  {connection.lastError && (
                    <p className="mt-2 text-xs text-destructive">{connection.lastError}</p>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Action dock */}
      <ActionDock
        items={[
          {
            icon: <LinkPixelIcon size={16} />,
            label: 'Connecter banque',
            tone: 'brand',
            disabled: !isAdmin || isIntegrationsSafeMode || connectMutation.isPending,
            onClick: () => connectMutation.mutate(),
          },
          {
            icon: <span aria-hidden="true">⟳</span>,
            label: 'Sync immédiate',
            tone: 'violet',
            disabled: manualSyncUiState.blocked || syncMutation.isPending,
            onClick: () => syncMutation.mutate({}),
          },
        ]}
        className="mt-6"
      />
    </div>
  )
}
