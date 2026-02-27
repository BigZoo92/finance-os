import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  ErrorComponent,
  type ErrorComponentProps,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { getGlobalStartContext } from '@tanstack/react-start'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { ToastViewport } from '@/components/toast-viewport'
import { authMeQueryOptions, authQueryKeys } from '@/features/auth-query-options'
import { fetchAuthMeFromSsr } from '@/features/auth-ssr'
import { logSsrError } from '@/lib/ssr-logger'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import appCss from '../styles.css?url'

interface MyRouterContext {
  queryClient: QueryClient
}

function RootNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-6">
      <div className="rounded-lg border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">404</p>
        <h1 className="text-lg font-semibold">Page introuvable</h1>
        <p className="mt-2 text-sm text-muted-foreground">La route demandée n’existe pas.</p>
      </div>
    </div>
  )
}

export function RouteError({ error }: ErrorComponentProps) {
  const isProduction = import.meta.env.PROD
  const message = isProduction
    ? 'Une erreur est survenue. Veuillez recharger la page.'
    : String((error as unknown as { message?: string })?.message ?? error)
  const requestContext =
    typeof window === 'undefined'
      ? (getGlobalStartContext() as { requestPath?: string } | undefined)
      : undefined

  if (typeof window === 'undefined') {
    logSsrError({
      source: 'route-error',
      route: requestContext?.requestPath ?? 'unknown',
      error,
    })
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Route error</h2>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{message}</pre>
      {!isProduction ? <ErrorComponent error={error} /> : null}
    </div>
  )
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Finance OS',
      },
      {
        name: 'robots',
        content: 'noindex, nofollow, noarchive',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  loader: async ({ context }) => {
    const ssrAuth = await fetchAuthMeFromSsr()

    if (ssrAuth) {
      context.queryClient.setQueryData(authQueryKeys.me(), ssrAuth)
      return ssrAuth
    }

    return context.queryClient.ensureQueryData(authMeQueryOptions())
  },
  shellComponent: RootDocument,
  notFoundComponent: RootNotFound,
  errorComponent: RouteError,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <ToastViewport />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
