import type { DashboardSummaryResponse } from './dashboard-types'

export type WealthBucket = {
  key: 'cash' | 'investment' | 'manual'
  label: string
  value: number | null
  itemCount: number
  unknownValueCount: number
}

export type PatrimoineViewModel = {
  totalValue: number | null
  coveragePercent: number | null
  unknownValueCount: number
  asOf: string | null
  buckets: WealthBucket[]
  historyAvailable: false
}

const LABELS: Record<WealthBucket['key'], string> = {
  cash: 'Liquidités',
  investment: 'Investi',
  manual: 'Manuel',
}

const baseValue = (asset: DashboardSummaryResponse['assets'][number]) => {
  if (asset.valueBase !== undefined) return asset.valueBase
  return asset.currency === 'EUR' ? asset.valuation : null
}

export const buildPatrimoineViewModel = (
  summary: DashboardSummaryResponse | null | undefined
): PatrimoineViewModel => {
  const buckets: WealthBucket[] = (['cash', 'investment', 'manual'] as const).map(key => {
    const assets = summary?.assets.filter(asset => asset.enabled && asset.type === key) ?? []
    const values = assets.map(baseValue)
    const knownValues = values.filter((value): value is number => value !== null)
    return {
      key,
      label: LABELS[key],
      value: knownValues.length > 0 ? knownValues.reduce((sum, value) => sum + value, 0) : null,
      itemCount: assets.length,
      unknownValueCount: values.filter(value => value === null).length,
    }
  })

  return {
    totalValue: summary?.valuation?.totalValueBase ?? null,
    coveragePercent: summary?.valuation?.coveragePercent ?? null,
    unknownValueCount: summary?.valuation?.unknownValueCount ?? 0,
    asOf: summary?.valuation?.asOf ?? null,
    buckets,
    historyAvailable: false,
  }
}
