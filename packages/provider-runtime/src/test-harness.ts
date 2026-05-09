// PR17E — Provider invariant test harness.
//
// Reusable assertions future provider tests can compose to prove a candidate adapter
// holds the contract before being registered. Tests live next to the adapter; this
// module supplies the predicates so each adapter does not re-derive them.

import {
  FORBIDDEN_PROVIDER_CAPABILITIES,
  type ForbiddenProviderCapability,
  PROVIDER_ERROR_CODES,
  PROVIDER_HEALTH_STATUSES,
  type Provider,
  type ProviderError,
  type ProviderResult,
} from '@finance-os/provider-contract'
import { isProviderError } from './error'
import { assertNoSensitiveProviderFields, redactProviderPayload } from './redaction'

const PROVIDER_ERROR_CODE_SET: ReadonlySet<string> = new Set(PROVIDER_ERROR_CODES)
const PROVIDER_HEALTH_STATUS_SET: ReadonlySet<string> = new Set(PROVIDER_HEALTH_STATUSES)
const FORBIDDEN_CAPABILITY_SET: ReadonlySet<string> = new Set(
  FORBIDDEN_PROVIDER_CAPABILITIES as ReadonlyArray<string>
)

export const assertProviderContract = (provider: Provider): void => {
  if (typeof provider.id !== 'string' || provider.id.length === 0) {
    throw new Error('assertProviderContract: provider.id must be a non-empty string')
  }
  if (typeof provider.capability !== 'string' || provider.capability.length === 0) {
    throw new Error('assertProviderContract: provider.capability must be a non-empty string')
  }
  if (typeof provider.call !== 'function') {
    throw new Error('assertProviderContract: provider.call must be a function')
  }
  if (typeof provider.getHealth !== 'function') {
    throw new Error('assertProviderContract: provider.getHealth must be a function')
  }
  const health = provider.getHealth()
  if (!PROVIDER_HEALTH_STATUS_SET.has(health.status)) {
    throw new Error(
      `assertProviderContract: provider.getHealth().status must be one of ${[...PROVIDER_HEALTH_STATUS_SET].join(', ')}`
    )
  }
}

export const assertProviderDoesNotExposeForbiddenCapabilities = (provider: Provider): void => {
  if (FORBIDDEN_CAPABILITY_SET.has(provider.capability as ForbiddenProviderCapability)) {
    throw new Error(
      `assertProviderDoesNotExposeForbiddenCapabilities: forbidden capability "${provider.capability}" exposed by "${provider.id}"`
    )
  }
}

export const assertProviderErrorSafe = (error: ProviderError): void => {
  if (!isProviderError(error)) {
    throw new Error('assertProviderErrorSafe: value is not a ProviderError')
  }
  if (!PROVIDER_ERROR_CODE_SET.has(error.code)) {
    throw new Error(`assertProviderErrorSafe: unknown error code "${error.code}"`)
  }
  // No raw payload should survive in any error field.
  assertNoSensitiveProviderFields(redactProviderPayload(error))
}

export const assertProviderResultSafe = <T>(result: ProviderResult<T>): void => {
  if (typeof result?.ok !== 'boolean') {
    throw new Error('assertProviderResultSafe: result must be a discriminated union with `ok`')
  }
  if (result.meta === undefined) {
    throw new Error('assertProviderResultSafe: result must always carry meta')
  }
  if (typeof result.meta.requestId !== 'string') {
    throw new Error('assertProviderResultSafe: meta.requestId must be a string')
  }
  if (!Array.isArray(result.meta.sources) || result.meta.sources.length === 0) {
    throw new Error('assertProviderResultSafe: meta.sources must be non-empty')
  }
  if (!result.ok) {
    assertProviderErrorSafe(result.error)
  }
  assertNoSensitiveProviderFields(redactProviderPayload(result))
}

export interface CapturedLogLine {
  readonly level: string
  readonly msg: string
  readonly [key: string]: unknown
}

export const assertProviderLogsSafe = (logs: ReadonlyArray<CapturedLogLine>): void => {
  for (const line of logs) {
    assertNoSensitiveProviderFields(redactProviderPayload(line))
  }
}
