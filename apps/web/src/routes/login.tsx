import { css, cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Button, Input } from '@finance-os/ui/components'
import { EyePixelIcon } from '@finance-os/ui/icons/pixel/eye'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
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
  359, 116, 353, 142, 344, 167, 333, 191, 321, 214, 306, 236, 290, 257, 272, 276, 252, 294,
] as const

/*
 * Login signature composition. The static layers below are the former
 * `login-*` rules of the UI package globals, kept declaration for declaration
 * (gradients on the `login.*` tokens, 767px mobile overrides as `mdDown`,
 * reveal / activity motion gated by `_motionSafe`).
 */

const loginCanvas = css({
  position: 'relative',
  minH: '100vh',
  overflowX: 'hidden',
  color: 'foreground',
  bgImage:
    'radial-gradient(1200px 760px at 42% 46%, {colors.login.canvas.center} 0%, {colors.login.canvas.mid} 55%, {colors.login.canvas.edge} 100%)',
  md: { minH: '100dvh' },
  mdDown: {
    bgImage:
      'radial-gradient(500px 420px at 30% 32%, {colors.login.canvas.center} 0%, {colors.login.canvas.mid} 60%, {colors.login.canvas.edge} 100%)',
  },
})

const ledgerGrid = css({
  position: 'absolute',
  inset: '0',
  bgImage:
    'repeating-linear-gradient(0deg, oklch(from {colors.foreground} l c h / 3%) 0, oklch(from {colors.foreground} l c h / 3%) 1px, transparent 1px, transparent 73px), repeating-linear-gradient(90deg, oklch(from {colors.foreground} l c h / 3%) 0, oklch(from {colors.foreground} l c h / 3%) 1px, transparent 1px, transparent 73px)',
  mdDown: { backgroundSize: '65px 65px' },
})

const signalGlow = css({
  position: 'absolute',
  left: '8%',
  top: '7%',
  h: '86%',
  w: '66%',
  bgImage: 'radial-gradient(ellipse, oklch(from {colors.primary} l c h / 16%) 0%, transparent 70%)',
})

const signalBlade = css({
  position: 'absolute',
  bottom: '8%',
  left: '40.3%',
  top: '10%',
  w: '1px',
  bgImage:
    'linear-gradient(to bottom, transparent 0%, oklch(from {colors.primary} l c h / 85%) 18%, oklch(from {colors.primary} l c h / 85%) 82%, transparent 100%)',
})

const signalLine = cva({
  base: {
    position: 'relative',
    display: 'block',
    h: '1.5px',
    bg: 'oklch(from {colors.foreground} l c h / 24%)',
  },
  variants: {
    active: {
      true: {
        bg: 'oklch(from {colors.primary} l c h / 75%)',
        '& > span': {
          position: 'absolute',
          top: '-1.25px',
          right: '-6px',
          w: '4px',
          h: '4px',
          bg: 'oklch(from {colors.primary} l c h / 90%)',
        },
      },
      false: {},
    },
  },
})

const crosshair = cva({
  base: {
    position: 'absolute',
    boxSize: '2',
    color: 'foreground/25',
    _before: {
      content: '""',
      position: 'absolute',
      left: '50%',
      h: 'full',
      w: '1px',
      bg: 'currentColor',
    },
    _after: {
      content: '""',
      position: 'absolute',
      top: '50%',
      h: '1px',
      w: 'full',
      bg: 'currentColor',
    },
  },
  variants: {
    corner: {
      bottomLeft: { bottom: '9%', left: '8%' },
      topRight: { right: '5.5%', top: '13%' },
    },
  },
})

const brandHeader = css({
  position: 'relative',
  zIndex: '10',
  display: 'flex',
  alignItems: 'center',
  gap: '2.5',
  px: '6',
  pt: 'max(1.5rem, env(safe-area-inset-top))',
  md: { position: 'absolute', left: '11', top: '9', px: '0', pt: '0' },
  _motionSafe: { animation: 'loginReveal 420ms {easings.outExpo} both' },
})

const loginGrid = css({
  position: 'relative',
  zIndex: '10',
  mx: 'auto',
  display: 'grid',
  minH: 'calc(100svh - 4.25rem)',
  w: 'full',
  maxW: '1220px',
  gridTemplateRows: 'minmax(13rem, 0.75fr) auto',
  gap: '8',
  px: '6',
  pb: 'max(3.5rem, env(safe-area-inset-bottom))',
  pt: '12',
  md: {
    minH: '100dvh',
    gridTemplateColumns: 'minmax(0, 1fr) 380px',
    gridTemplateRows: 'repeat(1, minmax(0, 1fr))',
    alignItems: 'center',
    gap: '20',
    px: '0',
    pt: '20',
    pb: '20',
  },
})

const titleSection = css({
  position: 'relative',
  alignSelf: 'center',
  pl: '7',
  md: { pl: '0' },
  _motionSafe: { animation: 'loginReveal 420ms {easings.outExpo} 60ms both' },
})

const mobileTitleRail = css({
  pointerEvents: 'none',
  position: 'absolute',
  bottom: '-28%',
  left: '0',
  top: '-30%',
  w: '1px',
  bgImage:
    'linear-gradient(to bottom in oklab, transparent 0%, color-mix(in srgb, {colors.primary} 80%, transparent) 50%, transparent 100%)',
  md: { display: 'none' },
})

const wordmark = css({
  fontSize: 'clamp(3.15rem, 16vw, 4rem)',
  fontWeight: 'bold',
  lineHeight: '0.94',
  letterSpacing: '-0.05em',
  md: { fontSize: 'clamp(5.75rem, 8.5vw, 7.75rem)' },
})

const wordmarkOutline = css({
  color: 'transparent',
  WebkitTextStroke: '1.5px oklch(from {colors.foreground} l c h / 55%)',
})

const loginPanel = css({
  w: 'full',
  alignSelf: 'flex-end',
  rounded: 'surface',
  borderWidth: '1px',
  borderColor: 'foreground/13',
  bg: 'login.panel',
  p: '6',
  boxShadow: '0 30px 70px oklch(0 0 0 / 32%)',
  md: { alignSelf: 'center', p: '8', boxShadow: '0 40px 90px oklch(0 0 0 / 34%)' },
  _motionSafe: { animation: 'loginReveal 420ms {easings.outExpo} 120ms both' },
})

const formMessage = cva({
  base: { display: 'flex', alignItems: 'center', gap: '2', textStyle: 'xs' },
  variants: {
    tone: {
      error: { color: 'negative' },
      info: { color: 'warning' },
    },
  },
})

const fieldLabel = css({
  fontFamily: 'mono',
  fontSize: '10px',
  fontWeight: 'medium',
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
  color: 'foreground/50',
})

const passwordToggle = css({
  position: 'absolute',
  right: '0',
  top: '0',
  display: 'grid',
  boxSize: '11',
  placeItems: 'center',
  rounded: 'control',
  color: 'foreground/50',
  transitionProperty: 'color, transform',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  _hover: { color: 'foreground' },
  _focusVisible: {
    outlineStyle: 'none',
    boxShadow: 'inset 0 0 0 2px color-mix(in srgb, {colors.primary} 70%, transparent)',
  },
  _active: { scale: '0.96' },
})

const loginActivity = css({
  display: 'inline-flex',
  gap: '3px',
  '& > span': {
    w: '5px',
    h: '5px',
    bg: 'primary',
    _motionSafe: { animation: 'loginActivity 700ms ease-in-out infinite' },
  },
  '& > span:nth-child(2)': {
    _motionSafe: { animation: 'loginActivity 700ms ease-in-out 90ms infinite' },
  },
  '& > span:nth-child(4)': {
    _motionSafe: { animation: 'loginActivity 700ms ease-in-out 90ms infinite' },
  },
  '& > span:nth-child(3)': {
    _motionSafe: { animation: 'loginActivity 700ms ease-in-out 180ms infinite' },
  },
})

function LoginSignalField() {
  return (
    <styled.div
      aria-hidden="true"
      pointerEvents="none"
      position="absolute"
      inset="0"
      overflow="hidden"
    >
      <div className={ledgerGrid} />
      <div className={signalGlow} />
      <div className={signalBlade}>
        <styled.span position="absolute" left="-0.5" top="-0.5" boxSize="5px" bg="primary" />
        <styled.span position="absolute" bottom="-0.5" left="-0.5" boxSize="5px" bg="primary" />
      </div>
      <styled.div
        position="absolute"
        left="42%"
        top="18.8%"
        display="none"
        w="25%"
        minW="72"
        flexDirection="column"
        gap="8"
        md={{ display: 'flex' }}
      >
        {signalWidths.map((width, index) => {
          const isSignal = index === 8 || index === 9
          return (
            <span
              className={signalLine({ active: isSignal })}
              key={`${String(width)}-${String(index)}`}
              style={{ width: `${String((width / 359) * 100)}%` }}
            >
              {isSignal ? <span /> : null}
            </span>
          )
        })}
      </styled.div>
      <div className={crosshair({ corner: 'bottomLeft' })} />
      <div className={crosshair({ corner: 'topRight' })} />
    </styled.div>
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
  const formMessageText = errorMessage ?? infoMessage
  const isError = Boolean(errorMessage)

  return (
    <main id="main-content" className={loginCanvas}>
      <LoginSignalField />

      <header className={brandHeader}>
        <BrandMark size="md" className={css({ md: { h: '7', w: '7' } })} />
        <styled.span
          textStyle="sm"
          fontWeight="semibold"
          letterSpacing="-0.01em"
          md={{ fontSize: '15px' }}
        >
          Finance-OS
        </styled.span>
      </header>

      <div className={loginGrid}>
        <section className={titleSection} aria-labelledby="login-title">
          <div className={mobileTitleRail}>
            <styled.span position="absolute" left="-0.5" top="0" boxSize="1" bg="primary" />
          </div>
          <h1 id="login-title" className={wordmark}>
            <styled.span display="block">FINANCE</styled.span>
            <styled.span display="flex" alignItems="flex-start" gap="2.5" md={{ gap: '18px' }}>
              <span className={wordmarkOutline}>OS</span>
              <styled.span mt="3" boxSize="1.5" bg="primary" md={{ mt: '22px', boxSize: '9px' }} />
            </styled.span>
          </h1>
          <styled.p
            mt="18px"
            fontFamily="mono"
            fontSize="9px"
            textTransform="uppercase"
            letterSpacing="0.3em"
            color="foreground/40"
            md={{ mt: '34px', fontSize: '11px', letterSpacing: '0.34em' }}
          >
            Personal finance OS
          </styled.p>
        </section>

        <section className={loginPanel}>
          <styled.h2
            textStyle="md"
            fontWeight="semibold"
            letterSpacing="-0.01em"
            md={{ fontSize: '17px' }}
          >
            Se connecter
          </styled.h2>

          <styled.div mt="3" minH="5" aria-live="polite" aria-atomic="true">
            {formMessageText ? (
              <p id="login-message" className={formMessage({ tone: isError ? 'error' : 'info' })}>
                <styled.span
                  boxSize="5px"
                  flexShrink="0"
                  rounded="full"
                  bg="currentColor"
                  aria-hidden="true"
                />
                {formMessageText}
              </p>
            ) : null}
          </styled.div>

          <styled.form mt="2" onSubmit={handleSubmit} aria-busy={loginMutation.isPending}>
            <div>
              <label className={fieldLabel} htmlFor="email">
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
                mt="2"
                h="11"
                bg="login.field"
                px="3.5"
                textStyle="sm"
                boxShadow="none"
                required
              />
            </div>

            <styled.div mt="18px">
              <label className={fieldLabel} htmlFor="password">
                Mot de passe
              </label>
              <styled.div position="relative" mt="2">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={isError}
                  aria-describedby={formMessageText ? 'login-message' : undefined}
                  h="11"
                  bg="login.field"
                  pl="3.5"
                  pr="12"
                  textStyle="sm"
                  boxShadow="none"
                  required
                />
                <button
                  type="button"
                  className={passwordToggle}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(value => !value)}
                >
                  <EyePixelIcon size={16} />
                </button>
              </styled.div>
            </styled.div>

            <Button
              type="submit"
              variant="secondary"
              size="lg"
              mt="26px"
              w="full"
              rounded="control"
              borderWidth="0"
              bg="foreground"
              color="background"
              shadow="sm"
              _hover={{ bg: 'foreground/90', color: 'background' }}
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <span className={loginActivity} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <styled.span boxSize="7px" bg="primary" aria-hidden="true" />
              )}
              {loginMutation.isPending ? 'Connexion' : 'Se connecter'}
            </Button>

            <Button
              asChild
              type="button"
              variant="ghost"
              mt="1.5"
              ml="auto"
              display="flex"
              minH="10"
              w="fit"
              px="0"
              textStyle="xs"
            >
              <Link to="/">Continuer en démo</Link>
            </Button>
          </styled.form>
        </section>
      </div>

      <styled.footer
        position="absolute"
        bottom="max(1.25rem, env(safe-area-inset-bottom))"
        left="6"
        zIndex="10"
        display="flex"
        gap="4"
        fontFamily="mono"
        fontSize="9px"
        textTransform="uppercase"
        letterSpacing="0.14em"
        color="foreground/30"
        md={{ bottom: '8', left: '11', gap: '22px', fontSize: '10px' }}
      >
        <span>EUR</span>
        <span>Paris</span>
        <span>Admin</span>
      </styled.footer>
    </main>
  )
}
