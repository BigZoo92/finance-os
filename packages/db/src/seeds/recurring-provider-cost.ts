/**
 * Idempotent seed for `recurring_provider_cost`.
 *
 * Represents the fixed recurring "2 x 8 EUR" X API Basic subscription that the
 * cost overview must surface as a real fixed monthly cost (distinct from the
 * variable, estimated pay-per-use usage). Mirrors the demo fixture amounts in
 * `apps/api/.../routes/costs-overview.ts` so demo and prod agree.
 *
 * Idempotency: each entry carries a stable `metadata.seedKey`. The seed reads
 * the existing seed keys and inserts only the missing ones — re-running never
 * duplicates rows and never mutates or deletes existing data.
 *
 * Run (controlled command):
 *   pnpm db:seed:recurring-costs            # apply
 *   pnpm db:seed:recurring-costs -- --dry-run   # preview, no write
 */

import { sql } from 'drizzle-orm'
import { createDbClient } from '../client'
import { schema } from '../index'

export type RecurringProviderCostSeedEntry = {
  seedKey: string
  provider: string
  label: string
  /** numeric column — passed as string to preserve precision */
  amount: string
  currency: string
  cadence: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'one_time'
  category: string
}

export const RECURRING_PROVIDER_COST_SEED: readonly RecurringProviderCostSeedEntry[] = [
  {
    seedKey: 'x_api_basic_seat_1',
    provider: 'x_twitter',
    label: 'X API Basic seat 1',
    amount: '8',
    currency: 'EUR',
    cadence: 'monthly',
    category: 'provider_subscription',
  },
  {
    seedKey: 'x_api_basic_seat_2',
    provider: 'x_twitter',
    label: 'X API Basic seat 2',
    amount: '8',
    currency: 'EUR',
    cadence: 'monthly',
    category: 'provider_subscription',
  },
]

type SeedDb = ReturnType<typeof createDbClient>['db']

export type SeedResult = {
  inserted: string[]
  skipped: string[]
}

/**
 * Insert the missing recurring-cost seed rows. Pure with respect to existing
 * data: existing seed keys are skipped, nothing is updated or deleted.
 */
export const seedRecurringProviderCost = async (
  db: SeedDb,
  { now = new Date(), dryRun = false }: { now?: Date; dryRun?: boolean } = {}
): Promise<SeedResult> => {
  const existing = await db
    .select({
      seedKey: sql<string | null>`${schema.recurringProviderCost.metadata} ->> 'seedKey'`,
    })
    .from(schema.recurringProviderCost)

  const existingKeys = new Set(
    existing.map(row => row.seedKey).filter((key): key is string => Boolean(key))
  )

  const inserted: string[] = []
  const skipped: string[] = []

  for (const entry of RECURRING_PROVIDER_COST_SEED) {
    if (existingKeys.has(entry.seedKey)) {
      skipped.push(entry.seedKey)
      continue
    }
    if (!dryRun) {
      await db.insert(schema.recurringProviderCost).values({
        provider: entry.provider,
        label: entry.label,
        amount: entry.amount,
        currency: entry.currency,
        cadence: entry.cadence,
        category: entry.category,
        source: 'seed_recurring_cost',
        owner: 'admin',
        active: true,
        metadata: { seedKey: entry.seedKey, seededAt: now.toISOString() },
      })
    }
    inserted.push(entry.seedKey)
  }

  return { inserted, skipped }
}

const runCli = async () => {
  const dryRun = process.argv.includes('--dry-run')
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is required (set it in the environment or ../../.env).')
    process.exit(1)
    return
  }

  const client = createDbClient(databaseUrl)
  try {
    const result = await seedRecurringProviderCost(client.db, { dryRun })
    console.log(
      JSON.stringify(
        {
          dryRun,
          inserted: result.inserted,
          skipped: result.skipped,
          message: dryRun
            ? 'Dry run: no rows written.'
            : `Seed applied: ${result.inserted.length} inserted, ${result.skipped.length} already present.`,
        },
        null,
        2
      )
    )
  } finally {
    await client.close()
  }
}

// Bun sets import.meta.main when the file is the entrypoint. Importing the
// module for tests does not trigger the CLI.
if ((import.meta as unknown as { main?: boolean }).main) {
  void runCli()
}
