import { Effect } from 'effect'

export type ExternalInvestmentProviderName = 'ibkr' | 'binance' | 'external-investments'

export type ExternalInvestmentProviderOperationErrorKind = 'provider_error' | 'timeout'

export type ExternalInvestmentProviderOperationSafeError = {
  provider: ExternalInvestmentProviderName
  operation: string
  kind: ExternalInvestmentProviderOperationErrorKind
  message: string
  retryable: boolean
}

export type ExternalInvestmentProviderOperationResult<T> =
  | {
      ok: true
      value: T
      attempts: number
      fallbackUsed: false
    }
  | {
      ok: true
      value: T
      attempts: number
      fallbackUsed: true
      error: ExternalInvestmentProviderOperationSafeError
    }
  | {
      ok: false
      attempts: number
      fallbackUsed: false
      error: ExternalInvestmentProviderOperationSafeError
    }

export class ExternalInvestmentProviderOperationError extends Error {
  readonly _tag = 'ExternalInvestmentProviderOperationError'
  readonly provider: ExternalInvestmentProviderName
  readonly operation: string
  readonly kind: ExternalInvestmentProviderOperationErrorKind
  readonly retryable: boolean

  constructor(input: ExternalInvestmentProviderOperationSafeError) {
    super(input.message)
    this.name = 'ExternalInvestmentProviderOperationError'
    this.provider = input.provider
    this.operation = input.operation
    this.kind = input.kind
    this.retryable = input.retryable
  }

  toSafeError(): ExternalInvestmentProviderOperationSafeError {
    return {
      provider: this.provider,
      operation: this.operation,
      kind: this.kind,
      message: this.message,
      retryable: this.retryable,
    }
  }
}

const SECRET_ASSIGNMENT_PATTERN =
  /\b(api[_-]?key|access[_-]?token|token|secret|signature|code|client[_-]?secret)=([^&\s]+)/gi
const BEARER_PATTERN = /\bbearer\s+[a-z0-9._~+/=-]+/gi
const LONG_SECRET_PATTERN = /\b[a-f0-9]{32,}\b/gi

export const redactExternalProviderErrorMessage = (error: unknown) => {
  const rawMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Provider operation failed'

  return rawMessage
    .replace(SECRET_ASSIGNMENT_PATTERN, '$1=[redacted]')
    .replace(BEARER_PATTERN, 'Bearer [redacted]')
    .replace(LONG_SECRET_PATTERN, '[redacted]')
}

const toProviderOperationError = ({
  provider,
  operation,
  kind,
  retryable,
  error,
}: {
  provider: ExternalInvestmentProviderName
  operation: string
  kind: ExternalInvestmentProviderOperationErrorKind
  retryable: boolean
  error: unknown
}) =>
  new ExternalInvestmentProviderOperationError({
    provider,
    operation,
    kind,
    retryable,
    message:
      kind === 'timeout'
        ? `${operation} timed out`
        : redactExternalProviderErrorMessage(error),
  })

const normalizeProviderOperationError = ({
  provider,
  operation,
  error,
}: {
  provider: ExternalInvestmentProviderName
  operation: string
  error: unknown
}): ExternalInvestmentProviderOperationSafeError => {
  if (error instanceof ExternalInvestmentProviderOperationError) {
    return error.toSafeError()
  }

  const message = redactExternalProviderErrorMessage(error)
  if (message.includes(`${operation} timed out`)) {
    return {
      provider,
      operation,
      kind: 'timeout',
      message: `${operation} timed out`,
      retryable: true,
    }
  }

  return toProviderOperationError({
    provider,
    operation,
    kind: 'provider_error',
    retryable: true,
    error: message,
  }).toSafeError()
}

export const runExternalInvestmentProviderOperation = async <T>({
  provider,
  operation,
  run,
  timeoutMs = 30_000,
  retryAttempts = 0,
  fallback,
}: {
  provider: ExternalInvestmentProviderName
  operation: string
  run: () => Promise<T>
  timeoutMs?: number
  retryAttempts?: number
  fallback?: () => T | Promise<T>
}): Promise<ExternalInvestmentProviderOperationResult<T>> => {
  let attempts = 0

  const operationEffect = Effect.tryPromise({
    try: () => {
      attempts += 1
      return run()
    },
    catch: error =>
      toProviderOperationError({
        provider,
        operation,
        kind: 'provider_error',
        retryable: true,
        error,
      }),
  })

  const boundedOperation = Effect.timeoutFail(operationEffect, {
    duration: `${Math.max(1, timeoutMs)} millis`,
    onTimeout: () =>
      toProviderOperationError({
        provider,
        operation,
        kind: 'timeout',
        retryable: true,
        error: new Error(`${operation} timed out`),
      }),
  })

  const retryableOperation =
    retryAttempts > 0
      ? Effect.retry(boundedOperation, { times: Math.max(0, retryAttempts) })
      : boundedOperation

  try {
    const value = await Effect.runPromise(retryableOperation)
    return {
      ok: true,
      value,
      attempts,
      fallbackUsed: false,
    }
  } catch (error) {
    const safeError = normalizeProviderOperationError({
      provider,
      operation,
      error,
    })

    if (fallback) {
      return {
        ok: true,
        value: await fallback(),
        attempts,
        fallbackUsed: true,
        error: safeError,
      }
    }

    return {
      ok: false,
      attempts,
      fallbackUsed: false,
      error: safeError,
    }
  }
}
