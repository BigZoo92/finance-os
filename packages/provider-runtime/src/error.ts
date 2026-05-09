// PR17B — Provider error runtime helpers.
//
// Closed-taxonomy ProviderError construction, thrown-error normalization, and a
// browser-safe JSON projection. Stack traces and arbitrary error fields are NEVER
// exposed by the safe-JSON path.

import type { ProviderCapability } from '@finance-os/provider-contract'
import {
  PROVIDER_ERROR_CODES,
  type ProviderError,
  type ProviderErrorCode,
  type ProviderId,
} from '@finance-os/provider-contract'
import { redactProviderLogFields } from './redaction'

const PROVIDER_ERROR_CODE_SET: ReadonlySet<ProviderErrorCode> = new Set(PROVIDER_ERROR_CODES)

export interface ProviderErrorRuntime extends ProviderError {
  readonly capability?: ProviderCapability
  readonly requestId?: string
  readonly causeType?: string
  readonly safeDetails?: Readonly<Record<string, string | number | boolean | null>>
}

export interface CreateProviderErrorInput {
  readonly code: ProviderErrorCode
  readonly providerId: ProviderId
  readonly message: string
  readonly retryable?: boolean
  readonly capability?: ProviderCapability
  readonly requestId?: string
  readonly causeType?: string
  readonly safeDetails?: Readonly<Record<string, string | number | boolean | null>>
}

const isRetryableByDefault = (code: ProviderErrorCode): boolean => {
  switch (code) {
    case 'rate_limited':
    case 'transient':
    case 'provider_unavailable':
      return true
    case 'unconfigured':
    case 'disabled_by_flag':
    case 'auth_failed':
    case 'not_found':
    case 'invalid_input':
    case 'permanent':
    case 'tos_blocked':
    case 'demo_mode_forbidden':
    case 'budget_exceeded':
    case 'stale_cache':
    case 'unsupported_capability':
      return false
    default: {
      const _exhaustive: never = code
      return _exhaustive
    }
  }
}

const sanitizeCauseType = (raw: string | undefined): string | undefined => {
  if (raw === undefined) {
    return undefined
  }
  const trimmed = raw.trim().slice(0, 64)
  if (trimmed === '') {
    return undefined
  }
  return trimmed.replace(/[^a-zA-Z0-9_:.-]/g, '_')
}

const clampMessage = (message: string): string => {
  const stripped = message.trim()
  return stripped.length <= 500 ? stripped : `${stripped.slice(0, 500)}…`
}

export const createProviderError = (input: CreateProviderErrorInput): ProviderErrorRuntime => {
  if (!PROVIDER_ERROR_CODE_SET.has(input.code)) {
    throw new Error(`createProviderError: unknown ProviderErrorCode "${String(input.code)}"`)
  }

  const safeDetailsRaw = input.safeDetails
  const safeDetails =
    safeDetailsRaw === undefined
      ? undefined
      : (redactProviderLogFields(safeDetailsRaw) as Record<
          string,
          string | number | boolean | null
        >)

  const sanitizedCauseType = sanitizeCauseType(input.causeType)

  return {
    code: input.code,
    providerId: input.providerId,
    retryable: input.retryable ?? isRetryableByDefault(input.code),
    causeRedacted: clampMessage(input.message),
    ...(input.capability !== undefined ? { capability: input.capability } : {}),
    ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
    ...(sanitizedCauseType !== undefined ? { causeType: sanitizedCauseType } : {}),
    ...(safeDetails !== undefined ? { safeDetails } : {}),
  }
}

export const isProviderError = (value: unknown): value is ProviderErrorRuntime => {
  if (value === null || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<ProviderErrorRuntime>
  return (
    typeof candidate.code === 'string' &&
    PROVIDER_ERROR_CODE_SET.has(candidate.code as ProviderErrorCode) &&
    typeof candidate.providerId === 'string' &&
    typeof candidate.retryable === 'boolean'
  )
}

export interface NormalizeProviderErrorContext {
  readonly providerId: ProviderId
  readonly capability?: ProviderCapability
  readonly requestId?: string
  /** Default code applied when the thrown value carries no usable signal. */
  readonly defaultCode?: ProviderErrorCode
}

const causeTypeOf = (error: unknown): string => {
  if (error instanceof Error) {
    return error.constructor?.name ?? 'Error'
  }
  if (error === null) {
    return 'null'
  }
  return typeof error
}

const messageOf = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    return String(error)
  } catch {
    return 'unknown error'
  }
}

export const normalizeProviderError = (
  error: unknown,
  context: NormalizeProviderErrorContext
): ProviderErrorRuntime => {
  if (isProviderError(error)) {
    return error
  }
  const code = context.defaultCode ?? 'provider_unavailable'
  return createProviderError({
    code,
    providerId: context.providerId,
    message: messageOf(error),
    causeType: causeTypeOf(error),
    ...(context.capability !== undefined ? { capability: context.capability } : {}),
    ...(context.requestId !== undefined ? { requestId: context.requestId } : {}),
  })
}

export interface ProviderErrorSafeJson {
  readonly code: ProviderErrorCode
  readonly message: string
  readonly providerId: ProviderId
  readonly capability: ProviderCapability | null
  readonly retryable: boolean
  readonly causeType: string | null
  readonly safeDetails: Readonly<Record<string, string | number | boolean | null>> | null
}

/**
 * Browser/log-safe JSON projection of a ProviderError. Never includes stack traces,
 * raw causes, secrets, or arbitrary extra fields. Output keys are stable.
 */
export const providerErrorToSafeJson = (error: ProviderErrorRuntime): ProviderErrorSafeJson => {
  const safeDetails =
    error.safeDetails === undefined
      ? null
      : (redactProviderLogFields(error.safeDetails) as Record<
          string,
          string | number | boolean | null
        >)
  return {
    code: error.code,
    message: error.causeRedacted ?? '',
    providerId: error.providerId,
    capability: error.capability ?? null,
    retryable: error.retryable,
    causeType: error.causeType ?? null,
    safeDetails,
  }
}

/**
 * Low-cardinality string used by the logger as `errorType`. Derived purely from the
 * closed-union code so log aggregation cannot blow up its label space.
 */
export const providerErrorTypeOf = (code: ProviderErrorCode): string => {
  return `provider.${code}`
}
