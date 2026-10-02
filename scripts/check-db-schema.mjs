#!/usr/bin/env node
/**
 * Schema compatibility check (no database needed):
 *
 * 1. `drizzle-kit check` validates the migration journal and snapshots.
 * 2. A drift probe runs `drizzle-kit generate` against a throwaway copy of the
 *    migrations folder; if the Drizzle schema differs from the last snapshot a
 *    new migration file appears in the copy and the check fails, telling the
 *    author to run `pnpm db:generate` and commit the result.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const repoRoot = process.cwd()
const dbDir = path.join(repoRoot, 'packages/db')
const migrationsDir = path.join(dbDir, 'drizzle')
// drizzle-kit requires a DATABASE_URL in its config even for offline commands.
const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://schema-check:offline@127.0.0.1:1/offline',
}

const runDrizzleKit = (args, extraEnv = {}) =>
  spawnSync('pnpm', ['exec', 'drizzle-kit', ...args], {
    cwd: dbDir,
    env: { ...env, ...extraEnv },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const listMigrations = dir =>
  readdirSync(dir)
    .filter(name => name.endsWith('.sql'))
    .sort()

const fail = message => {
  console.error(`Database schema check failed: ${message}`)
  process.exit(1)
}

const check = runDrizzleKit(['check', '--config=drizzle.config.cjs'])
if (check.status !== 0) {
  fail(`drizzle-kit check reported problems\n${check.stdout}${check.stderr}`)
}

const probeRoot = mkdtempSync(path.join(tmpdir(), 'finance-os-schema-'))
try {
  const probeMigrations = path.join(probeRoot, 'drizzle')
  cpSync(migrationsDir, probeMigrations, { recursive: true })
  const probeConfig = path.join(probeRoot, 'drizzle.config.cjs')
  writeFileSync(
    probeConfig,
    [
      "const { defineConfig } = require('drizzle-kit')",
      'module.exports = defineConfig({',
      "  dialect: 'postgresql',",
      `  schema: ${JSON.stringify(path.join(dbDir, 'src/schema/index.ts'))},`,
      `  out: ${JSON.stringify(probeMigrations)},`,
      `  dbCredentials: { url: ${JSON.stringify(env.DATABASE_URL)} },`,
      '  strict: true,',
      '})',
      '',
    ].join('\n')
  )

  const before = listMigrations(probeMigrations)
  const generate = runDrizzleKit(['generate', `--config=${probeConfig}`, '--name', 'drift-probe'])
  const after = listMigrations(probeMigrations)
  const created = after.filter(name => !before.includes(name))

  if (generate.status !== 0 && created.length === 0) {
    // Interactive prompts (renames/drops) also mean the schema diverged.
    fail(
      `drizzle-kit generate could not reconcile the schema\n${generate.stdout}${generate.stderr}`
    )
  }
  if (created.length > 0) {
    fail(
      `the Drizzle schema differs from the last migration snapshot (${created.join(', ')}). ` +
        'Run `pnpm db:generate`, review the migration, and commit it with the journal.'
    )
  }
} finally {
  rmSync(probeRoot, { recursive: true, force: true })
}

console.log(
  `Database schema check passed (${listMigrations(migrationsDir).length} migrations, no drift).`
)
