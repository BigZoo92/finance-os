import type { AssetClass, PriceSourceType } from '@finance-os/db/schema'

export type PriceSnapshotContract = {
  id?: number
  assetId?: string | null
  instrumentId?: string | null
  symbol: string
  assetClass: AssetClass
  provider: string
  sourceType: PriceSourceType
  price: number
  currency: string
  marketTimestamp: string
  fetchedAt: string
  delaySeconds: number
  staleAfterSeconds: number
  isMarketOpen?: boolean | null
  confidence: number
}

export type StalenessResult = {
  isStale: boolean
  staleReason: string | null
  ageSeconds: number
}

export const resolvePriceStaleness = ({
  snapshot,
  now = new Date(),
}: {
  snapshot: PriceSnapshotContract
  now?: Date
}): StalenessResult => {
  const fetchedAtMs = new Date(snapshot.fetchedAt).getTime()
  if (!Number.isFinite(fetchedAtMs)) {
    return {
      isStale: true,
      staleReason: 'invalid_fetched_at',
      ageSeconds: Number.POSITIVE_INFINITY,
    }
  }

  const ageSeconds = Math.max(0, Math.floor((now.getTime() - fetchedAtMs) / 1000))
  if (ageSeconds <= snapshot.staleAfterSeconds) {
    return { isStale: false, staleReason: null, ageSeconds }
  }

  if (snapshot.isMarketOpen === false && snapshot.sourceType === 'eod') {
    return {
      isStale: false,
      staleReason: null,
      ageSeconds,
    }
  }

  return {
    isStale: true,
    staleReason: `price_age_${ageSeconds}s_exceeds_${snapshot.staleAfterSeconds}s`,
    ageSeconds,
  }
}

export const computeValuationConfidence = ({
  priceConfidence,
  fxConfidence,
  isPriceStale,
}: {
  priceConfidence: number
  fxConfidence?: number | null
  isPriceStale: boolean
}) => {
  const fx = fxConfidence ?? 1
  const stalePenalty = isPriceStale ? 0.5 : 1
  return Math.max(0, Math.min(1, priceConfidence * fx * stalePenalty))
}

export type PricingProviderDescriptor = {
  provider: string
  assetClasses: AssetClass[]
  sourceTypes: PriceSourceType[]
  priority: number
  status: 'available' | 'disabled' | 'not_implemented'
}

export const createPricingProviderRegistry = (providers: PricingProviderDescriptor[]) => ({
  list: () => [...providers].sort((a, b) => a.priority - b.priority),
  findForAssetClass: (assetClass: AssetClass) =>
    providers
      .filter(provider => provider.assetClasses.includes(assetClass))
      .sort((a, b) => a.priority - b.priority),
})
