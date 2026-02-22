import { createDbClient } from '@finance-os/db'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { env } from './env'

const shouldRunMigrations = process.env.RUN_DB_MIGRATIONS !== 'false'
const migrationsFolder = process.env.DRIZZLE_MIGRATIONS_FOLDER ?? 'packages/db/drizzle'

const runMigrations = async () => {
  console.log(`[api] running migrations from ${migrationsFolder}`)

  const dbClient = createDbClient(env.DATABASE_URL)

  try {
    await migrate(dbClient.db, { migrationsFolder })
    console.log('[api] migrations applied')
  } finally {
    await dbClient.close()
  }
}

if (shouldRunMigrations) {
  await runMigrations()
} else {
  console.log('[api] skipping migrations (RUN_DB_MIGRATIONS=false)')
}

await import('./index')
