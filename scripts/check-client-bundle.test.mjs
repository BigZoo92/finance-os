import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  checkClientBundle,
  FORBIDDEN_CLIENT_TOKENS,
  findForbiddenClientTokens,
} from './check-client-bundle.mjs'

test('findForbiddenClientTokens reports every server-only token with its file', () => {
  const findings = findForbiddenClientTokens([
    { path: 'a.js', content: 'const x = 1' },
    { path: 'b.js', content: 'import { createDbClient } from "@finance-os/db"; process.env.DATABASE_URL' },
  ])

  assert.deepEqual(
    findings.map(finding => [finding.path, finding.token]),
    [
      ['b.js', '@finance-os/db'],
      ['b.js', 'DATABASE_URL'],
    ]
  )
})

test('the denylist covers the secret-bearing environment names', () => {
  for (const token of [
    'AUTH_SESSION_SECRET',
    'APP_ENCRYPTION_KEY',
    'PRIVATE_ACCESS_TOKEN',
    'INTERNAL_SERVICE_TOKEN',
    'IBKR_FLEX_TOKEN',
    'BINANCE_SPOT_API_SECRET',
  ]) {
    assert.ok(FORBIDDEN_CLIENT_TOKENS.includes(token), `${token} must be denied`)
  }
})

test('checkClientBundle scans nested client files and passes a clean build', () => {
  const dir = mkdtempSync(join(tmpdir(), 'client-bundle-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'assets', 'main-abc.js'), 'export const ok = true')
  writeFileSync(join(dir, 'assets', 'chunk.mjs'), 'export const alsoOk = 1')

  const result = checkClientBundle(dir)
  assert.equal(result.fileCount, 2)
  assert.deepEqual(result.findings, [])
})

test('checkClientBundle fails when the build output is missing', () => {
  assert.throws(() => checkClientBundle(join(tmpdir(), 'does-not-exist-finance-os')), /not found/)
})
