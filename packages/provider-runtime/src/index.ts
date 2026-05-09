// PR17B–E — Public barrel for `@finance-os/provider-runtime`.
//
// This package builds the runtime layer on top of `@finance-os/provider-contract` (PR17A):
// safe error/result/logger/redaction primitives, an in-memory registry, sync-state
// shapes, a diagnostics use-case, and a reusable invariant test harness. No provider
// migrations live here — adapter modules will import from this package as they migrate.

export type {
  ComputeProviderDiagnosticsInput,
  ProviderDiagnosticsEntry,
  ProviderDiagnosticsResponse,
  ProviderDiagnosticsStatus,
  ProviderDiagnosticsSummary,
} from './diagnostics'
export {
  computeDemoProviderDiagnostics,
  computeProviderDiagnostics,
} from './diagnostics'
export type {
  CreateProviderErrorInput,
  NormalizeProviderErrorContext,
  ProviderErrorRuntime,
  ProviderErrorSafeJson,
} from './error'
export {
  createProviderError,
  isProviderError,
  normalizeProviderError,
  providerErrorToSafeJson,
  providerErrorTypeOf,
} from './error'
export type {
  ProviderLogEventFields,
  ProviderLogEventInput,
  ProviderLogEventName,
  ProviderLogLevel,
  ProviderLogTarget,
} from './logger'

export {
  logProviderEvent,
  PROVIDER_LOG_EVENT_NAMES,
} from './logger'
export type {
  RedactionOptions,
  SensitiveFieldFinding,
  SensitiveKeyMatcher,
} from './redaction'
export {
  assertNoSensitiveProviderFields,
  createSensitiveKeyMatcher,
  redactProviderLogFields,
  redactProviderPayload,
} from './redaction'
export type { ProviderRegistry } from './registry'
export { createProviderRegistry } from './registry'
export {
  mapProviderError,
  mapProviderResult,
  providerErr,
  providerOk,
  unwrapProviderResultOrThrow,
} from './result'
export type {
  ComputeFreshnessInput,
  CreateProviderSyncStateInput,
  ProviderFreshnessState,
  ProviderSyncRunMeta,
  ProviderSyncState,
  ProviderSyncStatus,
} from './sync-meta'
export {
  computeProviderFreshness,
  createProviderSyncState,
  PROVIDER_SYNC_STATUSES,
} from './sync-meta'
export type { CapturedLogLine } from './test-harness'
export {
  assertProviderContract,
  assertProviderDoesNotExposeForbiddenCapabilities,
  assertProviderErrorSafe,
  assertProviderLogsSafe,
  assertProviderResultSafe,
} from './test-harness'
