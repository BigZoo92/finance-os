/*
 * Input DTOs for the investment strategy use cases.
 *
 * Kept free of imports from `../../types` so the dashboard types module can
 * reference them without creating an import cycle with the use cases.
 */

type Mode = 'demo' | 'admin'

export type InvestmentStrategyUpdateInput = {
  monthlyContributionTarget?: number | null
  rebalanceThresholdPct?: number
  horizonYears?: number
  riskProfile?: 'conservative' | 'balanced' | 'growth' | 'aggressive' | 'custom'
  description?: string
}

export type GenerateActionPlanInput = {
  mode: Mode
  requestId: string
  triggerSource: string
  dryRun?: boolean
}

export type AssetSearchInput = {
  mode: Mode
  requestId: string
  query: string
}

export type WatchlistAssetInput = {
  symbol: string
  name: string
  assetClass: string
  providerSymbols?: Record<string, string>
  iconUrl?: string | null
  logoUrl?: string | null
  isin?: string | null
  exchange?: string | null
  currency: string
  userInterestLevel?: 'none' | 'watching' | 'interested' | 'high_interest'
  userIntent?: 'watch' | 'analyze' | 'compare' | 'consider_buy' | 'exclude'
  note?: string | null
}

export type WatchlistAssetPatchInput = Partial<
  Pick<
    WatchlistAssetInput,
    | 'name'
    | 'assetClass'
    | 'providerSymbols'
    | 'iconUrl'
    | 'logoUrl'
    | 'isin'
    | 'exchange'
    | 'currency'
    | 'userInterestLevel'
    | 'userIntent'
    | 'note'
  >
>

export type ReviewDueInput = {
  mode: Mode
  requestId: string
  triggerSource: string
  dryRun?: boolean
  limit?: number
}
