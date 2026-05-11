// Macro Prompt 2 — Internal provider registry mount.
// Macro Prompt 3 — Adds the `news-service` aggregation wrapper (`news.items.read`).
// Macro Prompt 4 — Adds health-only sensitive provider wrappers for Powens
//   (`banking.accounts.read`), IBKR Flex (`external_investments.positions.read`), and
//   Binance Spot (`crypto.wallet.read`). Read routing for these three remains
//   deferred — their `call()` returns `unsupported_capability` with a documented
//   `deferred_read_routing` reason. Health snapshots are derived from local DB rows
//   only; the wrappers never call Powens / IBKR / Binance.
//
// Builds an in-memory `ProviderRegistry` for the internal providers migrated so far.
// The `/dashboard/providers/diagnostics` admin route consumes this registry's
// `getHealth()` snapshots; the sensitive wrappers also expose async `refreshHealth()`
// hooks aggregated into a single `refreshSensitiveProviderHealth()` function the
// dashboard runtime invokes from the diagnostics route before reading health.

import type { Provider } from '@finance-os/provider-contract'
import {
  createProviderRegistry,
  type ProviderLogTarget,
  type ProviderRegistry,
} from '@finance-os/provider-runtime'
import { type BinanceProviderDeps, createBinanceProvider } from './binance-provider'
import { createIbkrProvider, type IbkrProviderDeps } from './ibkr-provider'
import {
  createKnowledgeContextBundleProvider,
  type KnowledgeContextBundleProviderDeps,
} from './knowledge-context-bundle-provider'
import { createNewsServiceProvider, type NewsServiceProviderDeps } from './news-service-provider'
import { createPowensProvider, type PowensProviderDeps } from './powens-provider'
import {
  createQuantPatternsDetectProvider,
  type QuantPatternsDetectProviderDeps,
} from './quant-patterns-detect-provider'

export interface InternalProviderRegistryDeps {
  readonly knowledge: Omit<KnowledgeContextBundleProviderDeps, 'logTarget'>
  readonly quantPatterns: Omit<QuantPatternsDetectProviderDeps, 'logTarget'>
  readonly news: Omit<NewsServiceProviderDeps, 'logTarget'>
  readonly powens: Omit<PowensProviderDeps, 'logTarget'>
  readonly ibkr: Omit<IbkrProviderDeps, 'logTarget'>
  readonly binance: Omit<BinanceProviderDeps, 'logTarget'>
  readonly logTarget: ProviderLogTarget
}

export interface InternalProviderRegistryHandle {
  readonly registry: ProviderRegistry
  /**
   * Refreshes in-memory health snapshots for the sensitive wrappers (powens / ibkr /
   * binance) from local DB rows. Resolves once all refreshers have settled — failures
   * inside a single wrapper are swallowed and downgrade only that wrapper's snapshot.
   * Safe to call concurrently.
   */
  readonly refreshSensitiveProviderHealth: () => Promise<void>
}

export const createInternalProviderRegistry = (
  deps: InternalProviderRegistryDeps
): InternalProviderRegistryHandle => {
  const knowledge = createKnowledgeContextBundleProvider({
    ...deps.knowledge,
    logTarget: deps.logTarget,
  })
  const quantPatterns = createQuantPatternsDetectProvider({
    ...deps.quantPatterns,
    logTarget: deps.logTarget,
  })
  const news = createNewsServiceProvider({
    ...deps.news,
    logTarget: deps.logTarget,
  })
  const powens = createPowensProvider({
    ...deps.powens,
    logTarget: deps.logTarget,
  })
  const ibkr = createIbkrProvider({
    ...deps.ibkr,
    logTarget: deps.logTarget,
  })
  const binance = createBinanceProvider({
    ...deps.binance,
    logTarget: deps.logTarget,
  })

  // The narrow per-capability `Provider<C, In, Out>` types widen to the registry's
  // `Provider<C>` (unknown In/Out). The cast is safe because `Provider`'s `call`
  // accepts wider input than the concrete adapter cares about.
  const registry = createProviderRegistry([
    knowledge,
    quantPatterns,
    news,
    powens.provider,
    ibkr.provider,
    binance.provider,
  ] as unknown as ReadonlyArray<Provider>)

  const refreshSensitiveProviderHealth = async (): Promise<void> => {
    // Each wrapper's refreshHealth swallows its own exceptions; Promise.all here is
    // safe and gives parallel DB reads when the diagnostics endpoint is hit.
    await Promise.all([powens.refreshHealth(), ibkr.refreshHealth(), binance.refreshHealth()])
  }

  return { registry, refreshSensitiveProviderHealth }
}
