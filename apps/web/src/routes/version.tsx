import { resolveRuntimeVersion } from '../../../../packages/prelude/src/runtime'
import { createFileRoute } from '@tanstack/react-router'

const VERSION_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
} as const

const isExternalIntegrationsSafeModeEnabled = () => {
  return process.env.EXTERNAL_INTEGRATIONS_SAFE_MODE === 'true'
}

const buildVersionPayload = () => {
  return resolveRuntimeVersion({
    service: 'web',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    gitSha: process.env.GIT_SHA,
    gitTag: process.env.GIT_TAG,
    buildTime: process.env.BUILD_TIME,
    appCommitSha: process.env.APP_COMMIT_SHA,
    appVersion: process.env.APP_VERSION,
    safeModeActive: isExternalIntegrationsSafeModeEnabled(),
  })
}

export const Route = createFileRoute('/version')({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify(buildVersionPayload()), {
          status: 200,
          headers: VERSION_HEADERS,
        }),
    },
  },
  component: () => null,
})
