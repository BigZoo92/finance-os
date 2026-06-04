import { describe, expect, it } from 'bun:test'
import {
  RECURRING_PROVIDER_COST_SEED,
  seedRecurringProviderCost,
} from './recurring-provider-cost'

type Row = { metadata?: { seedKey?: string } }

// Hand fake: select returns the seedKey of every stored row (the function
// filters in JS); insert appends. Models idempotency without a real DB.
const createFakeDb = (rows: Row[]) =>
  ({
    select: () => ({
      from: async () => rows.map(row => ({ seedKey: row.metadata?.seedKey ?? null })),
    }),
    insert: () => ({
      values: async (value: Row) => {
        rows.push(value)
      },
    }),
  }) as unknown as Parameters<typeof seedRecurringProviderCost>[0]

describe('seedRecurringProviderCost', () => {
  it('inserts the 2 x 8 EUR recurring cost rows on first run', async () => {
    const rows: Row[] = []
    const result = await seedRecurringProviderCost(createFakeDb(rows))

    expect(result.inserted).toEqual(['x_api_basic_seat_1', 'x_api_basic_seat_2'])
    expect(result.skipped).toEqual([])
    expect(rows).toHaveLength(2)
  })

  it('is idempotent: a second run inserts nothing and never duplicates', async () => {
    const rows: Row[] = []
    const db = createFakeDb(rows)

    await seedRecurringProviderCost(db)
    const second = await seedRecurringProviderCost(db)

    expect(second.inserted).toEqual([])
    expect(second.skipped).toEqual(['x_api_basic_seat_1', 'x_api_basic_seat_2'])
    expect(rows).toHaveLength(RECURRING_PROVIDER_COST_SEED.length)
  })

  it('writes nothing in dry-run mode', async () => {
    const rows: Row[] = []
    const result = await seedRecurringProviderCost(createFakeDb(rows), { dryRun: true })

    expect(result.inserted).toEqual(['x_api_basic_seat_1', 'x_api_basic_seat_2'])
    expect(rows).toHaveLength(0)
  })
})
