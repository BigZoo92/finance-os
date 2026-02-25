export type AuthMode = 'admin' | 'demo'

export type AuthUser = {
  email: string
  displayName: string
}

export type AuthErrorCode = 'auth_unavailable'

export type AuthMeResponse = {
  mode: AuthMode
  user: AuthUser | null
  error?: AuthErrorCode
}
