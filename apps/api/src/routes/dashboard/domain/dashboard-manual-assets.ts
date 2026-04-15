import type {
  DashboardManualAssetPersistenceInput,
  DashboardManualAssetResponse,
  DashboardManualAssetsResponse,
  DashboardManualAssetWriteInput,
  DashboardReadRepository,
  ManualAssetRow,
} from '../types'

const toNumber = (value: string | number | null | undefined) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

const toMoney = (value: number) => Math.round(value * 100) / 100

const toIsoString = (value: Date | null) => value?.toISOString() ?? null

const readMetadataString = (metadata: Record<string, unknown> | null, key: string) => {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

const toManualAssetResponse = (row: ManualAssetRow): DashboardManualAssetResponse => ({
  assetId: row.assetId,
  type: row.assetType,
  origin: row.origin,
  source: row.source,
  name: row.name,
  currency: row.currency,
  valuation: toMoney(toNumber(row.valuation)),
  valuationAsOf: toIsoString(row.valuationAsOf),
  enabled: row.enabled,
  note: readMetadataString(row.metadata, 'note'),
  category: readMetadataString(row.metadata, 'category'),
  metadata: row.metadata,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const toPersistenceInput = (
  input: DashboardManualAssetWriteInput
): DashboardManualAssetPersistenceInput => ({
  assetType: input.assetType,
  name: input.name,
  currency: input.currency.trim().toUpperCase(),
  valuation: input.valuation.toFixed(2),
  valuationAsOf: input.valuationAsOf ? new Date(input.valuationAsOf) : null,
  note: input.note,
  category: input.category,
  enabled: input.enabled,
})

export const createDashboardManualAssetUseCases = ({
  repository,
}: {
  repository: DashboardReadRepository
}) => ({
  getManualAssets: async (): Promise<DashboardManualAssetsResponse> => {
    const rows = await repository.listManualAssets()
    return {
      items: rows.map(toManualAssetResponse),
    }
  },

  createManualAsset: async (
    input: DashboardManualAssetWriteInput
  ): Promise<DashboardManualAssetResponse> => {
    const created = await repository.createManualAsset(toPersistenceInput(input))
    return toManualAssetResponse(created)
  },

  updateManualAsset: async (
    assetId: number,
    input: DashboardManualAssetWriteInput
  ): Promise<DashboardManualAssetResponse | null> => {
    const updated = await repository.updateManualAsset(assetId, toPersistenceInput(input))
    return updated ? toManualAssetResponse(updated) : null
  },

  deleteManualAsset: async (assetId: number) => {
    const deleted = await repository.deleteManualAsset(assetId)
    return {
      ok: deleted,
      assetId,
    }
  },
})
