import { createDbClient } from '@finance-os/db'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { env } from './env'
import { logApiEvent } from './observability/logger'

const shouldRunMigrations = process.env.RUN_DB_MIGRATIONS !== 'false'
const migrationsFolder = process.env.DRIZZLE_MIGRATIONS_FOLDER ?? 'packages/db/drizzle'

const runMigrations = async () => {
  logApiEvent({
    level: 'info',
    msg: 'api migrations starting',
    migrationsFolder,
  })

  const dbClient = createDbClient(env.DATABASE_URL)

  try {
    await migrate(dbClient.db, { migrationsFolder })
    logApiEvent({
      level: 'info',
      msg: 'api migrations applied',
      migrationsFolder,
    })
  } finally {
    await dbClient.close()
  }
}

if (shouldRunMigrations) {
  await runMigrations()
} else {
  logApiEvent({
    level: 'info',
    msg: 'api migrations skipped',
    reason: 'RUN_DB_MIGRATIONS=false',
  })
}

await import('./index')
