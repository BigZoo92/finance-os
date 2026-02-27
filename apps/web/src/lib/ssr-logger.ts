const DEBUG_ENV_KEYS = [
  'NODE_ENV',
  'LOG_LEVEL',
  'APP_DEBUG',
  'API_INTERNAL_URL',
  'VITE_API_BASE_URL',
  'VITE_APP_ORIGIN',
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
          prefix: value ? value.slice(0, isSensitive ? 3 : 20) : '',
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
  status: number | 'network_error'
  requestId?: string
  code?: string
}

export const logSsrApiCall = ({
  method,
  path,
  url,
  status,
  requestId,
  code,
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
