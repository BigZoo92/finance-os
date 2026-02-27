import { createMiddleware, createStart } from '@tanstack/react-start'
import { logSsrError } from '@/lib/ssr-logger'

const resolveRequestId = (request: Request) => {
  const provided = request.headers.get('x-request-id')?.trim()
  if (provided && provided.length > 0) {
    return provided
  }

  return crypto.randomUUID()
}

const requestAuthContextMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const requestUrl = new URL(request.url)
    const requestPath = `${requestUrl.pathname}${requestUrl.search}`
    const requestId = resolveRequestId(request)

    try {
      const response = await next({
        context: {
          requestOrigin: requestUrl.origin,
          requestPath,
          requestCookieHeader: request.headers.get('cookie'),
          requestId,
        },
      })

      if (response instanceof Response) {
        response.headers.set('x-request-id', requestId)
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
