// PR17B — Safe provider event logger.
//
// Adapts the project's existing JSON logger shape (`logEvent({ level, msg, ...fields })`)
// to a closed-set provider event vocabulary. Every field passes through redaction before
// it is handed to the underlying logger, regardless of how careful callers think they are.

import type {
  ProviderCapability,
  ProviderErrorCode,
  ProviderId,
} from '@finance-os/provider-contract'
import { providerErrorTypeOf } from './error'
import { redactProviderLogFields } from './redaction'

export const PROVIDER_LOG_EVENT_NAMES = [
  'provider.call.started',
  'provider.call.succeeded',
  'provider.call.failed',
  'provider.call.skipped',
  'provider.health.checked',
  'provider.sync.started',
  'provider.sync.succeeded',
  'provider.sync.failed',
  'provider.sync.skipped',
] as const

export type ProviderLogEventName = (typeof PROVIDER_LOG_EVENT_NAMES)[number]

export type ProviderLogLevel = 'debug' | 'info' | 'warn' | 'error'

const DEFAULT_LEVEL_FOR_EVENT: Record<ProviderLogEventName, ProviderLogLevel> = {
  'provider.call.started': 'debug',
  'provider.call.succeeded': 'info',
  'provider.call.failed': 'warn',
  'provider.call.skipped': 'info',
  'provider.health.checked': 'debug',
  'provider.sync.started': 'info',
  'provider.sync.succeeded': 'info',
  'provider.sync.failed': 'error',
  'provider.sync.skipped': 'info',
}

/**
 * Closed-vocabulary fields any provider log line is allowed to carry. Anything outside
 * this set is dropped before reaching the underlying logger.
 */
export interface ProviderLogEventFields {
  readonly providerId?: ProviderId
  readonly capability?: ProviderCapability
  readonly requestId?: string
  readonly mode?: 'demo' | 'admin'
  readonly errorCode?: ProviderErrorCode
  readonly errorType?: string
  readonly durationMs?: number
  readonly cacheStatus?: 'hit' | 'miss' | 'bypass' | 'unknown'
  readonly freshnessMinutes?: number | null
  readonly degraded?: boolean
  readonly redactionApplied?: boolean
  readonly retryable?: boolean
  readonly status?: string
  readonly syncRunId?: string
  readonly itemCount?: number
  readonly stale?: boolean
}

const ALLOWED_FIELD_KEYS: ReadonlySet<keyof ProviderLogEventFields> = new Set<
  keyof ProviderLogEventFields
>([
  'providerId',
  'capability',
  'requestId',
  'mode',
  'errorCode',
  'errorType',
  'durationMs',
  'cacheStatus',
  'freshnessMinutes',
  'degraded',
  'redactionApplied',
  'retryable',
  'status',
  'syncRunId',
  'itemCount',
  'stale',
])

export interface ProviderLogTarget {
  readonly logEvent: (event: {
    level: ProviderLogLevel
    msg: string
    [key: string]: unknown
  }) => void
}

export interface ProviderLogEventInput {
  readonly name: ProviderLogEventName
  readonly level?: ProviderLogLevel
  readonly fields?: ProviderLogEventFields
}

const filterToAllowedFields = (
  fields: ProviderLogEventFields | undefined
): Record<string, unknown> => {
  if (fields === undefined) {
    return {}
  }
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(fields) as Array<keyof ProviderLogEventFields>) {
    if (!ALLOWED_FIELD_KEYS.has(key)) {
      continue
    }
    const value = fields[key]
    if (value === undefined) {
      continue
    }
    out[key] = value
  }
  return out
}

const deriveErrorType = (fields: Record<string, unknown>): Record<string, unknown> => {
  if (typeof fields.errorType === 'string') {
    return fields
  }
  if (typeof fields.errorCode === 'string') {
    return {
      ...fields,
      errorType: providerErrorTypeOf(fields.errorCode as ProviderErrorCode),
    }
  }
  return fields
}

export const logProviderEvent = (target: ProviderLogTarget, input: ProviderLogEventInput): void => {
  const allowed = filterToAllowedFields(input.fields)
  const withErrorType = deriveErrorType(allowed)
  const redacted = redactProviderLogFields(withErrorType)
  const level = input.level ?? DEFAULT_LEVEL_FOR_EVENT[input.name]
  target.logEvent({
    level,
    msg: input.name,
    event: input.name,
    ...redacted,
  })
}
