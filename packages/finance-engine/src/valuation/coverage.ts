import type {
  ItemValuation,
  ValuationBreakdownEntry,
  ValuationCoverageReport,
  ValuationStatusCounts,
} from './types'
import { VALUATION_BASE_CURRENCY } from './types'

const round2 = (value: number) => Math.round(value * 100) / 100

const USABLE_STATUSES = new Set(['priced', 'derived', 'estimated', 'manual', 'stale'])

const emptyCounts = (): ValuationStatusCounts => ({
  priced: 0,
  derived: 0,
  estimated: 0,
  manual: 0,
  stale: 0,
  unresolved: 0,
  unavailable: 0,
})

const addToBreakdown = (
  breakdown: Record<string, ValuationBreakdownEntry>,
  key: string,
  valuation: ItemValuation
) => {
  const entry = breakdown[key] ?? { itemCount: 0, valueBase: null, unknownValueCount: 0 }
  entry.itemCount += 1
  if (valuation.valueBase !== null) {
    entry.valueBase = round2((entry.valueBase ?? 0) + valuation.valueBase)
  } else {
    entry.unknownValueCount += 1
  }
  breakdown[key] = entry
}

/**
 * Coverage formula: items with a usable value (priced, derived, estimated,
 * manual, stale) divided by ALL items needing a valuation, times 100.
 * Nothing is excluded from the denominator — unresolved and unavailable
 * items lower the coverage instead of being silently dropped.
 */
export const buildValuationCoverageReport = (
  valuations: ItemValuation[]
): ValuationCoverageReport => {
  const statusCounts = emptyCounts()
  const providerBreakdown: Record<string, ValuationBreakdownEntry> = {}
  const assetClassBreakdown: Record<string, ValuationBreakdownEntry> = {}

  let totalValueBase: number | null = null
  let usableCount = 0
  let unknownValueCount = 0

  for (const valuation of valuations) {
    statusCounts[valuation.status] += 1
    if (USABLE_STATUSES.has(valuation.status)) {
      usableCount += 1
    }
    if (valuation.valueBase !== null) {
      totalValueBase = round2((totalValueBase ?? 0) + valuation.valueBase)
    } else {
      unknownValueCount += 1
    }

    addToBreakdown(providerBreakdown, valuation.provider ?? 'manual', valuation)
    addToBreakdown(assetClassBreakdown, valuation.assetClass, valuation)
  }

  const totalItems = valuations.length
  const coveragePercent = totalItems === 0 ? null : round2((usableCount / totalItems) * 100)

  return {
    baseCurrency: VALUATION_BASE_CURRENCY,
    totalItems,
    statusCounts,
    coveragePercent,
    totalValueBase,
    unknownValueCount,
    providerBreakdown,
    assetClassBreakdown,
  }
}
