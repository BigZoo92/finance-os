import { createFileRoute } from '@tanstack/react-router'
import { proxyApiRequest } from '@/lib/api-proxy'

/**
 * Browser `/api/*` traffic is proxied to the internal API at request time.
 * The upstream URL comes from API_INTERNAL_URL in the server environment, so
 * one web build serves every deployment.
 */
const proxy = ({ request, params }: { request: Request; params: { _splat?: string } }) =>
  proxyApiRequest({ request, splat: params._splat })

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: proxy,
      HEAD: proxy,
      POST: proxy,
      PUT: proxy,
      PATCH: proxy,
      DELETE: proxy,
      OPTIONS: proxy,
    },
  },
})
