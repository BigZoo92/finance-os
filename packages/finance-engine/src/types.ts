export type AssetClass =
  | 'cash'
  | 'equity_global'
  | 'equity_us'
  | 'equity_europe'
  | 'equity_emerging'
  | 'fixed_income'
  | 'gold'
  | 'real_estate'
  | 'alternatives'
  | 'unknown'

export type RiskProfile = 'conservative' | 'balanced' | 'growth'

export type RecommendationCategory =
  | 'cash_optimization'
  | 'spend_reduction'
  | 'recurring_commitments'
  | 'emergency_fund'
  | 'allocation_drift'
  | 'diversification'
  | 'risk_concentration'
  | 'opportunistic_idea'
  | 'caution'
  | 'tax_note'

export type RecommendationRiskLevel = 'low' | 'medium' | 'high'

export type RecommendationEffort = 'low' | 'medium' | 'high'

export interface FinancePositionInput {
  id: string
  name: string
  value: number
  assetClass: AssetClass
  currency?: string
  feesBps?: number | null
  sector?: string | null
  country?: string | null
  metadata?: Record<string, unknown> | null
}

export interface FinanceGoalInput {
  id: string
  name: string
  goalType: string
  targetAmount: number
  currentAmount: number
  targetDate?: string | null
}

export interface ExpenseFocusInput {
  label: string
  category: string
  merchant: string
  total: number
  count: number
}

export interface DailyWealthPoint {
  date: string
  balance: number
}

export interface ExternalSignalSummary {
  id: string
  title: string
  direction: 'risk' | 'opportunity' | 'mixed'
  severity: number
  confidence: number
  whyItMatters: string[]
}

export interface FinanceEngineInput {
  asOf: string
  range: '7d' | '30d' | '90d'
  currency: string
  monthlyIncome: number
  monthlyExpenses: number
  liquidCashValue: number
  positions: FinancePositionInput[]
  goals: FinanceGoalInput[]
  dailyWealth: DailyWealthPoint[]
  topExpenses: ExpenseFocusInput[]
  signals?: ExternalSignalSummary[]
  explicitRiskProfile?: RiskProfile | null
  inflationAssumptionPct?: number | null
  contextAssumptions?: AdvisorAssumptionLog[]
}

export interface AssetClassAssumption {
  assetClass: AssetClass
  expectedReturnPct: number
  expectedRealReturnPctFloor: number
  volatilityPct: number
  downsideDeviationPct: number
  stressShockPct: number
  feeBpsDefault: number
  labels: string[]
}

export interface RiskProfileTargetRange {
  min: number
  max: number
  midpoint: number
}

export interface RiskProfileTargets {
  riskProfile: RiskProfile
  emergencyFundMonths: number
  opportunisticSleeveCapPct: number
  rebalancingBandPct: number
  targetAllocations: {
    cash: RiskProfileTargetRange
    growth: RiskProfileTargetRange
    defensive: RiskProfileTargetRange
  }
}

export interface AllocationBucket {
  bucket: string
  value: number
  weightPct: number
}

export interface AssetClassAllocation extends AllocationBucket {
  assetClass: AssetClass
  expectedReturnPct: number
  volatilityPct: number
  riskContributionPct: number
}

export interface DriftSignal {
  bucket: 'cash' | 'growth' | 'defensive'
  weightPct: number
  targetMinPct: number
  targetMaxPct: number
  midpointPct: number
  driftPct: number
  status: 'within_band' | 'underweight' | 'overweight'
}

export interface ScenarioResult {
  scenarioId: string
  title: string
  description: string
  endingValue: number
  deltaValue: number
  deltaPct: number
}

export interface AdvisorMetricSet {
  totalValue: number
  liquidCashValue: number
  investedValue: number
  netMonthlyCashflow: number
  savingsRatePct: number | null
  emergencyFundMonths: number | null
  runwayMonths: number | null
  cashAllocationPct: number
  topPositionSharePct: number
  concentrationHhi: number
  effectivePositionCount: number
  diversificationScore: number
  expectedAnnualReturnPct: number
  expectedRealReturnPct: number
  feeDragPct: number
  cashDragPct: number
  volatilityPct: number
  downsideDeviationPct: number
  sharpeRatio: number | null
  sortinoRatio: number | null
  observedMaxDrawdownPct: number | null
  riskBudgetSkewPct: number
}

export interface AdvisorAssumptionLog {
  key: string
  value: unknown
  source: 'default' | 'inferred' | 'observed'
  justification: string
}

export interface AdvisorSnapshot {
  asOf: string
  range: '7d' | '30d' | '90d'
  currency: string
  riskProfile: RiskProfile
  targets: RiskProfileTargets
  metrics: AdvisorMetricSet
  allocationBuckets: AllocationBucket[]
  assetClassAllocations: AssetClassAllocation[]
  driftSignals: DriftSignal[]
  scenarios: ScenarioResult[]
  assumptions: AdvisorAssumptionLog[]
  diagnostics: {
    signalsRiskCount: number
    signalsOpportunityCount: number
    contradictorySignalCount: number
    topExpenseSharePct: number
  }
}

export interface DeterministicRecommendation {
  id: string
  type: string
  title: string
  description: string
  category: RecommendationCategory
  whyNow: string
  evidence: string[]
  assumptions: string[]
  confidence: number
  riskLevel: RecommendationRiskLevel
  expectedImpact: {
    summary: string
    value: number | null
    unit: 'eur_per_month' | 'eur_per_year' | 'pct' | 'months'
  }
  effort: RecommendationEffort
  reversibility: 'high' | 'medium' | 'low'
  blockingFactors: string[]
  alternatives: string[]
  deterministicMetricsUsed: string[]
  priorityScore: number
}
