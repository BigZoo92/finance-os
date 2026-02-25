import { createFileRoute } from '@tanstack/react-router'

const HEALTH_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

export const Route = createFileRoute('/healthz')({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: HEALTH_HEADERS,
        }),
    },
  },
  component: () => null,
})
