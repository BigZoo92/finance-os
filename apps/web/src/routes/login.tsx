import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@finance-os/ui/components'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { postAuthLogin } from '@/features/auth-api'
import { authMeQueryOptions, authQueryKeys } from '@/features/auth-query-options'
import { dashboardQueryKeys } from '@/features/dashboard-query-options'
import { powensQueryKeys } from '@/features/powens/query-options'
import { pushToast } from '@/lib/toast-store'

const toErrorMessage = (value: unknown) => {
  if (value instanceof Error) {
    return value.message
  }

  return String(value)
}

export const Route = createFileRoute('/login')({
  validateSearch: search => ({
    reason: search.reason === 'powens_admin_required' ? 'powens_admin_required' : undefined,
  }),
  loader: async ({ context }) => {
    const auth = await context.queryClient.ensureQueryData(authMeQueryOptions())

    if (auth.mode === 'admin') {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const search = Route.useSearch()
  const infoMessage =
    search.reason === 'powens_admin_required'
      ? 'Connexion admin requise pour finaliser le callback Powens.'
      : null

  const loginMutation = useMutation({
    mutationFn: postAuthLogin,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: authQueryKeys.me(),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: powensQueryKeys.all,
        }),
      ])

      pushToast({
        title: 'Connexion reussie',
        description: 'Mode admin active.',
        tone: 'success',
      })

      void navigate({ to: '/' })
    },
    onError: error => {
      pushToast({
        title: 'Connexion refusee',
        description: toErrorMessage(error),
        tone: 'error',
      })
    },
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    if (!email || !password) {
      pushToast({
        title: 'Champs requis',
        description: 'Email et mot de passe sont obligatoires.',
        tone: 'info',
      })
      return
    }

    loginMutation.mutate({
      email,
      password,
    })
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(15,118,110,0.25),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.22),transparent_42%),hsl(var(--background))] p-6 text-foreground md:p-10">
      <div className="mx-auto w-full max-w-md">
        <Card className="border-emerald-500/30 bg-card/95 backdrop-blur-sm">
          <CardHeader className="space-y-2">
            <CardTitle>Connexion BigZoo</CardTitle>
            <CardDescription>
              Acces admin single-user pour afficher les vraies donnees.
            </CardDescription>
            {infoMessage ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-100">
                {infoMessage}
              </p>
            ) : null}
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Mot de passe
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? 'Connexion...' : 'Se connecter'}
              </Button>

              <Button asChild type="button" variant="ghost" className="w-full">
                <Link to="/">Retour dashboard</Link>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
