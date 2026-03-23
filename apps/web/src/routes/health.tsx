import { buildRuntimeHealthWithFlags } from '../../../../packages/prelude/src/runtime'
import { createFileRoute } from '@tanstack/react-router'

const HEALTH_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
} as const

const isExternalIntegrationsSafeModeEnabled = () => {
  return process.env.EXTERNAL_INTEGRATIONS_SAFE_MODE === 'true'
}

export const Route = createFileRoute('/health')({
  server: {
    handlers: {
      GET: () =>
        new Response(
          JSON.stringify(
            buildRuntimeHealthWithFlags('web', {
              safeModeActive: isExternalIntegrationsSafeModeEnabled(),
            })
          ),
          {
          status: 200,
          headers: HEALTH_HEADERS,
          }
        ),
    },
  },
  component: () => null,
})
