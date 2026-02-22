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
import { postPowensCallback, postPowensSync } from '@/features/powens/api'
import { powensQueryKeys } from '@/features/powens/query-options'

type CallbackLoaderState =
  | { status: 'success'; connectionId: string }
  | { status: 'error'; message: string }

const toErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message
  }

  return String(value)
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
        ? String(search.connection_id)
        : '',
    code: typeof search.code === 'string' ? search.code : '',
  }),
  loaderDeps: ({ search }) => ({
    connectionId: search.connection_id,
    code: search.code,
  }),
  staleTime: Number.POSITIVE_INFINITY,
  loader: async ({ deps }): Promise<CallbackLoaderState> => {
    if (!deps.connectionId || !deps.code) {
      return {
        status: 'error',
        message: 'Parametres manquants dans l URL de callback Powens.',
      }
    }

    try {
      await postPowensCallback({
        connectionId: deps.connectionId,
        code: deps.code,
      })

      return {
        status: 'success',
        connectionId: deps.connectionId,
      }
    } catch (error) {
      return {
        status: 'error',
        message: toErrorMessage(error),
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
      await queryClient.invalidateQueries({
        queryKey: powensQueryKeys.status(),
      })
    },
  })

  if (state.status === 'error') {
    return renderLayout(
      <div className="space-y-3">
        <p className="text-destructive">Erreur: {state.message}</p>
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
        <p className="text-destructive">Erreur: {toErrorMessage(syncMutation.error)}</p>
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
