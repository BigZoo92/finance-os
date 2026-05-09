// Macro Prompt 2 — Internal provider registry mount.
//
// Builds an in-memory `ProviderRegistry` for the two internal providers migrated in this
// batch (knowledge-service context bundle, quant-service pattern detection). The registry
// has NO consumers in route code yet — wiring routes/diagnostics through it lands in a
// follow-up macro prompt. The mount exists today so the contract surface is exercised by
// tests and so a future caller has one explicit constructor instead of building ad-hoc
// registries everywhere.

import type { Provider } from '@finance-os/provider-contract'
import {
  createProviderRegistry,
  type ProviderLogTarget,
  type ProviderRegistry,
} from '@finance-os/provider-runtime'
import {
  createKnowledgeContextBundleProvider,
  type KnowledgeContextBundleProviderDeps,
} from './knowledge-context-bundle-provider'
import {
  createQuantPatternsDetectProvider,
  type QuantPatternsDetectProviderDeps,
} from './quant-patterns-detect-provider'

export interface InternalProviderRegistryDeps {
  readonly knowledge: Omit<KnowledgeContextBundleProviderDeps, 'logTarget'>
  readonly quantPatterns: Omit<QuantPatternsDetectProviderDeps, 'logTarget'>
  readonly logTarget: ProviderLogTarget
}

export const createInternalProviderRegistry = (
  deps: InternalProviderRegistryDeps
): ProviderRegistry => {
  const knowledge = createKnowledgeContextBundleProvider({
    ...deps.knowledge,
    logTarget: deps.logTarget,
  })
  const quantPatterns = createQuantPatternsDetectProvider({
    ...deps.quantPatterns,
    logTarget: deps.logTarget,
  })
  // The narrow per-capability `Provider<C, In, Out>` types widen to the registry's
  // `Provider<C>` (unknown In/Out). The cast is safe because `Provider`'s `call`
  // accepts wider input than the concrete adapter cares about.
  return createProviderRegistry([knowledge, quantPatterns] as unknown as ReadonlyArray<Provider>)
}
