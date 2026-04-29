const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const toOrigin = (value: string | null | undefined) => {
  if (!value) {
    return null
  }

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

const toCompatibilityOrigins = (origin: string | null) => {
  if (!origin) {
    return []
  }

  return [origin]
}

export const createAllowedBrowserOrigins = ({
  requestUrl,
  webOrigin,
  nodeEnv,
}: {
  requestUrl: string
  webOrigin: string
  nodeEnv: string
}) => {
  const origins = new Set<string>()

  for (const origin of [
    ...toCompatibilityOrigins(toOrigin(webOrigin)),
    ...toCompatibilityOrigins(toOrigin(requestUrl)),
  ]) {
    origins.add(origin)
  }

  if (nodeEnv !== 'production') {
    origins.add('http://localhost:3000')
    origins.add('http://127.0.0.1:3000')
    origins.add('http://localhost:5173')
    origins.add('http://127.0.0.1:5173')
  }

  return origins
}

export const isUnsafeHttpMethod = (method: string) => UNSAFE_METHODS.has(method.toUpperCase())

export const isSameOriginMutationRequest = ({
  request,
  allowedOrigins,
}: {
  request: Request
  allowedOrigins: ReadonlySet<string>
}) => {
  if (!isUnsafeHttpMethod(request.method)) {
    return true
  }

  const origin = toOrigin(request.headers.get('origin'))
  if (origin) {
    return allowedOrigins.has(origin)
  }

  const refererOrigin = toOrigin(request.headers.get('referer'))
  if (refererOrigin) {
    return allowedOrigins.has(refererOrigin)
  }

  return false
}
