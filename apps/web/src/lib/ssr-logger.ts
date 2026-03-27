const DEBUG_ENV_KEYS = [
  'NODE_ENV',
  'LOG_LEVEL',
  'APP_DEBUG',
  'API_INTERNAL_URL',
  'VITE_API_BASE_URL',
  'VITE_APP_ORIGIN',
  'VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED',
  'VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS',
  'PRIVATE_ACCESS_TOKEN',
] as const

const SENSITIVE_ENV_KEY_PATTERN = /TOKEN|SECRET|PASSWORD|KEY/i

const toOptionalEnv = (value: string | undefined) => {
  if (!value) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const readRuntimeEnv = (key: string) => {
  if (typeof process === 'undefined') {
    return undefined
  }

  return toOptionalEnv(process.env?.[key])
}

export const isSsrDebugEnabled = () => {
  const logLevel = readRuntimeEnv('LOG_LEVEL')?.toLowerCase()
  return logLevel === 'debug' || readRuntimeEnv('APP_DEBUG') === '1'
}

const toEnvDebugSnapshot = () =>
  Object.fromEntries(
    DEBUG_ENV_KEYS.map(key => {
      const value = readRuntimeEnv(key)
      const isSensitive = SENSITIVE_ENV_KEY_PATTERN.test(key)

      return [
        key,
        {
          present: Boolean(value),
          length: value?.length ?? 0,
          // Never log token/secret fragments, even in debug mode.
          prefix: value && !isSensitive ? value.slice(0, 20) : '',
        },
      ]
    })
  )

type LogSsrErrorOptions = {
  source: 'request' | 'route-error'
  route: string
  error: unknown
  method?: string
}

type LogSsrApiCallOptions = {
  method: string
  path: string
  url: string
  baseUrl?: string
  baseUrlSource?: 'client' | 'internal' | 'origin_fallback'
  cookiesForwarded?: boolean
  internalTokenForwarded?: boolean
  status: number | 'network_error'
  requestId?: string
  code?: string
  bodyPreview?: string
  hint?: string
}

export const logSsrApiCall = ({
  method,
  path,
  url,
  baseUrl,
  baseUrlSource,
  cookiesForwarded,
  internalTokenForwarded,
  status,
  requestId,
  code,
  bodyPreview,
  hint,
}: LogSsrApiCallOptions) => {
  if (typeof window !== 'undefined') {
    return
  }

  const shouldLog = status === 'network_error' || status >= 400 || isSsrDebugEnabled()
  if (!shouldLog) {
    return
  }

  if (status === 'network_error' || status >= 400) {
    console.error('[web:ssr] request failed', {
      requestId: requestId ?? null,
      url,
      status,
      code: code ?? null,
      hint: hint ?? null,
      bodyPreview: bodyPreview ?? null,
      baseUrl: baseUrl ?? null,
      baseUrlSource: baseUrlSource ?? null,
      cookiesForwarded: cookiesForwarded ?? null,
      internalTokenForwarded: internalTokenForwarded ?? null,
      method,
      path,
    })
    return
  }

  console.info('[web:ssr] api call', {
    requestId: requestId ?? null,
    method,
    path,
    url,
    baseUrl: baseUrl ?? null,
    baseUrlSource: baseUrlSource ?? null,
    cookiesForwarded: cookiesForwarded ?? null,
    internalTokenForwarded: internalTokenForwarded ?? null,
    status,
  })
}

export const logSsrError = ({ source, route, error, method }: LogSsrErrorOptions) => {
  const safeError = error instanceof Error ? error : new Error(String(error))

  console.error('[web:ssr] request failed', {
    source,
    method,
    route,
    message: safeError.message,
  })

  if (!isSsrDebugEnabled()) {
    return
  }

  console.error('[web:ssr] debug context', {
    source,
    route,
    env: toEnvDebugSnapshot(),
  })

  if (safeError.stack) {
    console.error(safeError.stack)
  }
}
