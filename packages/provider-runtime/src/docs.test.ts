// Pin the canonical provider guide to the invariants enforced by the runtime.

import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..')
const GUIDE = join(repoRoot, 'docs', 'integrations.md')

describe('provider docs', () => {
  it('keeps one canonical integration guide', () => {
    expect(existsSync(GUIDE)).toBe(true)
  })

  it('keeps provider safety invariants explicit', () => {
    const body = readFileSync(GUIDE, 'utf8').toLowerCase()
    for (const invariant of [
      'demo',
      'admin',
      'read-only',
      'redact',
      'raw payload',
      'forbidden capabilities',
    ]) {
      expect(body).toContain(invariant)
    }
  })
})
