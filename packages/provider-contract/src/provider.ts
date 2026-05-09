// PR17A — Provider<C> + ProviderRegistryContract (TYPES ONLY).
//
// `Provider<C>` is the per-capability adapter contract. A single concrete adapter MAY
// implement many capabilities by composing multiple `Provider<C>` interfaces (one per
// capability). The capability-keyed input/output DTOs are owned by Finance-OS — the
// generic parameters here are placeholders that PR17B+ will instantiate per capability.
//
// `ProviderRegistryContract` describes the SHAPE of the registry consumers will eventually
// depend on. PR17A does NOT ship a runtime registry; this is the type used to keep
// consumers honest until the runtime lands in PR17C.

import type { ProviderCapability } from './capabilities'
import type { ProviderCallContext } from './context'
import type { ProviderHealth } from './health'
import type { ProviderId } from './provider-id'
import type { ProviderResult } from './result'

// ---------------------------------------------------------------------------
// Provider<C> — per-capability adapter contract.
//
// `TInput` and `TOutput` are placeholders. PR17A does not enumerate per-capability DTOs;
// they will be declared in capability-specific contract modules as adapters migrate.
// ---------------------------------------------------------------------------

export interface Provider<
  C extends ProviderCapability = ProviderCapability,
  TInput = unknown,
  TOutput = unknown,
> {
  /** Stable identifier for this adapter (e.g., `'powens'`). */
  readonly id: ProviderId
  /** The single capability this `Provider<C>` implements. */
  readonly capability: C
  /**
   * Execute one read-only call. Adapter MUST honor `context.mode`, `context.budgetPolicy`,
   * `context.freshnessPolicy`, and `context.dryRun`. Adapter MUST return a settled
   * `ProviderResult` even on internal failure — throwing crosses the contract boundary.
   */
  readonly call: (input: TInput, context: ProviderCallContext) => Promise<ProviderResult<TOutput>>
  /** Latest health snapshot. The registry polls this; adapters MUST keep it cheap. */
  readonly getHealth: () => ProviderHealth
}

// ---------------------------------------------------------------------------
// ProviderRegistryContract — the type-only registry surface.
//
// Lookup is keyed by capability. Multiple adapters MAY register for the same capability;
// `list` returns all of them and the caller (or a future selector layer) decides which to
// use. PR17A does not implement selection — that lands with PR17C.
// ---------------------------------------------------------------------------

export interface ProviderRegistryContract {
  /** All adapters registered for the given capability, in registration order. */
  readonly list: <C extends ProviderCapability>(
    capability: C,
  ) => ReadonlyArray<Provider<C>>
  /** Lookup a specific adapter by `(capability, providerId)`. */
  readonly get: <C extends ProviderCapability>(
    capability: C,
    providerId: ProviderId,
  ) => Provider<C> | undefined
  /** Health snapshot for every registered adapter, keyed by provider id. */
  readonly health: () => ReadonlyMap<ProviderId, ProviderHealth>
}
