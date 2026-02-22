import type { ApiEnv } from '../types'

export const getRedirectUri = (env: ApiEnv) => {
  if (process.env.NODE_ENV === 'production' && env.POWENS_REDIRECT_URI_PROD) {
    return env.POWENS_REDIRECT_URI_PROD
  }

  return env.POWENS_REDIRECT_URI_DEV
}
