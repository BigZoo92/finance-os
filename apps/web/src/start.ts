import { createMiddleware, createStart } from '@tanstack/react-start'
import { logSsrError } from '@/lib/ssr-logger'

const requestAuthContextMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const requestUrl = new URL(request.url)
    const requestPath = `${requestUrl.pathname}${requestUrl.search}`

    try {
      return await next({
        context: {
          requestOrigin: requestUrl.origin,
          requestPath,
          requestCookieHeader: request.headers.get('cookie'),
        },
      })
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
