import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@finance-os/ui/components'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { dashboardQueryKeys } from '@/features/dashboard-query-options'
import { postPowensCallback, postPowensSync } from '@/features/powens/api'
import { powensQueryKeys } from '@/features/powens/query-options'
import { sanitizePowensConnectionId } from '@/features/powens/sanitize-connection-id'
import { ApiRequestError } from '@/lib/api'

type CallbackLoaderState =
  | { status: 'success'; connectionId: string }
  | { status: 'error'; message: string; requestId?: string; canRetryAsAdmin?: boolean }

const toErrorState = (value: unknown) => {
  if (value instanceof ApiRequestError) {
    if (value.code === 'DEMO_MODE_FORBIDDEN') {
      return {
        message: 'Connecte-toi en admin pour finaliser la connexion Powens.',
        requestId: value.requestId,
        canRetryAsAdmin: true,
      } as const
    }

    if (value.status === 401 || value.status === 403) {
      return {
        message: 'Session admin requise pour finaliser la connexion Powens.',
        requestId: value.requestId,
        canRetryAsAdmin: true,
      } as const
    }

    return {
      message: value.message,
      requestId: value.requestId,
      canRetryAsAdmin: false,
    } as const
  }

  if (value instanceof Error) {
    return {
      message: value.message,
      canRetryAsAdmin: false,
    } as const
  }

  return {
    message: String(value),
    canRetryAsAdmin: false,
  } as const
}

const renderLayout = (content: ReactNode) => {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="mx-auto w-full max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Callback Powens</CardTitle>
            <CardDescription>Finalisation de la connexion bancaire.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">{content}</CardContent>
        </Card>
      </div>
    </div>
  )
}

function PowensCallbackPendingPage() {
  return renderLayout(<p>Connexion en cours...</p>)
}

export const Route = createFileRoute('/powens/callback')({
  validateSearch: search => ({
    connection_id:
      typeof search.connection_id === 'string' || typeof search.connection_id === 'number'
        ? sanitizePowensConnectionId(String(search.connection_id))
        : '',
    code: typeof search.code === 'string' ? search.code : '',
    state: typeof search.state === 'string' ? search.state : '',
  }),
  loaderDeps: ({ search }) => ({
    connectionId: search.connection_id,
    code: search.code,
    state: search.state,
  }),
  staleTime: Number.POSITIVE_INFINITY,
  loader: async ({ deps }): Promise<CallbackLoaderState> => {
    if (!deps.connectionId || !deps.code) {
      return {
        status: 'error',
        message: 'Parametres manquants dans l URL de callback Powens.',
        canRetryAsAdmin: false,
      }
    }

    try {
      await postPowensCallback({
        connectionId: deps.connectionId,
        code: deps.code,
        state: deps.state || undefined,
      })

      return {
        status: 'success',
        connectionId: deps.connectionId,
      }
    } catch (error) {
      const normalizedError = toErrorState(error)
      return {
        status: 'error',
        message: normalizedError.message,
        requestId: normalizedError.requestId,
        canRetryAsAdmin: normalizedError.canRetryAsAdmin,
      }
    }
  },
  pendingComponent: PowensCallbackPendingPage,
  component: PowensCallbackPage,
})

function PowensCallbackPage() {
  const state = Route.useLoaderData()
  const queryClient = useQueryClient()

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (state.status !== 'success') {
        return
      }

      await postPowensSync({
        connectionId: state.connectionId,
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: powensQueryKeys.status(),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.all,
        }),
      ])
    },
  })

  if (state.status === 'error') {
    return renderLayout(
      <div className="space-y-3">
        <p className="text-destructive">Erreur: {state.message}</p>
        {state.requestId ? (
          <p className="text-xs text-muted-foreground">Request ID: {state.requestId}</p>
        ) : null}
        {state.canRetryAsAdmin ? (
          <Button asChild type="button">
            <Link to="/login">Se connecter en admin</Link>
          </Button>
        ) : null}
        <Button asChild type="button" variant="outline">
          <Link to="/">Retour dashboard</Link>
        </Button>
      </div>
    )
  }

  return renderLayout(
    <>
      <p className="text-emerald-600 dark:text-emerald-400">Connexion OK.</p>
      {syncMutation.isError ? (
        <p className="text-destructive">Erreur: {toErrorState(syncMutation.error).message}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
          {syncMutation.isPending ? 'Sync...' : 'Lancer sync'}
        </Button>
        <Button asChild type="button" variant="outline">
          <Link to="/">Retour dashboard</Link>
        </Button>
      </div>
    </>
  )
}
