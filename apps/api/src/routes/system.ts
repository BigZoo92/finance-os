import { buildRuntimeHealthWithFlags, resolveRuntimeVersion } from '@finance-os/prelude'
import type { Elysia } from 'elysia'

type SystemRouteEnv = {
  NODE_ENV: string
  APP_COMMIT_SHA?: string | undefined
  APP_VERSION?: string | undefined
  EXTERNAL_INTEGRATIONS_SAFE_MODE: boolean
}

const getRuntimeVersion = (env: SystemRouteEnv) =>
  resolveRuntimeVersion({
    service: 'api',
    nodeEnv: env.NODE_ENV,
    gitSha: process.env.GIT_SHA,
    gitTag: process.env.GIT_TAG,
    buildTime: process.env.BUILD_TIME,
    appCommitSha: env.APP_COMMIT_SHA,
    appVersion: env.APP_VERSION,
    safeModeActive: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
  })

export const registerSystemRoutes = (app: Elysia, env: SystemRouteEnv) => {
  return app
    .get('/health', () => {
      return buildRuntimeHealthWithFlags('api', {
        safeModeActive: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
      })
    })
    .get('/version', ({ set }: { set: { headers: Record<string, string | number | undefined> } }) => {
      set.headers['cache-control'] = 'no-store'

      return getRuntimeVersion(env)
    })
}
