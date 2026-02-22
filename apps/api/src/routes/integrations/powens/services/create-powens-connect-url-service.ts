import { buildPowensWebviewUrl } from '@finance-os/powens'
import type { ApiEnv, PowensConnectUrlService } from '../types'
import { getRedirectUri } from '../utils/getRedirectUri'

export const createPowensConnectUrlService = (env: ApiEnv): PowensConnectUrlService => {
  return {
    getConnectUrl() {
      if (env.POWENS_WEBVIEW_URL) {
        return env.POWENS_WEBVIEW_URL
      }

      return buildPowensWebviewUrl({
        webviewBaseUrl: env.POWENS_WEBVIEW_BASE_URL,
        domain: env.POWENS_DOMAIN,
        clientId: env.POWENS_CLIENT_ID,
        redirectUri: getRedirectUri(env),
      })
    },
  }
}
