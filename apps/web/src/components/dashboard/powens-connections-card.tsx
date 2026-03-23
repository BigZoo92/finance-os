import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@finance-os/ui/components'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPowensConnectUrl, postPowensSync } from '@/features/powens/api'
import { powensQueryKeys, powensStatusQueryOptions } from '@/features/powens/query-options'
import type { PowensConnectionStatus } from '@/features/powens/types'

const STATUS_VARIANT: Record<
  PowensConnectionStatus['status'],
  'secondary' | 'outline' | 'destructive'
> = {
  connected: 'secondary',
  syncing: 'outline',
  error: 'destructive',
  reconnect_required: 'destructive',
}

const formatDateTime = (value: string | null) => {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString('fr-FR')
}

const toErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message
  }

  return String(value)
}

const formatSyncMetadata = (value: Record<string, unknown> | null) => {
  if (!value) {
    return null
  }

  const accountCount =
    typeof value.accountCount === 'number' ? `${value.accountCount} compte(s)` : null
  const importedTransactionCount =
    typeof value.importedTransactionCount === 'number'
      ? `${value.importedTransactionCount} transaction(s)`
      : null
  const windowDays = typeof value.windowDays === 'number' ? `${value.windowDays}j` : null

  return [accountCount, importedTransactionCount, windowDays].filter(Boolean).join(' • ') || null
}

export function PowensConnectionsCard() {
  const queryClient = useQueryClient()

  const statusQuery = useQuery(powensStatusQueryOptions())

  const connectMutation = useMutation({
    mutationFn: fetchPowensConnectUrl,
    onSuccess: payload => {
      window.location.assign(payload.url)
    },
  })

  const syncMutation = useMutation({
    mutationFn: () => postPowensSync(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: powensQueryKeys.status(),
      })
    },
  })

  const errors = [
    statusQuery.error
      ? {
          id: 'status',
          message: toErrorMessage(statusQuery.error),
        }
      : null,
    connectMutation.error
      ? {
          id: 'connect',
          message: toErrorMessage(connectMutation.error),
        }
      : null,
    syncMutation.error
      ? {
          id: 'sync',
          message: toErrorMessage(syncMutation.error),
        }
      : null,
  ].filter((error): error is { id: string; message: string } => Boolean(error))

  const connections = statusQuery.data?.connections ?? []

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Connexions Powens</CardTitle>
            <CardDescription>
              Vue locale des connexions et des dernieres synchronisations.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? 'Sync...' : 'Sync maintenant'}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? 'Ouverture...' : 'Connecter une banque'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {errors.map(error => (
          <p key={error.id} className="text-destructive">
            {error.message}
          </p>
        ))}

        {statusQuery.isPending ? <p className="text-muted-foreground">Chargement...</p> : null}

        {!statusQuery.isPending && connections.length === 0 ? (
          <p className="text-muted-foreground">Aucune connexion Powens enregistree.</p>
        ) : null}

        {!statusQuery.isPending
          ? connections.map(connection => (
              <div
                key={connection.id}
                className="rounded-md border border-border/80 bg-muted/20 px-3 py-2 space-y-1"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {connection.providerInstitutionName ??
                        `Connexion #${connection.powensConnectionId}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {connection.provider} • ref {connection.providerConnectionId}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[connection.status]}>{connection.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Derniere tentative: {formatDateTime(connection.lastSyncAttemptAt)} | Derniere
                  sync: {formatDateTime(connection.lastSyncAt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Dernier succes: {formatDateTime(connection.lastSuccessAt)}
                </p>
                {connection.lastFailedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Dernier echec: {formatDateTime(connection.lastFailedAt)}
                  </p>
                ) : null}
                {formatSyncMetadata(connection.syncMetadata) ? (
                  <p className="text-xs text-muted-foreground">
                    Metadata sync: {formatSyncMetadata(connection.syncMetadata)}
                  </p>
                ) : null}
                {connection.lastError ? (
                  <p className="text-xs text-destructive">Erreur: {connection.lastError}</p>
                ) : null}
              </div>
            ))
          : null}
      </CardContent>
    </Card>
  )
}
