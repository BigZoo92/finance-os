import { createMiddleware, createStart } from '@tanstack/react-start'
import { logSsrError } from '@/lib/ssr-logger'

const resolveRequestId = (request: Request) => {
  const provided = request.headers.get('x-request-id')?.trim()
  if (provided && provided.length > 0) {
    return provided
  }

  return crypto.randomUUID()
}

const NO_STORE_PATH_PREFIXES = ['/login', '/powens/callback', '/api/auth', '/api/integrations/powens']
const NO_STORE_EXACT_PATHS = new Set(['/'])

const shouldSetNoStore = ({
  path,
  response,
}: {
  path: string
  response: Response
}) => {
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

const requestAuthContextMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
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

        if (shouldSetNoStore({ path: requestUrl.pathname, response })) {
          response.headers.set('cache-control', 'no-store')
          response.headers.set('pragma', 'no-cache')
          response.headers.set('vary', 'Cookie')
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
