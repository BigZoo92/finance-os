// PR17B — Provider registry skeleton.
//
// Pure in-memory registry over `Provider<C>` objects. It does NOT instantiate adapters,
// read env, or perform any external call beyond delegating `getHealth()` to the
// providers it was given. No fallback selection logic — that lives in a future PR.

import type {
  Provider,
  ProviderCapability,
  ProviderHealth,
  ProviderId,
  ProviderRegistryContract,
} from '@finance-os/provider-contract'

export interface ProviderRegistry extends ProviderRegistryContract {
  readonly listProviders: () => ReadonlyArray<Provider>
  readonly listCapabilities: () => ReadonlyArray<ProviderCapability>
  readonly getProvider: (providerId: ProviderId) => Provider | undefined
  readonly findProvidersByCapability: <C extends ProviderCapability>(
    capability: C
  ) => ReadonlyArray<Provider<C>>
  readonly healthAll: () => ReadonlyMap<ProviderId, ProviderHealth>
}

export const createProviderRegistry = (providers: ReadonlyArray<Provider>): ProviderRegistry => {
  const byId = new Map<ProviderId, Provider>()
  const byCapability = new Map<ProviderCapability, Provider[]>()
  const ordered: Provider[] = []

  for (const provider of providers) {
    if (byId.has(provider.id)) {
      throw new Error(`createProviderRegistry: duplicate provider id "${provider.id}"`)
    }
    byId.set(provider.id, provider)
    ordered.push(provider)
    const bucket = byCapability.get(provider.capability)
    if (bucket === undefined) {
      byCapability.set(provider.capability, [provider])
    } else {
      bucket.push(provider)
    }
  }

  const list = <C extends ProviderCapability>(capability: C): ReadonlyArray<Provider<C>> => {
    const bucket = byCapability.get(capability) ?? []
    return bucket as unknown as ReadonlyArray<Provider<C>>
  }

  const get = <C extends ProviderCapability>(
    capability: C,
    providerId: ProviderId
  ): Provider<C> | undefined => {
    const provider = byId.get(providerId)
    if (provider === undefined || provider.capability !== capability) {
      return undefined
    }
    return provider as Provider<C>
  }

  const health = (): ReadonlyMap<ProviderId, ProviderHealth> => {
    const out = new Map<ProviderId, ProviderHealth>()
    for (const provider of ordered) {
      out.set(provider.id, provider.getHealth())
    }
    return out
  }

  return {
    list,
    get,
    health,
    listProviders: () => ordered,
    listCapabilities: () => Array.from(byCapability.keys()),
    getProvider: providerId => byId.get(providerId),
    findProvidersByCapability: list,
    healthAll: health,
  }
}
