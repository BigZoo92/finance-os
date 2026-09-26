import type {
  DashboardGoalProgressSnapshot,
  DashboardGoalResponse,
  DashboardGoalsResponse,
  DashboardGoalType,
  DashboardGoalWriteInput,
} from '@finance-os/api-contract/goals'

export type FinancialGoalType = DashboardGoalType

export type FinancialGoalProgressSnapshot = DashboardGoalProgressSnapshot

export type FinancialGoal = DashboardGoalResponse

export type FinancialGoalsResponse = DashboardGoalsResponse

export type FinancialGoalWriteInput = DashboardGoalWriteInput

export type FinancialGoalAction = 'create' | 'update' | 'archive'

export type FinancialGoalActionError = {
  message: string
  code?: string
  requestId?: string
  retryable: boolean
  offline: boolean
}
