import { createMiddleware, createStart } from '@tanstack/react-start'

const requestAuthContextMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const requestUrl = new URL(request.url)

    return next({
      context: {
        requestOrigin: requestUrl.origin,
        requestCookieHeader: request.headers.get('cookie'),
      },
    })
  }
)

export const startInstance = createStart(() => ({
  requestMiddleware: [requestAuthContextMiddleware],
}))
