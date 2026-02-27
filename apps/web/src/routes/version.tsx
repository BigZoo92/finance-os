import { createFileRoute } from '@tanstack/react-router'

const VERSION_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
} as const

const toOptionalEnv = (value: string | undefined) => {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

const buildVersionPayload = () => {
  return {
    service: 'web',
    GIT_SHA: toOptionalEnv(process.env.GIT_SHA) ?? toOptionalEnv(process.env.APP_COMMIT_SHA),
    GIT_TAG: toOptionalEnv(process.env.GIT_TAG) ?? toOptionalEnv(process.env.APP_VERSION),
    BUILD_TIME: toOptionalEnv(process.env.BUILD_TIME),
    NODE_ENV: process.env.NODE_ENV ?? null,
  }
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
