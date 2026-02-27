import type { AuthState, InternalAuthState, RequestMetaState } from './types'

const defaultAuth: AuthState = {
  mode: 'demo',
}

const defaultInternalAuth: InternalAuthState = {
  hasValidToken: false,
  tokenSource: null,
}

const defaultRequestMeta: RequestMetaState = {
  requestId: 'unknown',
  startedAtMs: 0,
}

export const getAuth = <TContext extends object>(context: TContext): AuthState => {
  const auth = (context as unknown as { auth?: AuthState }).auth
  return auth ?? defaultAuth
}

export const getInternalAuth = <TContext extends object>(context: TContext): InternalAuthState => {
  const internalAuth = (context as unknown as { internalAuth?: InternalAuthState }).internalAuth
  return internalAuth ?? defaultInternalAuth
}

export const getRequestMeta = <TContext extends object>(context: TContext): RequestMetaState => {
  const requestMeta = (context as unknown as { requestMeta?: RequestMetaState }).requestMeta
  return requestMeta ?? defaultRequestMeta
}
