/**
 * Baseline security headers for every web response (HTML, assets served by
 * the SSR server, and the `/api` proxy when the API did not already set them).
 *
 * The web app is the only public surface, so it carries the same policy as
 * the API: no framing, no MIME sniffing, no referrer leakage, no indexing of
 * a private finance cockpit, and HSTS once the request is known to be HTTPS.
 * `form-action 'self'` keeps the login form working; `frame-ancestors 'none'`
 * and `base-uri 'none'` close the injection vectors that need no nonce.
 */
export const WEB_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()',
  'x-frame-options': 'DENY',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'content-security-policy': "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
}

export const HSTS_HEADER_VALUE = 'max-age=31536000; includeSubDomains'

export const isSecureRequest = (request: Request) => {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (forwardedProto) {
    return forwardedProto.toLowerCase() === 'https'
  }
  return new URL(request.url).protocol === 'https:'
}

/**
 * Sets the baseline headers on a response without overriding a header the
 * upstream (the API through the proxy) already decided on.
 */
export const applyWebSecurityHeaders = (
  response: Response,
  { request, nodeEnv }: { request: Request; nodeEnv: string | undefined }
) => {
  for (const [name, value] of Object.entries(WEB_SECURITY_HEADERS)) {
    if (!response.headers.has(name)) {
      response.headers.set(name, value)
    }
  }
  if (nodeEnv === 'production' && isSecureRequest(request)) {
    if (!response.headers.has('strict-transport-security')) {
      response.headers.set('strict-transport-security', HSTS_HEADER_VALUE)
    }
  }
  return response
}
