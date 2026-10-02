/**
 * One-shot migration runner.
 *
 * Applies the Drizzle migration journal to `DATABASE_URL` and exits. It is the
 * only path that mutates the schema: the API never migrates at startup, the
 * production stack runs this as the `migrate` service the API depends on, and
 * CI applies it to a fresh PostgreSQL before the integration tests.
 *
 * Runs with the runtime dependencies only (drizzle-orm + postgres), so it works
 * in the production image where drizzle-kit is not installed.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createDbClient } from './client'

export const MIGRATIONS_FOLDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../drizzle'
)

const log = (level: 'info' | 'error', msg: string, extra: Record<string, unknown> = {}) => {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'db-migrate',
    level,
    msg,
    ...extra,
  })
  if (level === 'error') {
    console.error(line)
  } else {
    console.log(line)
  }
}

export const runMigrations = async ({
  databaseUrl,
  migrationsFolder = MIGRATIONS_FOLDER,
}: {
  databaseUrl: string
  migrationsFolder?: string
}) => {
  const dbClient = createDbClient(databaseUrl)
  try {
    await migrate(dbClient.db, { migrationsFolder })
  } finally {
    await dbClient.close()
  }
}

const isDirectRun = () => {
  const entry = process.argv[1]
  return typeof entry === 'string' && path.resolve(entry) === fileURLToPath(import.meta.url)
}

if (isDirectRun()) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    log('error', 'db migrations aborted', { reason: 'DATABASE_URL is missing' })
    process.exit(2)
  }
  log('info', 'db migrations starting', { migrationsFolder: MIGRATIONS_FOLDER })
  try {
    await runMigrations({ databaseUrl })
    log('info', 'db migrations applied', { migrationsFolder: MIGRATIONS_FOLDER })
  } catch (error) {
    log('error', 'db migrations failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    process.exit(1)
  }
}
