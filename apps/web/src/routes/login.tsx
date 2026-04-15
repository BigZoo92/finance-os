import { Button, Input } from '@finance-os/ui/components'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { motion } from 'motion/react'
import { postAuthLogin } from '@/features/auth-api'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { dashboardQueryKeys } from '@/features/dashboard-query-options'
import { powensQueryKeys } from '@/features/powens/query-options'
import { pushToast } from '@/lib/toast-store'
import { AuroraBackdrop } from '@/components/brand/aurora-backdrop'
import { BrandMark } from '@/components/brand/brand-mark'
import { BorderGlow } from '@/components/reactbits/border-glow'
import { ShinyText } from '@/components/reactbits/shiny-text'

const toErrorMessage = (value: unknown) => {
  if (value instanceof Error) return value.message
  return String(value)
}

export const Route = createFileRoute('/login')({
  validateSearch: search => ({
    reason: search.reason === 'powens_admin_required' ? 'powens_admin_required' : undefined,
  }),
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    if (auth.mode === 'admin') throw redirect({ to: '/' })
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
      await queryClient.fetchQuery(authMeQueryOptions())
      queryClient.removeQueries({ queryKey: dashboardQueryKeys.all })
      queryClient.removeQueries({ queryKey: powensQueryKeys.all })
      pushToast({ title: 'Connexion réussie', description: 'Mode admin actif.', tone: 'success' })
      void navigate({ to: '/' })
    },
    onError: error => {
      pushToast({
        title: 'Connexion refusée',
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
    loginMutation.mutate({ email, password })
  }

  return (
    <main
      id="main-content"
      className="relative min-h-screen overflow-hidden bg-background p-6 text-foreground md:p-10"
    >
      <AuroraBackdrop intensity={0.6} />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col items-center justify-center">
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 flex flex-col items-center gap-3"
        >
          <BrandMark size="xl" />
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              <ShinyText text="Finance OS" speed={4} />
            </h1>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-primary/70">
              cockpit · personnel · premium
            </p>
          </div>
        </motion.div>

        {/* Auth card with BorderGlow */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="w-full"
        >
          <BorderGlow
            animated
            borderRadius={22}
            glowIntensity={0.6}
            backgroundColor="var(--card)"
            colors={['#ff5db1', '#c084fc', '#7aa2ff']}
            glowColor="335 92 68"
            className="w-full"
          >
            <div className="p-6 md:p-8">
              <h2 className="text-lg font-semibold tracking-tight">Accès admin</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Single-user. Vos vraies données en restant maître du serveur.
              </p>

              {infoMessage && (
                <p className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                  {infoMessage}
                </p>
              )}

              <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground" htmlFor="email">
                    Email
                  </label>
                  <Input id="email" name="email" type="email" autoComplete="email" required />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground" htmlFor="password">
                    Mot de passe
                  </label>
                  <Input id="password" name="password" type="password" autoComplete="current-password" required />
                </div>

                <Button
                  type="submit"
                  variant="aurora"
                  size="lg"
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? 'Connexion…' : 'Se connecter'}
                </Button>

                <Button asChild type="button" variant="ghost" className="w-full">
                  <Link to="/">Retour au cockpit en démo</Link>
                </Button>
              </form>
            </div>
          </BorderGlow>
        </motion.div>

        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/50">
          finance-os · {new Date().getFullYear()}
        </p>
      </div>
    </main>
  )
}
