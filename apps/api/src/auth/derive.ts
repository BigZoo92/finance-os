import { randomUUID } from 'node:crypto'
import { Elysia } from 'elysia'
import { isInternalTokenValid, readInternalTokenFromRequest } from './guard'
import { readSessionFromCookie } from './session'
import type { ApiEnv } from './types'

const resolveRequestId = (request: Request) => {
  const provided = request.headers.get('x-request-id')?.trim()
  return provided && provided.length > 0 ? provided : randomUUID()
}

export const deriveAuth = ({
  env,
}: {
  env: Pick<
    ApiEnv,
    'AUTH_SESSION_SECRET' | 'AUTH_SESSION_TTL_DAYS' | 'PRIVATE_ACCESS_TOKEN'
  >
}) => {
  return new Elysia({ name: 'auth.derive' }).derive({ as: 'global' }, ({ request, set }) => {
    const requestId = resolveRequestId(request)
    set.headers['x-request-id'] = requestId

    const session = readSessionFromCookie({
      cookieHeader: request.headers.get('cookie'),
      secret: env.AUTH_SESSION_SECRET,
      ttlDays: env.AUTH_SESSION_TTL_DAYS,
    })

    const { token, source } = readInternalTokenFromRequest(request)
    const hasValidToken = isInternalTokenValid({
      providedToken: token,
      env,
    })

    return {
      requestMeta: {
        requestId,
        startedAtMs: Date.now(),
      },
      auth: { mode: session?.admin === true ? 'admin' : 'demo' } as const,
      internalAuth: {
        hasValidToken,
        tokenSource: source,
      } as const,
    }
  })
}
