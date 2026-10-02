import { createMiddleware, createStart } from '@tanstack/react-start'
import { applyWebSecurityHeaders } from '@/lib/security-headers'
import { logSsrError } from '@/lib/ssr-logger'

const resolveRequestId = (request: Request) => {
  const provided = request.headers.get('x-request-id')?.trim()
  if (provided && provided.length > 0) {
    return provided
  }

  return crypto.randomUUID()
}

const NO_STORE_PATH_PREFIXES = [
  '/login',
  '/powens/callback',
  '/api/auth',
  '/api/integrations/powens',
]
const NO_STORE_EXACT_PATHS = new Set(['/'])

const shouldSetNoStore = ({ path, response }: { path: string; response: Response }) => {
  if (NO_STORE_EXACT_PATHS.has(path)) {
    return true
  }

  if (NO_STORE_PATH_PREFIXES.some(prefix => path.startsWith(prefix))) {
    return true
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  return contentType.includes('text/html')
}

// Server-only: the internal API token is read here, inside the request
// middleware, so its name and value never enter an isomorphic module or the
// client bundle. SSR fetches read it from the request context.
const resolveInternalToken = () => {
  const value = process.env.PRIVATE_ACCESS_TOKEN?.trim() || process.env.API_INTERNAL_TOKEN?.trim()
  return value && value.length > 0 ? value : undefined
}

// Requests slower than this are logged as structured warnings (never with
// payloads); the `server-timing` header carries the measured duration.
const slowRequestThresholdMs = () => {
  const configured = Number(process.env.WEB_SLOW_REQUEST_MS)
  return Number.isFinite(configured) && configured > 0 ? configured : 2_000
}

const requestAuthContextMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const startedAt = performance.now()
    const requestUrl = new URL(request.url)
    const requestPath = `${requestUrl.pathname}${requestUrl.search}`
    const requestId = resolveRequestId(request)
    const internalToken = resolveInternalToken()

    try {
      const response = await next({
        context: {
          requestOrigin: requestUrl.origin,
          requestPath,
          requestCookieHeader: request.headers.get('cookie'),
          requestId,
          ...(internalToken ? { internalToken } : {}),
        },
      })

      if (response instanceof Response) {
        response.headers.set('x-request-id', requestId)
        applyWebSecurityHeaders(response, { request, nodeEnv: process.env.NODE_ENV })

        if (shouldSetNoStore({ path: requestUrl.pathname, response })) {
          response.headers.set('cache-control', 'no-store')
          response.headers.set('pragma', 'no-cache')
          response.headers.set('vary', 'Cookie')
        }

        const durationMs = Math.round(performance.now() - startedAt)
        response.headers.set('server-timing', `app;dur=${durationMs}`)
        if (durationMs >= slowRequestThresholdMs()) {
          console.warn('[web:ssr] slow request', {
            method: request.method,
            route: requestUrl.pathname,
            status: response.status,
            durationMs,
            requestId,
          })
        }
      }

      return response
    } catch (error) {
      logSsrError({
        source: 'request',
        method: request.method,
        route: requestPath,
        error,
      })
      throw error
    }
  }
)

export const startInstance = createStart(() => ({
  requestMiddleware: [requestAuthContextMiddleware],
}))
