import { describe, expect, it } from 'bun:test'
import { summarizeByCurrency, toMonthlyAmount, type CostOverviewSubscription } from './costs-overview'

const subscription = (
  overrides: Partial<CostOverviewSubscription>
): CostOverviewSubscription => ({
  id: 'seed-x',
  provider: 'x_twitter',
  label: 'X API Basic seat',
  amount: 8,
  currency: 'EUR',
  cadence: 'monthly',
  monthlyAmount: 8,
  annualAmount: 96,
  category: 'provider_subscription',
  source: 'seed_recurring_cost',
  ...overrides,
})

describe('costs overview recurring (fixed) cost', () => {
  it('includes the fixed 2 x 8 EUR recurring cost in the monthly overview', () => {
    const subscriptions = [
      subscription({ id: 'seat-1', monthlyAmount: 8, annualAmount: 96 }),
      subscription({ id: 'seat-2', monthlyAmount: 8, annualAmount: 96 }),
    ]

    expect(summarizeByCurrency(subscriptions, 'monthlyAmount')).toEqual([
      { currency: 'EUR', amount: 16 },
    ])
    expect(summarizeByCurrency(subscriptions, 'annualAmount')).toEqual([
      { currency: 'EUR', amount: 192 },
    ])
  })

  it('keeps currencies separate in the monthly overview', () => {
    const subscriptions = [
      subscription({ id: 'eur', currency: 'EUR', monthlyAmount: 8 }),
      subscription({ id: 'usd', currency: 'USD', monthlyAmount: 10 }),
    ]
    expect(summarizeByCurrency(subscriptions, 'monthlyAmount')).toEqual([
      { currency: 'EUR', amount: 8 },
      { currency: 'USD', amount: 10 },
    ])
  })

  it('normalizes any cadence to a comparable monthly amount', () => {
    expect(toMonthlyAmount(8, 'monthly')).toBe(8)
    expect(toMonthlyAmount(96, 'yearly')).toBeCloseTo(8)
    expect(toMonthlyAmount(7, 'weekly')).toBeCloseTo((7 * 52) / 12)
    expect(toMonthlyAmount(1, 'daily')).toBeCloseTo(30.4375)
    expect(toMonthlyAmount(50, 'one_time')).toBe(0)
  })
})
