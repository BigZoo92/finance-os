import { describe, expect, it } from 'vitest'
import type { FinancialGoal } from './types'
import { buildActiveGoalsAggregate, calculateGoalProgress } from './view-model'

const goal = (overrides: Partial<FinancialGoal>): FinancialGoal => ({
  id: 1,
  name: 'Objectif',
  goalType: 'custom',
  currency: 'EUR',
  targetAmount: 1_000,
  currentAmount: 250,
  targetDate: null,
  note: null,
  progressSnapshots: [],
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('goals view model', () => {
  it('returns an unavailable aggregate when there are no active goals', () => {
    const aggregate = buildActiveGoalsAggregate([goal({ archivedAt: '2026-02-01T00:00:00.000Z' })])
    expect(aggregate.activeGoals).toEqual([])
    expect(aggregate.progress).toBeNull()
  })

  it('excludes archived goals from totals and progress', () => {
    const aggregate = buildActiveGoalsAggregate([
      goal({ id: 1, currentAmount: 500, targetAmount: 1_000 }),
      goal({
        id: 2,
        currentAmount: 10_000,
        targetAmount: 10_000,
        archivedAt: '2026-02-01T00:00:00.000Z',
      }),
    ])
    expect(aggregate.currentAmount).toBe(500)
    expect(aggregate.targetAmount).toBe(1_000)
    expect(aggregate.progress).toBe(50)
  })

  it('uses the canonical weighted progress calculation', () => {
    const aggregate = buildActiveGoalsAggregate([
      goal({ id: 1, currentAmount: 500, targetAmount: 1_000 }),
      goal({ id: 2, currentAmount: 1_000, targetAmount: 3_000 }),
    ])
    expect(aggregate.progress).toBe(37.5)
    expect(calculateGoalProgress(0, 1_000)).toBe(0)
  })

  it('does not aggregate goals across currencies', () => {
    const aggregate = buildActiveGoalsAggregate([
      goal({ id: 1, currency: 'EUR' }),
      goal({ id: 2, currency: 'USD' }),
    ])
    expect(aggregate.currentAmount).toBeNull()
    expect(aggregate.progress).toBeNull()
  })
})
