export const createApiSecurityHeaders = ({ nodeEnv }: { nodeEnv: string }) => ({
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()',
  'x-frame-options': 'DENY',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'content-security-policy': "frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  ...(nodeEnv === 'production'
    ? {
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
      }
    : {}),
})

export const applyApiSecurityHeaders = (
  headers: Record<string, string | number | string[]>,
  { nodeEnv }: { nodeEnv: string }
) => {
  const securityHeaders = createApiSecurityHeaders({ nodeEnv })

  for (const [key, value] of Object.entries(securityHeaders)) {
    headers[key] = value
  }
}
