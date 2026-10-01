import type { ValuationItemInput } from '@finance-os/finance-engine'

/**
 * Canonical item selection — the single anti-double-count rule.
 *
 * The same money exists in up to three tables:
 *   asset (bank balances, manual assets, bridged external copies)
 *   external_investment_position (IBKR / Binance canonical rows)
 *   investment_position (Powens wealth / manual + bridged external copies)
 *
 * One item per economic position is selected:
 *   1. `asset` rows with source !== 'external_investment' (bank cash, Powens
 *      wealth account values, manual assets);
 *   2. `external_investment_position` rows (richer than their bridged copies:
 *      symbol, quantity, cost basis, degraded reasons);
 *   3. `investment_position` rows not bridged to an asset (assetId === null),
 *      not external, and still open.
 *
 * Bridged copies (asset.source === 'external_investment', positions with
 * assetId !== null) are excluded because their value is already counted.
 */

export interface ValuationAssetRow {
  assetId: number
  assetType: 'cash' | 'investment' | 'manual'
  origin: 'provider' | 'manual'
  source: string
  provider: string | null
  name: string
  currency: string
  valuation: string | null
  valuationAsOf: Date | null
  enabled: boolean
}

export interface ValuationExternalPositionRow {
  positionKey: string
  provider: string
  instrumentKey: string | null
  name: string
  symbol: string | null
  assetClass: string
  currency: string | null
  valueCurrency: string | null
  quantity: number | null
  normalizedValue: number | null
  providerValue: number | null
  valueAsOf: string | null
  valueSource: string | null
  costBasis: number | null
  costBasisCurrency: string | null
  degradedReasons: string[]
}

export interface ValuationInternalPositionRow {
  positionId: number
  positionKey: string
  assetId: number | null
  source: string
  provider: string | null
  name: string
  currency: string
  quantity: string | null
  costBasis: string | null
  costBasisSource: 'minimal' | 'provider' | 'manual' | 'unknown'
  currentValue: string | null
  lastKnownValue: string | null
  closedAt: Date | null
  valuedAt: Date | null
}

export interface ExternalInstrumentIdentityRow {
  instrumentKey: string
  symbol: string | null
  isin: string | null
  conid: string | null
  binanceAsset: string | null
  currency: string | null
}

/** Strict parser: unknown stays null, never 0. */
export const toFiniteNumberOrNull = (value: string | number | null | undefined): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const toIsoOrNull = (value: Date | string | null | undefined): string | null => {
  if (value instanceof Date) {
    return value.toISOString()
  }
  return value ?? null
}

const normalizeAssetClass = (assetType: 'cash' | 'investment' | 'manual') => {
  if (assetType === 'cash') {
    return 'cash'
  }
  if (assetType === 'manual') {
    return 'other'
  }
  return 'fund'
}

export const collectValuationItems = ({
  assets,
  externalPositions,
  internalPositions,
  instrumentIdentities,
}: {
  assets: ValuationAssetRow[]
  externalPositions: ValuationExternalPositionRow[]
  internalPositions: ValuationInternalPositionRow[]
  instrumentIdentities: ExternalInstrumentIdentityRow[]
}): ValuationItemInput[] => {
  const identityByInstrumentKey = new Map(
    instrumentIdentities.map(identity => [identity.instrumentKey, identity])
  )
  // A position bridged to an asset (assetId !== null) is counted through the
  // asset row; its cost basis is grafted onto the asset item so P&L survives.
  const bridgedPositionByAssetId = new Map<number, ValuationInternalPositionRow>()
  for (const position of internalPositions) {
    if (
      position.assetId !== null &&
      position.closedAt === null &&
      position.source !== 'external_investment' &&
      !bridgedPositionByAssetId.has(position.assetId)
    ) {
      bridgedPositionByAssetId.set(position.assetId, position)
    }
  }

  const items: ValuationItemInput[] = []

  for (const asset of assets) {
    if (!asset.enabled || asset.source === 'external_investment') {
      continue
    }
    const isManual = asset.origin === 'manual'
    const bridgedPosition = bridgedPositionByAssetId.get(asset.assetId)
    const costBasis = bridgedPosition ? toFiniteNumberOrNull(bridgedPosition.costBasis) : null
    items.push({
      itemKey: `asset:${asset.assetId}`,
      kind: asset.assetType,
      name: asset.name,
      provider: asset.provider,
      assetClass: normalizeAssetClass(asset.assetType),
      currency: asset.currency,
      quantity: bridgedPosition ? toFiniteNumberOrNull(bridgedPosition.quantity) : null,
      nativeValue: toFiniteNumberOrNull(asset.valuation),
      asOf: toIsoOrNull(asset.valuationAsOf),
      isManual,
      costBasis,
      costBasisCurrency: bridgedPosition?.currency ?? null,
      costBasisSource:
        costBasis === null ? 'unknown' : (bridgedPosition?.costBasisSource ?? 'unknown'),
      identity: { provider: asset.provider },
      degradedReasons: [],
    })
  }

  for (const position of externalPositions) {
    const instrument = position.instrumentKey
      ? identityByInstrumentKey.get(position.instrumentKey)
      : undefined
    const currency = position.valueCurrency ?? position.currency
    items.push({
      itemKey: `external:${position.positionKey}`,
      kind: position.assetClass === 'cash' ? 'cash' : 'position',
      name: position.name,
      provider: position.provider,
      assetClass: position.assetClass,
      currency: currency ?? null,
      quantity: position.quantity,
      nativeValue: position.normalizedValue ?? position.providerValue,
      asOf: position.valueAsOf,
      isManual: false,
      costBasis: position.costBasis,
      costBasisCurrency: position.costBasisCurrency ?? position.currency ?? null,
      costBasisSource: position.costBasis === null ? 'unknown' : 'provider',
      identity: {
        provider: position.provider,
        symbol: position.symbol ?? instrument?.symbol ?? null,
        isin: instrument?.isin ?? null,
        conid: instrument?.conid ?? null,
        binanceAsset: instrument?.binanceAsset ?? null,
        currency: currency ?? instrument?.currency ?? null,
      },
      degradedReasons: position.degradedReasons,
      // Upstream marker set by the Binance enrichment when the FX bridge was
      // a stale snapshot: the value is usable but must read as an estimate.
      approximateValue: position.valueSource === 'market_resolved_estimated',
    })
  }

  for (const position of internalPositions) {
    if (
      position.assetId !== null ||
      position.closedAt !== null ||
      position.source === 'external_investment'
    ) {
      continue
    }
    items.push({
      itemKey: `position:${position.positionKey}`,
      kind: 'position',
      name: position.name,
      provider: position.provider,
      assetClass: 'other',
      currency: position.currency,
      quantity: toFiniteNumberOrNull(position.quantity),
      nativeValue:
        toFiniteNumberOrNull(position.currentValue) ??
        toFiniteNumberOrNull(position.lastKnownValue),
      asOf: toIsoOrNull(position.valuedAt),
      isManual: position.source === 'manual',
      costBasis: toFiniteNumberOrNull(position.costBasis),
      costBasisCurrency: position.currency,
      costBasisSource: position.costBasisSource,
      identity: { provider: position.provider },
      degradedReasons: [],
    })
  }

  return items
}
