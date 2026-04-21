export interface CategorizationMigrationSnapshot {
  mode: 'demo' | 'admin'
  evaluatedAt: string
  total: number
  rolloutPercent: number
  disagreements: number
  disagreementRate: number
  overAlertThreshold: boolean
  byMerchant: Array<{ key: string; total: number; disagreements: number }>
  byCategory: Array<{ key: string; total: number; disagreements: number }>
  byAccount: Array<{ key: string; total: number; disagreements: number }>
  shadowDisabledReason: 'disabled' | 'latency_budget_exceeded' | null
  shadowLatencyMs: number
}

let latestSnapshot: CategorizationMigrationSnapshot | null = null

export const recordCategorizationMigrationSnapshot = (snapshot: CategorizationMigrationSnapshot) => {
  latestSnapshot = snapshot
}

export const getCategorizationMigrationSnapshot = () => latestSnapshot
