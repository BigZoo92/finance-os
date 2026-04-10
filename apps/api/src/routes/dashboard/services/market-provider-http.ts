const DEFAULT_TIMEOUT_MS = 12_000

const toSafeProviderErrorMessage = (value: string) => {
  return value.replace(/\s+/g, ' ').trim().slice(0, 220)
}

export const createProviderRequestInit = ({
  requestId,
  headers,
}: {
  requestId: string
  headers?: Record<string, string>
} = {
  requestId: 'n/a',
}) => {
  return {
    headers: {
      accept: 'application/json',
      'x-request-id': requestId,
      ...(headers ?? {}),
    },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  } satisfies RequestInit
}

export const fetchProviderJson = async <T>({
  url,
  requestId,
  headers,
}: {
  url: string
  requestId: string
  headers?: Record<string, string>
}): Promise<T> => {
  const response = await fetch(
    url,
    createProviderRequestInit({
      requestId,
      ...(headers ? { headers } : {}),
    })
  )

  if (!response.ok) {
    const text = await response.text()
    throw Object.assign(new Error(`PROVIDER_HTTP_${response.status}`), {
      code: `PROVIDER_HTTP_${response.status}`,
      safeMessage: toSafeProviderErrorMessage(text),
    })
  }

  return response.json() as Promise<T>
}

export const normalizeProviderError = (error: unknown) => {
  if (error && typeof error === 'object') {
    const code =
      'code' in error && typeof error.code === 'string'
        ? error.code
        : error instanceof Error
          ? error.message
          : 'PROVIDER_ERROR'
    const message =
      'safeMessage' in error && typeof error.safeMessage === 'string'
        ? error.safeMessage
        : error instanceof Error
          ? error.message
          : 'Provider request failed.'

    return {
      code: code.slice(0, 80),
      message: message.slice(0, 220),
    }
  }

  return {
    code: 'PROVIDER_ERROR',
    message: 'Provider request failed.',
  }
}
