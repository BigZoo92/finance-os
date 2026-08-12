import type { DashboardSummaryResponse } from './dashboard-types'

type CockpitBreakdownKey = 'available' | 'savings' | 'investments' | 'manual'

export type CockpitBreakdownItem = {
  id: string
  label: string
  detail: string | null
  value: number | null
}

export type CockpitBreakdown = {
  key: CockpitBreakdownKey
  label: string
  value: number | null
  items: CockpitBreakdownItem[]
}

export type CockpitViewModel = {
  totalWealth: number | null
  coveragePercent: number | null
  unknownValueCount: number
  valuationAsOf: string | null
  valuationState: 'derived' | 'estimated' | 'stale' | 'unresolved' | 'unavailable'
  breakdowns: CockpitBreakdown[]
}

const sumKnown = (items: CockpitBreakdownItem[]): number | null => {
  if (items.length === 0 || items.some(item => item.value === null)) return null
  return items.reduce((sum, item) => sum + (item.value ?? 0), 0)
}

const assetValueInBaseCurrency = (
  asset: DashboardSummaryResponse['assets'][number]
): number | null => {
  if (asset.valueBase !== undefined) return asset.valueBase
  return asset.currency === 'EUR' ? asset.valuation : null
}

const accountValueInBaseCurrency = (
  account: DashboardSummaryResponse['accounts'][number]
): number | null => (account.currency === 'EUR' ? account.balance : null)

const isSavingsAccount = (type: string | null) => type?.toLowerCase() === 'savings'

export const buildCockpitViewModel = (
  summary: DashboardSummaryResponse | null | undefined
): CockpitViewModel => {
  const accounts = summary?.accounts.filter(account => account.enabled) ?? []
  const accountById = new Map(accounts.map(account => [account.powensAccountId, account]))
  const assets = summary?.assets.filter(asset => asset.enabled) ?? []
  const cashAssets = assets.filter(asset => asset.type === 'cash')

  const availableItems: CockpitBreakdownItem[] = []
  const savingsItems: CockpitBreakdownItem[] = []

  if (cashAssets.length > 0) {
    for (const asset of cashAssets) {
      const account = asset.powensAccountId ? accountById.get(asset.powensAccountId) : undefined
      const item: CockpitBreakdownItem = {
        id: `asset-${asset.assetId}`,
        label: asset.providerInstitutionName ?? asset.name,
        detail: account?.name ?? asset.name,
        value: assetValueInBaseCurrency(asset),
      }
      if (isSavingsAccount(account?.type ?? null)) savingsItems.push(item)
      else availableItems.push(item)
    }
  } else {
    for (const account of accounts) {
      const item: CockpitBreakdownItem = {
        id: `account-${account.powensAccountId}`,
        label: account.name,
        detail: account.type,
        value: accountValueInBaseCurrency(account),
      }
      if (isSavingsAccount(account.type)) savingsItems.push(item)
      else availableItems.push(item)
    }
  }

  const investmentItems = assets
    .filter(asset => asset.type === 'investment')
    .map(
      (asset): CockpitBreakdownItem => ({
        id: `asset-${asset.assetId}`,
        label: asset.name,
        detail: asset.providerInstitutionName,
        value: assetValueInBaseCurrency(asset),
      })
    )
  const manualItems = assets
    .filter(asset => asset.type === 'manual')
    .map(
      (asset): CockpitBreakdownItem => ({
        id: `asset-${asset.assetId}`,
        label: asset.name,
        detail: 'Actif manuel',
        value: assetValueInBaseCurrency(asset),
      })
    )

  const valuation = summary?.valuation ?? null
  const valuationState: CockpitViewModel['valuationState'] = !valuation
    ? 'unavailable'
    : valuation.statusCounts.stale > 0
      ? 'stale'
      : valuation.statusCounts.unresolved > 0 || valuation.statusCounts.unavailable > 0
        ? 'unresolved'
        : valuation.statusCounts.estimated > 0
          ? 'estimated'
          : 'derived'

  const breakdowns: CockpitBreakdown[] = [
    {
      key: 'available',
      label: 'Disponible',
      value: sumKnown(availableItems),
      items: availableItems,
    },
    { key: 'savings', label: 'Épargne', value: sumKnown(savingsItems), items: savingsItems },
    {
      key: 'investments',
      label: 'Investissements',
      value: sumKnown(investmentItems),
      items: investmentItems,
    },
    { key: 'manual', label: 'Autres actifs', value: sumKnown(manualItems), items: manualItems },
  ]

  return {
    totalWealth: valuation?.totalValueBase ?? null,
    coveragePercent: valuation?.coveragePercent ?? null,
    unknownValueCount: valuation?.unknownValueCount ?? 0,
    valuationAsOf: valuation?.asOf ?? null,
    valuationState,
    breakdowns,
  }
}
