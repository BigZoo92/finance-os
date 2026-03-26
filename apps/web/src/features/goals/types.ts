export type FinancialGoalType =
  | 'emergency_fund'
  | 'travel'
  | 'home'
  | 'education'
  | 'retirement'
  | 'custom'

export type FinancialGoalProgressSnapshot = {
  recordedAt: string
  amount: number
  note: string | null
}

export type FinancialGoal = {
  id: number
  name: string
  goalType: FinancialGoalType
  currency: string
  targetAmount: number
  currentAmount: number
  targetDate: string | null
  note: string | null
  progressSnapshots: FinancialGoalProgressSnapshot[]
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export type FinancialGoalsResponse = {
  items: FinancialGoal[]
}

export type FinancialGoalWriteInput = {
  name: string
  goalType: FinancialGoalType
  currency: string
  targetAmount: number
  currentAmount: number
  targetDate: string | null
  note: string | null
}

export type FinancialGoalAction = 'create' | 'update' | 'archive'

export type FinancialGoalActionError = {
  message: string
  code?: string
  requestId?: string
  retryable: boolean
  offline: boolean
}
