import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { dashboardQueryKeys } from '@/features/dashboard-query-options'
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
import {
  powensDiagnosticsQueryOptionsWithMode,
  powensQueryKeys,
  powensStatusQueryOptionsWithMode,
  powensSyncRunsQueryOptionsWithMode,
  powensAuditTrailQueryOptionsWithMode,
} from '@/features/powens/query-options'
import { getPowensConnectionSyncBadgeModel } from '@/features/powens/sync-status'
import { pushToast } from '@/lib/toast-store'
import { formatDateTime, formatDuration, toErrorMessage } from '@/lib/format'
import { PageHeader } from '@/components/surfaces/page-header'
import { ActionDock } from '@/components/surfaces/action-dock'

export const Route = createFileRoute('/_app/integrations')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    const opts = { mode }
    await Promise.all([
      context.queryClient.ensureQueryData(powensStatusQueryOptionsWithMode(opts)),
      context.queryClient.ensureQueryData(powensSyncRunsQueryOptionsWithMode(opts)),
      context.queryClient.ensureQueryData(powensDiagnosticsQueryOptionsWithMode(opts)),
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
  const syncRunsQuery = useQuery(
    powensSyncRunsQueryOptionsWithMode(authMode ? { mode: authMode } : {})
  )
  const diagnosticsQuery = useQuery(
    powensDiagnosticsQueryOptionsWithMode(authMode ? { mode: authMode } : {})
  )
  const auditTrailQuery = useQuery(
    powensAuditTrailQueryOptionsWithMode(authMode ? { mode: authMode } : {})
  )

  const statusConnections = statusQuery.data?.connections ?? []
  const isIntegrationsSafeMode = statusQuery.data?.safeModeActive ?? false
  const syncStatusPersistenceEnabled = statusQuery.data?.syncStatusPersistenceEnabled ?? false
  const syncRuns = syncRunsQuery.data?.runs ?? []
  const diagnostics = diagnosticsQuery.data
  const auditEvents = auditTrailQuery.data?.events ?? []

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

  const diagnosticsOutcomeBadge: Record<
    string,
    { label: string; variant: 'secondary' | 'outline' | 'destructive' }
  > = {
    ok: { label: 'OK', variant: 'secondary' },
    degraded: { label: 'Dégradé', variant: 'outline' },
    timeout: { label: 'Timeout', variant: 'destructive' },
    auth_error: { label: 'Auth', variant: 'destructive' },
    provider_error: { label: 'Erreur', variant: 'destructive' },
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Connexions bancaires"
        icon="⊞"
        title="Intégrations"
        description="Connexions Powens, orchestration de la synchronisation et diagnostics opérationnels."
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

      {/* Sync runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Derniers runs de synchronisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {syncRunsQuery.isPending ? (
            <div className="space-y-2">
              {Array.from(
                { length: 3 },
                (_, index) => `integration-sync-skeleton-${index + 1}`
              ).map(key => (
                <div key={key} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : syncRuns.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Aucun run récent.</p>
          ) : (
            syncRuns.slice(0, 10).map(run => (
              <div
                key={run.id}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-surface-1 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">#{run.connectionId}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatDateTime(run.startedAt)}
                    </span>
                    {formatDuration(run.startedAt, run.endedAt) && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        · {formatDuration(run.startedAt, run.endedAt)}
                      </span>
                    )}
                  </p>
                  {run.errorMessage && (
                    <p className="text-xs text-destructive truncate">{run.errorMessage}</p>
                  )}
                </div>
                <Badge
                  variant={
                    run.result === 'success'
                      ? 'secondary'
                      : run.result === 'running'
                        ? 'outline'
                        : 'destructive'
                  }
                  className="text-xs"
                >
                  {run.result}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Diagnostics */}
      {diagnostics && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Diagnostic provider</CardTitle>
              <Badge variant={diagnosticsOutcomeBadge[diagnostics.outcome]?.variant ?? 'outline'}>
                {diagnosticsOutcomeBadge[diagnostics.outcome]?.label ?? diagnostics.outcome}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{diagnostics.guidance}</p>
            <p className="text-xs text-muted-foreground">
              Dernière vérification : {formatDateTime(diagnostics.lastCheckedAt)}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => diagnosticsQuery.refetch()}
              disabled={diagnosticsQuery.isFetching}
              className="text-xs"
            >
              Re-vérifier
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Audit trail */}
      {auditEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audit trail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {auditEvents.slice(0, 10).map(event => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-surface-1 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {event.action} · {event.actorMode}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(event.at)}</p>
                </div>
                <Badge
                  variant={event.result === 'allowed' ? 'secondary' : 'destructive'}
                  className="text-xs"
                >
                  {event.result}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action dock */}
      <ActionDock
        items={[
          {
            icon: <span aria-hidden="true">⊞</span>,
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
          {
            icon: <span aria-hidden="true">♡</span>,
            label: 'Diagnostiquer',
            tone: 'positive',
            disabled: diagnosticsQuery.isFetching,
            onClick: () => diagnosticsQuery.refetch(),
          },
          {
            icon: <span aria-hidden="true">▣</span>,
            label: 'Audit trail',
            tone: 'plain',
            disabled: auditEvents.length === 0,
            onClick: () => {
              const target = document.querySelector('[data-section="audit"]')
              target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            },
          },
        ]}
        className="mt-6"
      />
    </div>
  )
}
