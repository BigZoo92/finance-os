import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import {
  dashboardDerivedRecomputeStatusQueryOptionsWithMode,
  dashboardQueryKeys,
} from '@/features/dashboard-query-options'
import {
  normalizeDashboardDerivedRecomputeActionError,
  postDashboardDerivedRecompute,
} from '@/features/dashboard-api'
import { postPushOptIn, postPushPreview, postPushSubscription } from '@/features/notifications/api'
import { pushSettingsQueryOptionsWithMode, notificationsQueryKeys } from '@/features/notifications/query-options'
import { PushNotificationCard } from '@/components/dashboard/push-notification-card'
import { pushToast } from '@/lib/toast-store'
import { formatDateTime, toErrorMessage } from '@/lib/format'

export const Route = createFileRoute('/_app/parametres')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined = auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return
    await Promise.all([
      context.queryClient.ensureQueryData(pushSettingsQueryOptionsWithMode({ mode })),
      context.queryClient.ensureQueryData(dashboardDerivedRecomputeStatusQueryOptionsWithMode({ mode })),
    ])
  },
  component: ParametresPage,
})

function ParametresPage() {
  const queryClient = useQueryClient()

  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const pushSettingsQuery = useQuery(pushSettingsQueryOptionsWithMode(authMode ? { mode: authMode } : {}))
  const derivedRecomputeStatusQuery = useQuery(
    dashboardDerivedRecomputeStatusQueryOptionsWithMode(authMode ? { mode: authMode } : {})
  )

  const derivedStatus = derivedRecomputeStatusQuery.data
  const derivedLatestRun = derivedStatus?.latestRun ?? null
  const derivedCurrentSnapshot = derivedStatus?.currentSnapshot ?? null

  const pushOptInMutation = useMutation({
    mutationFn: () => {
      if (!isAdmin) throw new Error('Admin session required')
      return postPushOptIn({
        optIn: !(pushSettingsQuery.data?.optIn ?? false),
        permission: pushSettingsQuery.data?.permission ?? 'unknown',
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.pushSettings() })
      pushToast({ title: 'Préférence push mise à jour', tone: 'success' })
    },
    onError: error => {
      pushToast({ title: 'Erreur push', description: toErrorMessage(error), tone: 'error' })
    },
  })

  const pushRegisterMutation = useMutation({
    mutationFn: () => {
      if (!isAdmin) throw new Error('Admin session required')
      return postPushSubscription({
        endpoint: isDemo ? 'demo://subscription' : 'https://example.invalid/subscription',
        keys: { auth: 'masked_auth', p256dh: 'masked_p256dh' },
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.pushSettings() })
      pushToast({ title: 'Subscription enregistrée', tone: 'success' })
    },
    onError: error => {
      pushToast({ title: 'Subscription échouée', description: toErrorMessage(error), tone: 'error' })
    },
  })

  const pushPreviewMutation = useMutation({
    mutationFn: () => {
      if (!isAdmin) throw new Error('Admin session required')
      return postPushPreview()
    },
    onSuccess: payload => {
      pushToast(
        payload.ok
          ? { title: 'Preview envoyé', tone: 'success' as const }
          : { title: 'Preview dégradé', description: payload.message, tone: 'info' as const }
      )
    },
    onError: error => {
      pushToast({ title: 'Preview impossible', description: toErrorMessage(error), tone: 'error' })
    },
  })

  const derivedRecomputeMutation = useMutation({
    mutationFn: async () => {
      if (!isAdmin) throw new Error('Admin session required')
      return postDashboardDerivedRecompute()
    },
    onSuccess: () => {
      pushToast({ title: 'Recompute terminée', description: 'Le snapshot dérivé actif a été remplacé.', tone: 'success' })
    },
    onError: error => {
      const normalized = normalizeDashboardDerivedRecomputeActionError(error)
      pushToast({ title: 'Recompute échouée', description: normalized.message, tone: 'error' })
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all })
    },
  })

  const derivedState = derivedRecomputeMutation.isPending ? 'running' : (derivedStatus?.state ?? 'idle')
  const derivedFeatureEnabled = derivedStatus?.featureEnabled ?? true

  const DERIVED_STATE_LABEL: Record<string, { label: string; variant: 'secondary' | 'outline' | 'destructive' }> = {
    idle: { label: 'Idle', variant: 'outline' },
    running: { label: 'En cours', variant: 'outline' },
    completed: { label: 'Terminé', variant: 'secondary' },
    failed: { label: 'Échoué', variant: 'destructive' },
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Paramètres</h2>
        <p className="text-sm text-muted-foreground">Notifications, exports et configuration système</p>
      </div>

      {/* Push notifications */}
      <PushNotificationCard
        {...(pushSettingsQuery.data ? { settings: pushSettingsQuery.data } : {})}
        unavailable={Boolean(
          pushSettingsQuery.data &&
            (pushSettingsQuery.data.unavailableReason ||
              !pushSettingsQuery.data.featureEnabled ||
              !pushSettingsQuery.data.criticalEnabled)
        )}
        readOnly={!isAdmin}
        onToggle={() => pushOptInMutation.mutate()}
        onRegisterSubscription={() => pushRegisterMutation.mutate()}
        onSendPreview={() => pushPreviewMutation.mutate()}
        busy={pushOptInMutation.isPending || pushRegisterMutation.isPending || pushPreviewMutation.isPending}
      />

      {/* Derived recompute */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Derived recompute</CardTitle>
            <Badge variant={DERIVED_STATE_LABEL[derivedState]?.variant ?? 'outline'}>
              {DERIVED_STATE_LABEL[derivedState]?.label ?? derivedState}
            </Badge>
            {!derivedFeatureEnabled && <Badge variant="outline">OFF</Badge>}
          </div>
          <CardDescription>
            Recalcule les champs dérivés depuis provider_raw_import puis remplace le snapshot actif.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <div className="rounded-lg border border-border/50 bg-surface-1 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">État</p>
              <p className="mt-1 text-sm font-medium">{DERIVED_STATE_LABEL[derivedState]?.label ?? derivedState}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-surface-1 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Snapshot actif</p>
              <p className="mt-1 text-sm font-medium">{derivedCurrentSnapshot?.snapshotVersion ?? '-'}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(derivedCurrentSnapshot?.finishedAt ?? null)}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-surface-1 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Dernier run</p>
              <p className="mt-1 text-sm font-medium">{formatDateTime(derivedLatestRun?.finishedAt ?? null)}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-surface-1 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Comptage</p>
              <p className="mt-1 text-sm font-medium">
                {derivedLatestRun?.rowCounts ? `${derivedLatestRun.rowCounts.transactionUpdatedCount} maj` : '-'}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant={derivedState === 'failed' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => derivedRecomputeMutation.mutate()}
            disabled={!isAdmin || !derivedFeatureEnabled || derivedRecomputeMutation.isPending}
          >
            {derivedRecomputeMutation.isPending ? 'Recompute...' : derivedState === 'failed' ? 'Réessayer' : 'Lancer recompute'}
          </Button>
        </CardContent>
      </Card>

      {/* Export section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exports</CardTitle>
          <CardDescription>Exporter vos données financières</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Les exports CSV et PDF sont disponibles depuis la page Dépenses pour les transactions de la période sélectionnée.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
