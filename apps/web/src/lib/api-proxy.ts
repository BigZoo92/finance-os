/**
 * Server-only: forwards browser `/api/*` requests to the internal API.
 *
 * The upstream base URL is read from the process environment at request time,
 * so the same web build serves every environment (no API URL is baked into the
 * bundle). Imported only by the `/api/$` server route.
 */

const DEFAULT_INTERNAL_API_URL = 'http://127.0.0.1:3001'

/** Headers that describe the hop, not the message; never forwarded in either direction. */
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
])

/**
 * The runtime decompresses upstream bodies, so the encoding and length of the
 * original payload no longer describe what the browser receives.
 */
const UPSTREAM_ONLY_RESPONSE_HEADERS = new Set(['content-encoding', 'content-length'])

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD'])

export type ProxyFetch = (input: string, init: RequestInit) => Promise<Response>

export const resolveInternalApiBaseUrl = (
  env: Record<string, string | undefined> = process.env
): string => {
  const configured = env.API_INTERNAL_URL?.trim()
  return (configured && configured.length > 0 ? configured : DEFAULT_INTERNAL_API_URL).replace(
    /\/+$/,
    ''
  )
}

export const buildUpstreamUrl = ({
  baseUrl,
  splat,
  search,
}: {
  baseUrl: string
  splat: string | undefined
  search: string
}): string => {
  const path = (splat ?? '').replace(/^\/+/, '')
  return `${baseUrl}/${path}${search}`
}

export const buildUpstreamHeaders = (incoming: Headers): Headers => {
  const headers = new Headers()
  incoming.forEach((value, name) => {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      headers.set(name, value)
    }
  })
  return headers
}

export const buildDownstreamHeaders = (upstream: Headers, requestId: string): Headers => {
  const headers = new Headers()
  upstream.forEach((value, name) => {
    const lowered = name.toLowerCase()
    if (
      lowered === 'set-cookie' ||
      HOP_BY_HOP_HEADERS.has(lowered) ||
      UPSTREAM_ONLY_RESPONSE_HEADERS.has(lowered)
    ) {
      return
    }
    headers.set(name, value)
  })
  // Set-Cookie must be appended one header per cookie; Headers.forEach folds them.
  for (const cookie of upstream.getSetCookie()) {
    headers.append('set-cookie', cookie)
  }
  if (!headers.has('x-request-id')) {
    headers.set('x-request-id', requestId)
  }
  return headers
}

const resolveRequestId = (request: Request) => {
  const provided = request.headers.get('x-request-id')?.trim()
  return provided && provided.length > 0 ? provided : crypto.randomUUID()
}

const unavailableResponse = (requestId: string) =>
  Response.json(
    {
      ok: false,
      code: 'API_UNAVAILABLE',
      message: 'Internal API unavailable',
      requestId,
    },
    {
      status: 502,
      headers: { 'cache-control': 'no-store', 'x-request-id': requestId },
    }
  )

export const proxyApiRequest = async ({
  request,
  splat,
  baseUrl = resolveInternalApiBaseUrl(),
  fetchImpl = fetch,
}: {
  request: Request
  splat: string | undefined
  baseUrl?: string
  fetchImpl?: ProxyFetch
}): Promise<Response> => {
  const requestId = resolveRequestId(request)
  const url = buildUpstreamUrl({ baseUrl, splat, search: new URL(request.url).search })
  const headers = buildUpstreamHeaders(request.headers)
  headers.set('x-request-id', requestId)

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    redirect: 'manual',
    ...(METHODS_WITHOUT_BODY.has(request.method) || request.body === null
      ? {}
      : { body: request.body, duplex: 'half' }),
  }

  let upstream: Response
  try {
    upstream = await fetchImpl(url, init)
  } catch {
    return unavailableResponse(requestId)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: buildDownstreamHeaders(upstream.headers, requestId),
  })
}
