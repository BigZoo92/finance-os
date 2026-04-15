import { describe, expect, it } from 'bun:test'
import { computeAiBudgetState } from './budget-policy'

describe('computeAiBudgetState', () => {
  it('keeps deep analysis and challenger enabled while usage is under guardrails', () => {
    const state = computeAiBudgetState({
      dailyUsdSpent: 2.4,
      monthlyUsdSpent: 31,
      dailyBudgetUsd: 10,
      monthlyBudgetUsd: 200,
    })

    expect(state.blocked).toBe(false)
    expect(state.deepAnalysisAllowed).toBe(true)
    expect(state.challengerAllowed).toBe(true)
    expect(state.reasons).toEqual([])
  })

  it('disables deep analysis before the challenger when spend crosses the first threshold', () => {
    const state = computeAiBudgetState({
      dailyUsdSpent: 6,
      monthlyUsdSpent: 60,
      dailyBudgetUsd: 10,
      monthlyBudgetUsd: 200,
      deepAnalysisDisableRatio: 0.5,
      challengerDisableRatio: 0.75,
    })

    expect(state.blocked).toBe(false)
    expect(state.deepAnalysisAllowed).toBe(false)
    expect(state.challengerAllowed).toBe(true)
    expect(state.reasons).toEqual(['deep_analysis_budget_guard'])
  })

  it('blocks usage once the budget is exhausted', () => {
    const state = computeAiBudgetState({
      dailyUsdSpent: 12,
      monthlyUsdSpent: 80,
      dailyBudgetUsd: 10,
      monthlyBudgetUsd: 100,
    })

    expect(state.blocked).toBe(true)
    expect(state.deepAnalysisAllowed).toBe(false)
    expect(state.challengerAllowed).toBe(false)
    expect(state.reasons).toContain('daily_budget_exceeded')
  })

  it('treats non-positive budgets as a hard stop', () => {
    const state = computeAiBudgetState({
      dailyUsdSpent: 0,
      monthlyUsdSpent: 0,
      dailyBudgetUsd: 0,
      monthlyBudgetUsd: -1,
    })

    expect(state.blocked).toBe(true)
    expect(state.reasons).toEqual([
      'daily_budget_non_positive',
      'monthly_budget_non_positive',
    ])
  })
})
