import { buildRuntimeHealth, resolveRuntimeVersion } from '@finance-os/prelude'

type SystemRouteEnv = {
  NODE_ENV: string
  APP_COMMIT_SHA?: string | undefined
  APP_VERSION?: string | undefined
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
  })

export const registerSystemRoutes = (app: any, env: SystemRouteEnv) => {
  return app
    .get('/health', () => {
      return buildRuntimeHealth('api')
    })
    .get('/version', ({ set }: { set: { headers: Record<string, string> } }) => {
      set.headers['cache-control'] = 'no-store'

      return getRuntimeVersion(env)
    })
}
