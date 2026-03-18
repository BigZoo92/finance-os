import { buildRuntimeHealth } from '../../../../packages/prelude/src/runtime'
import { createFileRoute } from '@tanstack/react-router'

const HEALTH_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
} as const

export const Route = createFileRoute('/health')({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify(buildRuntimeHealth('web')), {
          status: 200,
          headers: HEALTH_HEADERS,
        }),
    },
  },
  component: () => null,
})
