// PR17E — Docs sanity tests.
//
// Pin the provider docs to the invariants the runtime is built to enforce, so the docs
// cannot silently drop a required line.

import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..')
const README = join(repoRoot, 'docs', 'providers', 'README.md')
const TEMPLATE = join(repoRoot, 'docs', 'providers', '_template.md')

describe('provider docs', () => {
  it('README and template both exist', () => {
    expect(existsSync(README)).toBe(true)
    expect(existsSync(TEMPLATE)).toBe(true)
  })

  it('README mentions the safety invariants', () => {
    const body = readFileSync(README, 'utf8').toLowerCase()
    expect(body).toContain('demo')
    expect(body).toContain('admin')
    expect(body).toContain('no raw payload')
    expect(body).toContain('redact')
    expect(body).toContain('read-only')
  })

  it('template covers every required section', () => {
    const body = readFileSync(TEMPLATE, 'utf8')
    for (const heading of [
      'Provider id',
      'Capabilities',
      'Mode behavior',
      'Credentials',
      'Cache / freshness',
      'Error mapping',
      'Redaction notes',
      'Health check',
      'Tests',
      'Known limitations',
      'ToS / legal notes',
      'No execution guarantee',
    ]) {
      expect(body).toContain(heading)
    }
  })
})
