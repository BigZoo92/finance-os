#!/usr/bin/env node
// Client bundle denylist: the browser build of apps/web must never contain
// server-only modules, environment names, or secret-bearing identifiers.
// Runs after `pnpm web:build` and fails on the first forbidden token.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DEFAULT_CLIENT_DIR = join(REPO_ROOT, 'apps', 'web', '.output', 'public')

/**
 * Tokens that identify server-only code or secrets. Each entry is a literal
 * substring searched in every client JavaScript file.
 */
export const FORBIDDEN_CLIENT_TOKENS = [
  // Server-only workspace packages.
  '@finance-os/db',
  '@finance-os/env',
  '@finance-os/powens',
  '@finance-os/external-investments',
  '@finance-os/provider-runtime',
  '@finance-os/redis',
  // Server-only libraries.
  'drizzle-orm',
  'postgres-js',
  'node:crypto',
  'node:fs',
  // Server environment names and secret identifiers.
  'DATABASE_URL',
  'REDIS_URL',
  'PRIVATE_ACCESS_TOKEN',
  'API_INTERNAL_TOKEN',
  'INTERNAL_SERVICE_TOKEN',
  'AUTH_SESSION_SECRET',
  'AUTH_ADMIN_PASSWORD_HASH',
  'AUTH_PASSWORD_HASH',
  'APP_ENCRYPTION_KEY',
  'POWENS_CLIENT_SECRET',
  'BINANCE_SPOT_API_SECRET',
  'BINANCE_SPOT_API_KEY',
  'IBKR_FLEX_TOKEN',
  'IBKR_FLEX_QUERY_IDS',
  'AI_OPENAI_API_KEY',
  'AI_ANTHROPIC_API_KEY',
  'NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN',
]

const listJavaScriptFiles = directory => {
  const files = []
  const walk = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (/\.(m?js)$/.test(entry.name)) {
        files.push(fullPath)
      }
    }
  }
  walk(directory)
  return files.sort()
}

/**
 * Returns every forbidden token found in the given client source texts.
 * Exported so the scanner is unit-testable without a build.
 */
export const findForbiddenClientTokens = (sources, tokens = FORBIDDEN_CLIENT_TOKENS) => {
  const findings = []
  for (const { path, content } of sources) {
    for (const token of tokens) {
      const index = content.indexOf(token)
      if (index !== -1) {
        findings.push({ path, token, offset: index })
      }
    }
  }
  return findings
}

export const checkClientBundle = (clientDir = DEFAULT_CLIENT_DIR) => {
  let stats
  try {
    stats = statSync(clientDir)
  } catch {
    throw new Error(`Client build output not found: ${clientDir} (run pnpm web:build first)`)
  }
  if (!stats.isDirectory()) {
    throw new Error(`Client build output is not a directory: ${clientDir}`)
  }

  const files = listJavaScriptFiles(clientDir)
  if (files.length === 0) {
    throw new Error(`No client JavaScript found under ${clientDir}`)
  }

  const sources = files.map(path => ({
    path: relative(REPO_ROOT, path),
    content: readFileSync(path, 'utf8'),
  }))
  return { fileCount: files.length, findings: findForbiddenClientTokens(sources) }
}

const main = () => {
  const dirArg = process.argv.find(arg => arg.startsWith('--dir='))
  const clientDir = dirArg ? resolve(REPO_ROOT, dirArg.slice('--dir='.length)) : DEFAULT_CLIENT_DIR
  const { fileCount, findings } = checkClientBundle(clientDir)

  if (findings.length > 0) {
    console.error(
      `Client bundle denylist failed (${findings.length} finding(s) in ${fileCount} files):`
    )
    for (const finding of findings) {
      console.error(`- ${finding.path}: contains "${finding.token}" at offset ${finding.offset}`)
    }
    process.exitCode = 1
    return
  }

  console.log(`Client bundle denylist passed: ${fileCount} client files, 0 forbidden tokens.`)
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
