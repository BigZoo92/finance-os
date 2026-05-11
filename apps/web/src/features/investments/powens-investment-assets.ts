import type { DashboardSummaryResponse } from '../dashboard-types'

type DashboardAsset = DashboardSummaryResponse['assets'][number]

export type PowensInvestmentAsset = DashboardAsset & {
  provider: 'powens'
}

export const getUnpositionedPowensInvestmentAssets = ({
  assets,
  positions,
}: {
  assets: DashboardSummaryResponse['assets']
  positions: DashboardSummaryResponse['positions']
}): PowensInvestmentAsset[] => {
  const positionedAssetIds = new Set(
    positions
      .filter(position => position.enabled && position.assetId !== null)
      .map(position => position.assetId)
  )

  return assets.filter(
    (asset): asset is PowensInvestmentAsset =>
      asset.enabled &&
      asset.type === 'investment' &&
      asset.provider === 'powens' &&
      !positionedAssetIds.has(asset.assetId)
  )
}

export const sumPowensInvestmentAssetValuations = (assets: PowensInvestmentAsset[]) =>
  assets.reduce((sum, asset) => {
    if (!Number.isFinite(asset.valuation)) {
      return sum
    }

    return sum + asset.valuation
  }, 0)
