/**
 * PostgreSQL harness: applies the full migration journal to a real database
 * and checks the schema facts the product relies on. Runs only when
 * TEST_DATABASE_URL points at a disposable PostgreSQL (CI service, or the
 * local `infra/docker/docker-compose.dev.yml` instance); skipped otherwise.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createDbClient } from './client'
import { MIGRATIONS_FOLDER, runMigrations } from './migrate'

const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('migration journal against PostgreSQL', () => {
  it('applies every migration and leaves the documented schema', async () => {
    if (!databaseUrl) return
    await runMigrations({ databaseUrl })

    const journal = JSON.parse(
      readFileSync(path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')
    ) as { entries: Array<{ tag: string }> }

    const client = createDbClient(databaseUrl)
    try {
      const applied = await client.sql<{ count: string }[]>`
        select count(*)::text as count from drizzle.__drizzle_migrations
      `
      expect(Number(applied[0]?.count)).toBe(journal.entries.length)

      const columns = await client.sql<{ column_name: string; is_nullable: string }[]>`
        select column_name, is_nullable
        from information_schema.columns
        where table_name = 'asset_valuation_snapshot' and column_name in ('value_base', 'price')
      `
      expect(columns.map(column => [column.column_name, column.is_nullable]).sort()).toEqual([
        ['price', 'YES'],
        ['value_base', 'YES'],
      ])

      const legacy = await client.sql<{ exists: boolean }[]>`
        select exists (
          select 1 from information_schema.tables where table_name = 'external_investment_credential'
        ) as exists
      `
      expect(legacy[0]?.exists).toBe(false)
    } finally {
      await client.close()
    }
  })
})
