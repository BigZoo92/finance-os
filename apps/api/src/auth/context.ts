import type { AuthState } from './types'

const defaultAuth: AuthState = {
  mode: 'demo',
}

export const getAuth = <TContext extends object>(context: TContext): AuthState => {
  const auth = (context as any).auth as AuthState | undefined
  return auth ?? defaultAuth
}
