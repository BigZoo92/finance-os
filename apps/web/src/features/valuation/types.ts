import type { DashboardValuationStatus } from '@/features/dashboard-types'

/** Keep in sync with apps/api/src/routes/dashboard/domain/valuation/create-asset-valuation-use-cases.ts */

export type ValuationStatusCounts = Record<DashboardValuationStatus, number>

export type ValuationBreakdownEntry = {
  itemCount: number
  valueBase: number | null
  unknownValueCount: number
}

export type ValuationCoverageReport = {
  baseCurrency: 'EUR'
  totalItems: number
  statusCounts: ValuationStatusCounts
  coveragePercent: number | null
  totalValueBase: number | null
  unknownValueCount: number
  providerBreakdown: Record<string, ValuationBreakdownEntry>
  assetClassBreakdown: Record<string, ValuationBreakdownEntry>
}

export type ValuationRunSummary = {
  runId: number
  dryRun: boolean
  status: 'completed' | 'failed' | 'running'
  triggerSource: 'admin' | 'internal'
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  coverage: ValuationCoverageReport | null
  itemCount: number | null
  snapshotCount: number | null
  wouldCreateSnapshots: number | null
  providerFailures: Array<{ provider: string; errorCode: string; safeErrorMessage: string }>
  safeErrorCode: string | null
  safeErrorMessage: string | null
}

export type ValuationStatusResponse = {
  featureEnabled: boolean
  fxEnabled: boolean
  state: 'idle' | 'running' | 'completed' | 'failed'
  latestRun: ValuationRunSummary | null
  fx: {
    baseCurrency: 'EUR'
    ratesAvailable: number
    staleRates: number
    latestRateTimestamp: string | null
  }
}

export type ValuationUnresolvedItem = {
  itemKey: string
  name: string
  provider: string | null
  assetClass: string
  status: string
  identityStatus: string
  errorCode: string | null
  safeErrorMessage: string | null
  asOf: string | null
}

export type ValuationUnresolvedResponse = {
  items: ValuationUnresolvedItem[]
  totalItems: number
}
