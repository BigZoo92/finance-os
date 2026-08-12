import type { DashboardSummaryResponse, DashboardValuationStatus } from '../dashboard-types'
import type {
  ExternalInvestmentAssetClass,
  ExternalInvestmentContextBundle,
  ExternalInvestmentPosition,
} from '../external-investments/types'
import { getUnpositionedPowensInvestmentAssets } from './powens-investment-assets'

export type InvestmentPositionRow = {
  id: string
  asset: string
  symbol: string | null
  assetClass: ExternalInvestmentAssetClass
  provider: string
  account: string | null
  value: number | null
  currency: string | null
  weightPct: number | null
  costBasis: number | null
  pnlAmount: number | null
  pnlPercent: number | null
  valuationState: DashboardValuationStatus
  valuedAt: string | null
}

export type InvestmentAllocation = { key: string; label: string; value: number; weightPct: number }

export type InvestmentsViewModel = {
  totalKnownValue: number | null
  totalPnlKnown: number | null
  unknownValueCount: number
  unknownPnlCount: number
  positions: InvestmentPositionRow[]
  providerAllocation: InvestmentAllocation[]
  assetClassAllocation: InvestmentAllocation[]
}

const externalValue = (position: ExternalInvestmentPosition): number | null => {
  if (position.normalizedValue !== null) return position.normalizedValue
  if (position.providerValue !== null && (position.valueCurrency ?? position.currency) === 'EUR') {
    return position.providerValue
  }
  return null
}

const internalValue = (position: DashboardSummaryResponse['positions'][number]): number | null => {
  const native = position.currentValue ?? position.lastKnownValue
  if (native === null) return null
  if (position.valueBase !== undefined) return position.valueBase
  return position.currency === 'EUR' ? native : null
}

const assetValue = (asset: DashboardSummaryResponse['assets'][number]): number | null => {
  if (asset.valueBase !== undefined) return asset.valueBase
  return asset.currency === 'EUR' ? asset.valuation : null
}

const calculatePnl = (
  value: number | null,
  costBasis: number | null,
  currenciesAreComparable: boolean
) => {
  if (value === null || costBasis === null || !currenciesAreComparable) {
    return { amount: null, percent: null }
  }
  const amount = value - costBasis
  return { amount, percent: costBasis > 0 ? (amount / costBasis) * 100 : null }
}

const allocationLabel = (value: string) => {
  if (value === 'ibkr') return 'IBKR'
  if (value === 'binance') return 'Binance'
  if (value === 'powens') return 'Powens'
  if (value === 'manual') return 'Manuel'
  if (value === 'etf') return 'ETF'
  if (value === 'equity') return 'Actions'
  if (value === 'crypto') return 'Crypto'
  if (value === 'stablecoin') return 'Stablecoins'
  if (value === 'fund') return 'Fonds'
  if (value === 'bond') return 'Obligations'
  if (value === 'commodity') return 'Matières premières'
  if (value === 'cash') return 'Liquidités'
  return 'Non classé'
}

const buildAllocation = (values: Map<string, number>, total: number): InvestmentAllocation[] =>
  [...values.entries()]
    .map(([key, value]) => ({
      key,
      label: allocationLabel(key),
      value,
      weightPct: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((left, right) => right.value - left.value)

export const buildInvestmentsViewModel = ({
  summary,
  externalPositions,
  externalBundle,
}: {
  summary: DashboardSummaryResponse | null | undefined
  externalPositions: ExternalInvestmentPosition[]
  externalBundle: ExternalInvestmentContextBundle | null | undefined
}): InvestmentsViewModel => {
  const rows: InvestmentPositionRow[] = []

  for (const position of externalPositions) {
    const value = externalValue(position)
    const valueCurrency = value === null ? (position.valueCurrency ?? position.currency) : 'EUR'
    const pnl = calculatePnl(
      value,
      position.costBasis,
      valueCurrency !== null && valueCurrency === position.costBasisCurrency
    )
    rows.push({
      id: `external-${position.positionKey}`,
      asset: position.name,
      symbol: position.symbol,
      assetClass: position.assetClass,
      provider: position.provider,
      account: position.accountAlias ?? position.accountExternalId,
      value,
      currency: valueCurrency,
      weightPct: null,
      costBasis: position.costBasis,
      pnlAmount: pnl.amount,
      pnlPercent: pnl.percent,
      valuationState:
        position.valueSource === 'unknown'
          ? 'unavailable'
          : position.valueSource === 'manual'
            ? 'manual'
            : position.valueSource === 'market_cache'
              ? 'derived'
              : 'priced',
      valuedAt: position.valueAsOf,
    })
  }

  const internalPositions =
    summary?.positions.filter(
      position =>
        position.enabled && position.provider !== 'ibkr' && position.provider !== 'binance'
    ) ?? []
  for (const position of internalPositions) {
    const value = internalValue(position)
    const valueCurrency = value === null ? position.currency : 'EUR'
    const pnl = calculatePnl(value, position.costBasis, position.currency === valueCurrency)
    rows.push({
      id: `internal-${position.positionId}`,
      asset: position.name,
      symbol: null,
      assetClass: 'unknown',
      provider: position.provider ?? 'manual',
      account: position.accountName,
      value,
      currency: valueCurrency,
      weightPct: null,
      costBasis: position.costBasis,
      pnlAmount: pnl.amount,
      pnlPercent: pnl.percent,
      valuationState: position.valuationStatus ?? (value === null ? 'unavailable' : 'derived'),
      valuedAt: position.valuedAt ?? position.lastSyncedAt,
    })
  }

  const powensAssets = summary
    ? getUnpositionedPowensInvestmentAssets({
        assets: summary.assets,
        positions: summary.positions,
      })
    : []
  for (const asset of powensAssets) {
    const value = assetValue(asset)
    rows.push({
      id: `powens-${asset.assetId}`,
      asset: asset.name,
      symbol: null,
      assetClass: 'unknown',
      provider: 'powens',
      account: asset.providerInstitutionName,
      value,
      currency: value === null ? asset.currency : 'EUR',
      weightPct: null,
      costBasis: null,
      pnlAmount: null,
      pnlPercent: null,
      valuationState: asset.valuationStatus ?? (value === null ? 'unavailable' : 'derived'),
      valuedAt: asset.valuationAsOf,
    })
  }

  const internalKnownTotal = rows
    .filter(row => row.provider !== 'ibkr' && row.provider !== 'binance')
    .reduce((sum, row) => sum + (row.value ?? 0), 0)
  const hasExternalSource = externalBundle !== null && externalBundle !== undefined
  const hasInternalSource = summary !== null && summary !== undefined
  const totalKnownValue =
    hasExternalSource || hasInternalSource
      ? (externalBundle?.totalKnownValue ?? 0) + internalKnownTotal
      : null

  for (const row of rows) {
    row.weightPct =
      row.value !== null && totalKnownValue !== null && totalKnownValue > 0
        ? (row.value / totalKnownValue) * 100
        : null
  }

  const knownPnlRows = rows.filter(row => row.pnlAmount !== null)
  const totalPnlKnown = knownPnlRows.length
    ? knownPnlRows.reduce((sum, row) => sum + (row.pnlAmount ?? 0), 0)
    : null
  const unknownValueCount =
    (externalBundle?.unknownValuePositionCount ??
      externalPositions.filter(position => externalValue(position) === null).length) +
    rows.filter(row => row.provider !== 'ibkr' && row.provider !== 'binance' && row.value === null)
      .length
  const unknownPnlCount = rows.filter(row => row.pnlAmount === null).length

  const providerValues = new Map<string, number>()
  for (const allocation of externalBundle?.allocationByProvider ?? []) {
    providerValues.set(allocation.key, allocation.value)
  }
  const classValues = new Map<string, number>()
  for (const allocation of externalBundle?.allocationByAssetClass ?? []) {
    classValues.set(allocation.key, allocation.value)
  }
  for (const row of rows.filter(row => row.provider !== 'ibkr' && row.provider !== 'binance')) {
    if (row.value === null) continue
    providerValues.set(row.provider, (providerValues.get(row.provider) ?? 0) + row.value)
    classValues.set(row.assetClass, (classValues.get(row.assetClass) ?? 0) + row.value)
  }

  return {
    totalKnownValue,
    totalPnlKnown,
    unknownValueCount,
    unknownPnlCount,
    positions: rows,
    providerAllocation: buildAllocation(providerValues, totalKnownValue ?? 0),
    assetClassAllocation: buildAllocation(classValues, totalKnownValue ?? 0),
  }
}
