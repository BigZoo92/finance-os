import { Button, Input } from '@finance-os/ui/components'
import { EyePixelIcon } from '@finance-os/ui/icons/pixel/eye'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { BrandMark } from '@/components/brand/brand-mark'
import { postAuthLogin } from '@/features/auth-api'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { removeDashboardQueriesForAuthTransition } from '@/features/dashboard-query-options'
import { removeKnowledgeQueriesForAuthTransition } from '@/features/knowledge-query-options'
import { powensQueryKeys } from '@/features/powens/query-options'
import { ApiRequestError } from '@/lib/api'
import { pushToast } from '@/lib/toast-store'

const toLoginErrorMessage = (value: unknown) => {
  if (value instanceof ApiRequestError && (value.status === 401 || value.status === 403)) {
    return 'Identifiants incorrects'
  }
  return 'Connexion indisponible. Réessayez dans un instant.'
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

const signalWidths = [
  359, 116, 353, 142, 344, 167, 333, 191, 321, 214, 306, 236, 290, 257, 272, 276, 252,
  294,
] as const

function LoginSignalField() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="login-ledger-grid absolute inset-0" />
      <div className="login-signal-glow absolute left-[8%] top-[7%] h-[86%] w-[66%]" />
      <div className="login-signal-blade absolute bottom-[8%] left-[40.3%] top-[10%] w-px">
        <span className="absolute -left-0.5 -top-0.5 size-[5px] bg-primary" />
        <span className="absolute -bottom-0.5 -left-0.5 size-[5px] bg-primary" />
      </div>
      <div className="absolute left-[42%] top-[18.8%] hidden w-[25%] min-w-72 flex-col gap-8 md:flex">
        {signalWidths.map((width, index) => {
          const isSignal = index === 8 || index === 9
          return (
            <span
              className={isSignal ? 'login-signal-line is-active' : 'login-signal-line'}
              key={`${String(width)}-${String(index)}`}
              style={{ width: `${String((width / 359) * 100)}%` }}
            >
              {isSignal ? <span /> : null}
            </span>
          )
        })}
      </div>
      <div className="absolute bottom-[9%] left-[8%] size-2 text-foreground/25 before:absolute before:left-1/2 before:h-full before:w-px before:bg-current after:absolute after:top-1/2 after:h-px after:w-full after:bg-current" />
      <div className="absolute right-[5.5%] top-[13%] size-2 text-foreground/25 before:absolute before:left-1/2 before:h-full before:w-px before:bg-current after:absolute after:top-1/2 after:h-px after:w-full after:bg-current" />
    </div>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const search = Route.useSearch()
  const [showPassword, setShowPassword] = useState(false)
  const infoMessage =
    search.reason === 'powens_admin_required'
      ? 'Connexion admin requise pour finaliser le retour Powens.'
      : null

  const loginMutation = useMutation({
    mutationFn: postAuthLogin,
    onSuccess: async () => {
      await queryClient.fetchQuery(authMeQueryOptions())
      removeKnowledgeQueriesForAuthTransition(queryClient)
      removeDashboardQueriesForAuthTransition(queryClient)
      queryClient.removeQueries({ queryKey: powensQueryKeys.all })
      pushToast({ title: 'Connexion réussie', description: 'Mode admin actif.', tone: 'success' })
      void navigate({ to: '/' })
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

  const errorMessage = loginMutation.error ? toLoginErrorMessage(loginMutation.error) : null
  const formMessage = errorMessage ?? infoMessage
  const isError = Boolean(errorMessage)

  return (
    <main
      id="main-content"
      className="login-canvas relative min-h-screen min-h-[100svh] overflow-x-hidden text-foreground md:min-h-[100dvh]"
    >
      <LoginSignalField />

      <header className="login-reveal-brand relative z-10 flex items-center gap-2.5 px-6 pt-[max(1.5rem,env(safe-area-inset-top))] md:absolute md:left-11 md:top-9 md:p-0">
        <BrandMark size="md" className="md:h-7 md:w-7" />
        <span className="text-sm font-semibold tracking-[-0.01em] md:text-[15px]">Finance-OS</span>
      </header>

      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-4.25rem)] w-full max-w-[1220px] grid-rows-[minmax(13rem,0.75fr)_auto] gap-8 px-6 pb-[max(3.5rem,env(safe-area-inset-bottom))] pt-12 md:min-h-[100dvh] md:grid-cols-[minmax(0,1fr)_380px] md:grid-rows-1 md:items-center md:gap-20 md:px-0 md:py-20">
        <section className="login-reveal-title relative self-center pl-7 md:pl-0" aria-labelledby="login-title">
          <div className="pointer-events-none absolute bottom-[-28%] left-0 top-[-30%] w-px bg-gradient-to-b from-transparent via-primary/80 to-transparent md:hidden">
            <span className="absolute -left-0.5 top-0 size-1 bg-primary" />
          </div>
          <h1
            id="login-title"
            className="text-[clamp(3.15rem,16vw,4rem)] font-bold leading-[0.94] tracking-[-0.05em] md:text-[clamp(5.75rem,8.5vw,7.75rem)]"
          >
            <span className="block">FINANCE</span>
            <span className="flex items-start gap-2.5 md:gap-[18px]">
              <span className="login-wordmark-outline">OS</span>
              <span className="mt-3 size-1.5 bg-primary md:mt-[22px] md:size-[9px]" />
            </span>
          </h1>
          <p className="mt-[18px] font-mono text-[9px] uppercase tracking-[0.3em] text-foreground/40 md:mt-[34px] md:text-[11px] md:tracking-[0.34em]">
            Personal finance OS
          </p>
        </section>

        <section className="login-reveal-panel w-full self-end rounded-surface border border-foreground/13 bg-[var(--login-panel)] p-6 shadow-[0_30px_70px_oklch(0_0_0/32%)] md:self-center md:p-8 md:shadow-[0_40px_90px_oklch(0_0_0/34%)]">
          <h2 className="text-base font-semibold tracking-[-0.01em] md:text-[17px]">Se connecter</h2>

          <div className="mt-3 min-h-5" aria-live="polite" aria-atomic="true">
            {formMessage ? (
              <p
                id="login-message"
                className={
                  isError
                    ? 'flex items-center gap-2 text-xs text-negative'
                    : 'flex items-center gap-2 text-xs text-warning'
                }
              >
                <span className="size-[5px] shrink-0 rounded-full bg-current" aria-hidden="true" />
                {formMessage}
              </p>
            ) : null}
          </div>

          <form className="mt-2" onSubmit={handleSubmit} aria-busy={loginMutation.isPending}>
            <div>
              <label
                className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-foreground/50"
                htmlFor="email"
              >
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="email"
                placeholder="votre@email.fr"
                className="mt-2 h-11 bg-[var(--login-field)] px-3.5 text-sm shadow-none"
                required
              />
            </div>

            <div className="mt-[18px]">
              <label
                className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-foreground/50"
                htmlFor="password"
              >
                Mot de passe
              </label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={isError}
                  aria-describedby={formMessage ? 'login-message' : undefined}
                  className="h-11 bg-[var(--login-field)] px-3.5 pr-12 text-sm shadow-none"
                  required
                />
                <button
                  type="button"
                  className="absolute right-0 top-0 grid size-11 place-items-center rounded-control text-foreground/50 transition-[color,transform] duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70 active:scale-[0.96]"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(value => !value)}
                >
                  <EyePixelIcon size={16} />
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="secondary"
              size="lg"
              className="mt-[26px] w-full rounded-control border-0 bg-foreground text-background shadow-sm hover:bg-foreground/90 hover:text-background"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <span className="login-activity" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <span className="size-[7px] bg-primary" aria-hidden="true" />
              )}
              {loginMutation.isPending ? 'Connexion' : 'Se connecter'}
            </Button>

            <Button asChild type="button" variant="ghost" className="mt-1.5 ml-auto flex min-h-10 w-fit px-0 text-xs">
              <Link to="/">Continuer en démo</Link>
            </Button>
          </form>
        </section>
      </div>

      <footer className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-6 z-10 flex gap-4 font-mono text-[9px] uppercase tracking-[0.14em] text-foreground/30 md:bottom-8 md:left-11 md:gap-[22px] md:text-[10px]">
        <span>EUR</span>
        <span>Paris</span>
        <span>Admin</span>
      </footer>
    </main>
  )
}
