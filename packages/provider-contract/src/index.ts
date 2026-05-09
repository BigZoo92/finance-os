// PR17A — Public barrel for `@finance-os/provider-contract`.
//
// Re-exports every type the rest of the monorepo is allowed to depend on. Importing this
// barrel gives consumers the full contract surface; no other path inside this package is a
// supported import target. Per the package's `exports` map, capability/error/provider/result
// subpath imports are also supported for narrower needs.

export {
  ALLOWED_PROVIDER_CAPABILITIES,
  FORBIDDEN_PROVIDER_CAPABILITIES,
  __PROVIDER_CAPABILITY_GUARD_OK,
} from './capabilities'
export type {
  ForbiddenProviderCapability,
  ProviderCapability,
  ProviderCapabilityDefinition,
} from './capabilities'

export type {
  BudgetPolicy,
  FreshnessPolicy,
  ProviderCallContext,
  ProviderMode,
} from './context'
export { PROVIDER_MODES } from './context'

export { PROVIDER_ERROR_CODES } from './error'
export type { ProviderError, ProviderErrorCode } from './error'

export { PROVIDER_HEALTH_STATUSES } from './health'
export type { ProviderHealth, ProviderHealthStatus } from './health'

export type { ProviderMeta, ProviderSourceMeta } from './meta'

export { asProviderId } from './provider-id'
export type { ProviderId } from './provider-id'

export type { Provider, ProviderRegistryContract } from './provider'

export type {
  ProviderResult,
  ProviderResultErr,
  ProviderResultOk,
} from './result'
