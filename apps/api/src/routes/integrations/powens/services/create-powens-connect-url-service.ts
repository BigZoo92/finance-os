import { buildPowensWebviewUrl } from '@finance-os/powens'
import { createPowensCallbackState, readPowensCallbackState } from '../../../../auth/powens-state'
import type { ApiEnv, PowensConnectUrlService } from '../types'
import { getRedirectUri } from '../utils/getRedirectUri'

const withStateQueryParam = ({
  url,
  state,
}: {
  url: string
  state: string
}) => {
  const parsed = new URL(url)
  parsed.searchParams.set('state', state)
  return parsed.toString()
}

export const createPowensConnectUrlService = (env: ApiEnv): PowensConnectUrlService => {
  return {
    getConnectUrl() {
      const state = createPowensCallbackState({
        secret: env.AUTH_SESSION_SECRET,
      })

      if (env.POWENS_WEBVIEW_URL) {
        return withStateQueryParam({
          url: env.POWENS_WEBVIEW_URL,
          state,
        })
      }

      return withStateQueryParam({
        url: buildPowensWebviewUrl({
          webviewBaseUrl: env.POWENS_WEBVIEW_BASE_URL,
          domain: env.POWENS_DOMAIN,
          clientId: env.POWENS_CLIENT_ID,
          redirectUri: getRedirectUri(env),
        }),
        state,
      })
    },
    isCallbackStateValid(state) {
      return (
        readPowensCallbackState({
          value: state,
          secret: env.AUTH_SESSION_SECRET,
        }) !== null
      )
    },
  }
}
