import { css } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  ErrorComponent,
  type ErrorComponentProps,
  HeadContent,
  Link,
  Scripts,
} from '@tanstack/react-router'
import { getGlobalStartContext } from '@tanstack/react-start'
import { lazy, Suspense } from 'react'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'
import { ToastViewport } from '@/components/toast-viewport'
import { authMeQueryOptions, authQueryKeys } from '@/features/auth-query-options'
import { fetchAuthMeFromSsr } from '@/features/auth-ssr'
import { getPublicRuntimeEnvScript, readPublicRuntimeEnv } from '@/lib/public-runtime-env'
import { logSsrError } from '@/lib/ssr-logger'
import { themeBootstrapScript } from '@/lib/theme'
import appCss from '../styles.css?url'

interface MyRouterContext {
  queryClient: QueryClient
}

// Devtools never enter production bundles: the branch is resolved at build time and
// the dev-only module is loaded lazily, so its packages are unreachable in PROD.
const AppDevtools = import.meta.env.PROD
  ? () => null
  : lazy(() => import('../integrations/devtools/app-devtools'))

function RootNotFound() {
  return (
    <styled.div
      display="flex"
      minH="100vh"
      alignItems="center"
      justifyContent="center"
      bg="background"
      color="foreground"
      p="6"
    >
      <styled.div
        rounded="lg"
        borderWidth="1px"
        borderColor="border"
        bg="card"
        p="6"
        textAlign="center"
      >
        <styled.p textStyle="sm" color="muted.foreground">
          404
        </styled.p>
        <styled.h1 textStyle="lg" fontWeight="semibold">
          Page introuvable
        </styled.h1>
        <styled.p mt="2" textStyle="sm" color="muted.foreground">
          La route demandée n’existe pas.
        </styled.p>
      </styled.div>
    </styled.div>
  )
}

const errorHomeLink = css({
  mt: '5',
  display: 'inline-flex',
  minH: '11',
  alignItems: 'center',
  rounded: 'control',
  borderWidth: '1px',
  borderColor: 'border',
  px: '4',
  textStyle: 'sm',
  fontWeight: 'medium',
  transitionProperty: 'colors',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  _hover: { bg: 'accent' },
  _focusVisible: { outlineStyle: 'none', boxShadow: '0 0 0 2px {colors.ring}' },
})

export function RouteError({ error }: ErrorComponentProps) {
  const isProduction = import.meta.env.PROD
  const message = isProduction
    ? 'Un problème est survenu. Réessayez dans quelques instants.'
    : String((error as unknown as { message?: string })?.message ?? error)
  const requestContext =
    typeof window === 'undefined'
      ? (getGlobalStartContext() as { requestPath?: string; requestId?: string } | undefined)
      : undefined
  if (typeof window === 'undefined') {
    logSsrError({
      source: 'route-error',
      route: requestContext?.requestPath ?? 'unknown',
      error,
    })
  }

  return (
    <styled.main
      id="main-content"
      display="grid"
      minH="100vh"
      placeItems="center"
      bg="background"
      p="6"
      color="foreground"
    >
      <styled.section
        w="full"
        maxW="md"
        rounded="frame"
        borderWidth="1px"
        borderColor="border/60"
        bg="card"
        p="6"
        shadow="surface"
      >
        <styled.p
          fontFamily="mono"
          fontSize="10px"
          textTransform="uppercase"
          letterSpacing="0.16em"
          color="negative"
        >
          Erreur
        </styled.p>
        <styled.h1 mt="2" textStyle="lg" fontWeight="semibold">
          Impossible d’afficher cette page
        </styled.h1>
        <styled.p mt="2" textStyle="sm" lineHeight="relaxed" color="muted.foreground">
          {message}
        </styled.p>
        <Link to="/" className={errorHomeLink}>
          Revenir au Cockpit
        </Link>
        {!isProduction ? <ErrorComponent error={error} /> : null}
      </styled.section>
    </styled.main>
  )
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => {
    const appTitle = readPublicRuntimeEnv('VITE_APP_TITLE') ?? 'Finance OS'

    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: String(appTitle) },
        { name: 'robots', content: 'noindex, nofollow, noarchive' },
        { name: 'theme-color', content: '#242019' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
      links: [
        {
          rel: 'stylesheet',
          href: appCss,
        },
        {
          rel: 'manifest',
          href: '/manifest.json',
        },
        {
          rel: 'icon',
          href: '/favicon.ico',
        },
        {
          rel: 'apple-touch-icon',
          href: '/logo192.png',
        },
      ],
    }
  },
  loader: async ({ context }) => {
    const ssrAuth = await fetchAuthMeFromSsr()

    if (ssrAuth) {
      context.queryClient.setQueryData(authQueryKeys.me(), ssrAuth)
      return ssrAuth
    }

    return context.queryClient.fetchQuery(authMeQueryOptions())
  },
  shellComponent: RootDocument,
  notFoundComponent: RootNotFound,
  errorComponent: RouteError,
})

// Visually hidden until focused (Tailwind's `sr-only` / `focus:not-sr-only` pair):
// the focus state resets padding and margin exactly like the former utility did.
const skipLink = css({
  srOnly: true,
  position: 'fixed',
  left: '4',
  top: '4',
  zIndex: '50',
  rounded: 'md',
  borderWidth: '1px',
  borderColor: 'border',
  bg: 'background',
  px: '3',
  py: '2',
  textStyle: 'sm',
  fontWeight: 'medium',
  color: 'foreground',
  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  _focus: {
    srOnly: false,
    outlineStyle: 'none',
    boxShadow:
      '0 0 0 2px #fff, 0 0 0 4px {colors.ring}, 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  },
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // SSR renders dark (canonical default). The inline bootstrap corrects
    // the class before first paint from the persisted or system preference,
    // so the class may legitimately differ at hydration time.
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script>{themeBootstrapScript}</script>
        <script>{getPublicRuntimeEnvScript()}</script>
      </head>
      <body>
        <a href="#main-content" className={skipLink}>
          Aller au contenu principal
        </a>
        {children}
        <PwaInstallPrompt />
        <ToastViewport />
        <Suspense fallback={null}>
          <AppDevtools />
        </Suspense>
        <Scripts />
      </body>
    </html>
  )
}
