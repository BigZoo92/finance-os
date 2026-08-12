import type { FinancialGoal } from './types'

export const calculateGoalProgress = (
  currentAmount: number,
  targetAmount: number
): number | null => {
  if (!Number.isFinite(currentAmount) || !Number.isFinite(targetAmount) || targetAmount <= 0) {
    return null
  }
  const percent = (currentAmount / targetAmount) * 100
  return Math.max(0, Math.min(100, Math.round(percent * 10) / 10))
}

export type ActiveGoalsAggregate = {
  activeGoals: FinancialGoal[]
  currency: string | null
  currentAmount: number | null
  targetAmount: number | null
  progress: number | null
}

export const buildActiveGoalsAggregate = (goals: FinancialGoal[]): ActiveGoalsAggregate => {
  const activeGoals = goals.filter(goal => goal.archivedAt === null)
  if (activeGoals.length === 0) {
    return {
      activeGoals,
      currency: null,
      currentAmount: null,
      targetAmount: null,
      progress: null,
    }
  }

  const currencies = new Set(activeGoals.map(goal => goal.currency))
  if (currencies.size !== 1) {
    return {
      activeGoals,
      currency: null,
      currentAmount: null,
      targetAmount: null,
      progress: null,
    }
  }

  const currentAmount = activeGoals.reduce((sum, goal) => sum + goal.currentAmount, 0)
  const targetAmount = activeGoals.reduce((sum, goal) => sum + goal.targetAmount, 0)

  return {
    activeGoals,
    currency: activeGoals[0]?.currency ?? null,
    currentAmount,
    targetAmount,
    progress: calculateGoalProgress(currentAmount, targetAmount),
  }
}
