import { getAuth, getInternalAuth, getRequestMeta } from './context'
import type { ApiEnv, InternalTokenSource } from './types'

const ADMIN_REQUIRED_MESSAGE = 'Admin session required'
const ADMIN_OR_INTERNAL_REQUIRED_MESSAGE = 'Admin session or internal token required'
const INTERNAL_TOKEN_REQUIRED_MESSAGE = 'Internal token required'

export const demoAccessDeniedResponse = {
  ok: false as const,
  code: 'DEMO_MODE_FORBIDDEN' as const,
  reason: 'demo' as const,
  message: ADMIN_REQUIRED_MESSAGE,
}

export class DemoModeForbiddenError extends Error {
  readonly code = 'DEMO_MODE_FORBIDDEN' as const
  readonly requestId: string

  constructor(requestId: string, message = ADMIN_REQUIRED_MESSAGE) {
    super(message)
    this.name = 'DemoModeForbiddenError'
    this.requestId = requestId
  }
}

export class InternalTokenRequiredError extends Error {
  readonly code = 'INTERNAL_TOKEN_REQUIRED' as const
  readonly requestId: string

  constructor(requestId: string) {
    super(INTERNAL_TOKEN_REQUIRED_MESSAGE)
    this.name = 'InternalTokenRequiredError'
    this.requestId = requestId
  }
}

const toBearerToken = (authorizationHeader: string | null) => {
  if (!authorizationHeader) {
    return null
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return null
  }

  const token = match[1]?.trim()
  return token && token.length > 0 ? token : null
}

export const readInternalTokenFromRequest = (request: Request): {
  token: string | null
  source: InternalTokenSource
} => {
  const authorizationToken = toBearerToken(request.headers.get('authorization'))
  if (authorizationToken) {
    return {
      token: authorizationToken,
      source: 'authorization',
    }
  }

  const internalTokenHeader = request.headers.get('x-internal-token')?.trim()
  if (internalTokenHeader) {
    return {
      token: internalTokenHeader,
      source: 'x-internal-token',
    }
  }

  const privateAccessTokenHeader = request.headers.get('x-finance-os-access-token')?.trim()
  if (privateAccessTokenHeader) {
    return {
      token: privateAccessTokenHeader,
      source: 'x-finance-os-access-token',
    }
  }

  return {
    token: null,
    source: null,
  }
}

export const isInternalTokenValid = ({
  providedToken,
  env,
}: {
  providedToken: string | null
  env: Pick<ApiEnv, 'PRIVATE_ACCESS_TOKEN'>
}) => {
  if (!providedToken || !env.PRIVATE_ACCESS_TOKEN) {
    return false
  }

  return providedToken === env.PRIVATE_ACCESS_TOKEN
}

export const isDemoModeForbiddenError = (error: unknown): error is DemoModeForbiddenError => {
  return error instanceof DemoModeForbiddenError
}

export const isInternalTokenRequiredError = (error: unknown): error is InternalTokenRequiredError => {
  return error instanceof InternalTokenRequiredError
}

export const requireAdminOrInternalToken = <TContext extends object>(context: TContext) => {
  if (getAuth(context).mode === 'admin' || getInternalAuth(context).hasValidToken) {
    return
  }

  throw new DemoModeForbiddenError(getRequestMeta(context).requestId, ADMIN_OR_INTERNAL_REQUIRED_MESSAGE)
}

export const requireInternalToken = <TContext extends object>(context: TContext) => {
  if (getInternalAuth(context).hasValidToken) {
    return
  }

  throw new InternalTokenRequiredError(getRequestMeta(context).requestId)
}

export const requireAdmin = <TContext extends object>(context: TContext) => {
  if (getAuth(context).mode === 'admin') {
    return
  }

  throw new DemoModeForbiddenError(getRequestMeta(context).requestId, ADMIN_REQUIRED_MESSAGE)
}
