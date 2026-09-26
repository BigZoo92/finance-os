/**
 * Provider operation policy (Effect 3).
 *
 * One bounded way to call an external provider: a per-attempt timeout that
 * really cancels the underlying request (the AbortSignal handed to `run` is
 * aborted on timeout and on caller cancellation), a bounded exponential retry
 * with jitter that only retries errors the caller classified as transient,
 * and an outcome that never leaks provider payloads or credentials.
 *
 * The policy is deliberately transport-agnostic: clients keep their own error
 * types (they are the `cause` of a `failed` outcome) and decide what is
 * retryable through `classify`.
 */
import { Cause, Data, Duration, Effect, Exit, Option, Schedule } from 'effect'

export type ProviderOperationErrorKind = 'timeout' | 'cancelled' | 'failed'

export class ProviderOperationError extends Data.TaggedError('ProviderOperationError')<{
  readonly provider: string
  readonly operation: string
  readonly kind: ProviderOperationErrorKind
  readonly retryable: boolean
  readonly message: string
  readonly status?: number
  readonly cause?: unknown
}> {}

export interface ProviderRetryPolicy {
  /** Total attempts including the first one; `1` disables retries. */
  readonly maxAttempts: number
  readonly baseDelayMs: number
  readonly maxDelayMs: number
  /** Randomizes each delay in [0.8, 1.2] × the computed delay. Default true. */
  readonly jitter?: boolean
}

export interface ProviderOperationPolicy {
  /** Per-attempt timeout; the attempt's AbortSignal is aborted when it elapses. */
  readonly timeoutMs: number
  readonly retry?: ProviderRetryPolicy
}

export interface ProviderErrorClassification {
  readonly retryable: boolean
  readonly message?: string
  readonly status?: number
}

export interface RunProviderOperationInput<T> {
  readonly provider: string
  readonly operation: string
  readonly policy: ProviderOperationPolicy
  /** Caller cancellation (a Redis lease, a request abort). Aborting it stops retries and the in-flight attempt. */
  readonly signal?: AbortSignal
  /** The attempt. Pass `signal` to fetch so a timeout or cancellation aborts the request. */
  readonly run: (signal: AbortSignal) => Promise<T>
  /** Decides whether an error thrown by `run` is transient. Defaults to `error.retryable`, else network errors only. */
  readonly classify?: (error: unknown) => ProviderErrorClassification
  readonly now?: () => number
}

export type ProviderOperationOutcome<T> =
  | { readonly ok: true; readonly value: T; readonly attempts: number; readonly durationMs: number }
  | {
      readonly ok: false
      readonly error: ProviderOperationError
      readonly attempts: number
      readonly durationMs: number
    }

const NO_RETRY: ProviderRetryPolicy = { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 }

const isAbortError = (error: unknown) =>
  error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')

const isNetworkError = (error: unknown) => error instanceof TypeError

export const defaultClassifyProviderError = (error: unknown): ProviderErrorClassification => {
  const candidate = error as { retryable?: unknown; status?: unknown; statusCode?: unknown }
  const status =
    typeof candidate?.status === 'number'
      ? candidate.status
      : typeof candidate?.statusCode === 'number'
        ? candidate.statusCode
        : undefined
  const retryable =
    typeof candidate?.retryable === 'boolean' ? candidate.retryable : isNetworkError(error)
  return { retryable, ...(status !== undefined ? { status } : {}) }
}

const safeMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : 'provider operation failed'

const buildSchedule = (retry: ProviderRetryPolicy) => {
  const attempts = Math.max(0, Math.floor(retry.maxAttempts) - 1)
  const base = Duration.millis(Math.max(0, retry.baseDelayMs))
  const cap = Duration.millis(Math.max(0, retry.maxDelayMs))
  const backoff = Schedule.exponential(base, 2).pipe(
    Schedule.modifyDelay(delay => Duration.min(delay, cap))
  )
  const delays = retry.jitter === false ? backoff : Schedule.jittered(backoff)
  return delays.pipe(Schedule.intersect(Schedule.recurs(attempts)))
}

export const runProviderOperation = async <T>({
  provider,
  operation,
  policy,
  signal,
  run,
  classify = defaultClassifyProviderError,
  now = () => Date.now(),
}: RunProviderOperationInput<T>): Promise<ProviderOperationOutcome<T>> => {
  const startedAt = now()
  let attempts = 0

  const attempt = Effect.tryPromise({
    try: attemptSignal => {
      attempts += 1
      return run(attemptSignal)
    },
    catch: (error): ProviderOperationError => {
      if (signal?.aborted || isAbortError(error)) {
        return new ProviderOperationError({
          provider,
          operation,
          kind: signal?.aborted ? 'cancelled' : 'timeout',
          retryable: !signal?.aborted,
          message: signal?.aborted ? `${operation} cancelled` : `${operation} timed out`,
          cause: error,
        })
      }
      const classification = classify(error)
      return new ProviderOperationError({
        provider,
        operation,
        kind: 'failed',
        retryable: classification.retryable,
        message: classification.message ?? safeMessage(error),
        ...(classification.status !== undefined ? { status: classification.status } : {}),
        cause: error,
      })
    },
  })

  const boundedAttempt = Effect.timeoutFail(attempt, {
    duration: Duration.millis(Math.max(1, policy.timeoutMs)),
    onTimeout: () =>
      new ProviderOperationError({
        provider,
        operation,
        kind: 'timeout',
        retryable: true,
        message: `${operation} timed out after ${policy.timeoutMs}ms`,
      }),
  })

  const retry = policy.retry ?? NO_RETRY
  const program =
    retry.maxAttempts > 1
      ? Effect.retry(boundedAttempt, {
          schedule: buildSchedule(retry),
          while: (error: ProviderOperationError) =>
            error.retryable && error.kind !== 'cancelled' && !(signal?.aborted ?? false),
        })
      : boundedAttempt

  const exit = await Effect.runPromiseExit(program, signal ? { signal } : undefined)
  const durationMs = Math.max(0, now() - startedAt)

  if (Exit.isSuccess(exit)) {
    return { ok: true, value: exit.value, attempts, durationMs }
  }

  const failure = Cause.failureOption(exit.cause)
  if (Option.isSome(failure)) {
    return { ok: false, error: failure.value, attempts, durationMs }
  }

  if (Cause.isInterruptedOnly(exit.cause) || signal?.aborted) {
    return {
      ok: false,
      attempts,
      durationMs,
      error: new ProviderOperationError({
        provider,
        operation,
        kind: 'cancelled',
        retryable: false,
        message: `${operation} cancelled`,
      }),
    }
  }

  const defect = Cause.squash(exit.cause)
  return {
    ok: false,
    attempts,
    durationMs,
    error: new ProviderOperationError({
      provider,
      operation,
      kind: 'failed',
      retryable: false,
      message: safeMessage(defect),
      cause: defect,
    }),
  }
}

/**
 * Runs the operation and returns its value, or throws: the original client
 * error for a `failed` outcome (so callers keep their own error types), the
 * `ProviderOperationError` for timeouts and cancellations.
 */
export const runProviderOperationOrThrow = async <T>(
  input: RunProviderOperationInput<T>
): Promise<T> => {
  const outcome = await runProviderOperation(input)
  if (outcome.ok) {
    return outcome.value
  }
  if (outcome.error.kind === 'failed' && outcome.error.cause instanceof Error) {
    throw outcome.error.cause
  }
  throw outcome.error
}
