import type { AuthMode } from './auth-types'
import type { DashboardRange, DashboardSummaryResponse } from './dashboard-types'

/**
 * Temporary compatibility adapter for the current dashboard UI during the
 * new dashboard data-model migration.
 *
 * Exit criteria (remove this file):
 * 1. Dashboard screens consume the new API contract directly with no legacy assumptions.
 * 2. Fallback counters stay at zero in normal admin usage.
 * 3. Range mismatch diagnostics are no longer observed in QA/CI.
 */
export interface LegacyDashboardAdapterResult {
  range: DashboardRange
  totals: DashboardSummaryResponse['totals']
  connections: DashboardSummaryResponse['connections']
  accounts: DashboardSummaryResponse['accounts']
  assets: DashboardSummaryResponse['assets']
  positions: DashboardSummaryResponse['positions']
  dailyWealthSnapshots: DashboardSummaryResponse['dailyWealthSnapshots']
  topExpenseGroups: DashboardSummaryResponse['topExpenseGroups']
  migration: {
    stage: DashboardMigrationStage
    fallbackFieldCount: number
    fallbackFields: string[]
    hasDivergence: boolean
  }
}

export type DashboardMigrationStage =
  | 'new-model-ready'
  | 'mixed-fallback'
  | 'legacy-fallback'
  | 'contract-divergence'

interface AdapterDiagnostics {
  fallbackFields: string[]
  divergences: string[]
}

const createDiagnostics = (): AdapterDiagnostics => ({
  fallbackFields: [],
  divergences: [],
})

const allSupportedFallbackFields = [
  'totals',
  'connections',
  'accounts',
  'assets',
  'positions',
  'dailyWealthSnapshots',
  'topExpenseGroups',
] as const

const getMigrationStage = (diagnostics: AdapterDiagnostics): DashboardMigrationStage => {
  if (diagnostics.divergences.length > 0) {
    return 'contract-divergence'
  }

  if (diagnostics.fallbackFields.length === 0) {
    return 'new-model-ready'
  }

  if (diagnostics.fallbackFields.length === allSupportedFallbackFields.length) {
    return 'legacy-fallback'
  }

  return 'mixed-fallback'
}

const toArrayWithFallback = <T>(value: T[] | undefined, field: string, diagnostics: AdapterDiagnostics) => {
  if (Array.isArray(value)) {
    return value
  }

  diagnostics.fallbackFields.push(field)
  return []
}

const toTotalsWithFallback = (
  totals: DashboardSummaryResponse['totals'] | undefined,
  diagnostics: AdapterDiagnostics
): DashboardSummaryResponse['totals'] => {
  if (totals) {
    return totals
  }

  diagnostics.fallbackFields.push('totals')
  return {
    balance: 0,
    incomes: 0,
    expenses: 0,
  }
}

const logDashboardAdapterEvent = ({
  mode,
  range,
  diagnostics,
}: {
  mode: AuthMode | 'unknown'
  range: DashboardRange
  diagnostics: AdapterDiagnostics
}) => {
  if (diagnostics.fallbackFields.length === 0 && diagnostics.divergences.length === 0) {
    return
  }

  const payload = {
    mode,
    range,
    fallbackFields: diagnostics.fallbackFields,
    divergences: diagnostics.divergences,
    timestamp: new Date().toISOString(),
  }

  if (diagnostics.divergences.length > 0) {
    console.error('[web:dashboard-adapter]', payload)
    return
  }

  console.info('[web:dashboard-adapter]', payload)
}

export const adaptDashboardSummaryLegacy = ({
  range,
  summary,
  mode,
}: {
  range: DashboardRange
  summary: DashboardSummaryResponse | undefined
  mode?: AuthMode
}): LegacyDashboardAdapterResult => {
  const diagnostics = createDiagnostics()

  if (summary?.range && summary.range !== range) {
    diagnostics.divergences.push(`range_mismatch:${summary.range}->${range}`)
  }

  const result: LegacyDashboardAdapterResult = {
    range,
    totals: toTotalsWithFallback(summary?.totals, diagnostics),
    connections: toArrayWithFallback(summary?.connections, 'connections', diagnostics),
    accounts: toArrayWithFallback(summary?.accounts, 'accounts', diagnostics),
    assets: toArrayWithFallback(summary?.assets, 'assets', diagnostics),
    positions: toArrayWithFallback(summary?.positions, 'positions', diagnostics),
    dailyWealthSnapshots: toArrayWithFallback(
      summary?.dailyWealthSnapshots,
      'dailyWealthSnapshots',
      diagnostics
    ),
    topExpenseGroups: toArrayWithFallback(summary?.topExpenseGroups, 'topExpenseGroups', diagnostics),
    migration: {
      stage: getMigrationStage(diagnostics),
      fallbackFieldCount: diagnostics.fallbackFields.length,
      fallbackFields: [...diagnostics.fallbackFields],
      hasDivergence: diagnostics.divergences.length > 0,
    },
  }

  logDashboardAdapterEvent({
    mode: mode ?? 'unknown',
    range,
    diagnostics,
  })

  return result
}
