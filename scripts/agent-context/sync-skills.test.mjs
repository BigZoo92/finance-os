import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')
const MANIFEST_PATH = join(ROOT, '.agentic/manifests/skills-sync-manifest.json')
const CANONICAL = join(ROOT, '.agentic/source/skills')

describe('skills-sync-manifest.json', () => {
  it('exists at .agentic/manifests/', () => {
    assert.ok(existsSync(MANIFEST_PATH), 'Manifest not found — run pnpm agent:skills:sync')
  })

  it('is valid JSON v2 with .agentic canonical', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
    assert.equal(manifest.version, 2)
    assert.ok(manifest.generatedAt)
    assert.equal(manifest.canonical, '.agentic/source/skills')
    assert.equal(manifest.references, '.agentic/source/references')
    assert.ok(Array.isArray(manifest.targets))
    assert.ok(manifest.targets.length >= 4, 'Expected at least 4 targets')
    assert.ok(manifest.fileCount > 0)
    assert.ok(manifest.hashes)
  })

  it('covers all 4 targets', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
    for (const t of ['.claude/skills', '.agents/skills', '.qwen/skills', 'skills']) {
      assert.ok(manifest.hashes[t], `Missing target ${t} in manifest`)
    }
  })

  it('.claude/skills is the largest target', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
    const claude = Object.keys(manifest.hashes['.claude/skills']).length
    const agents = Object.keys(manifest.hashes['.agents/skills']).length
    assert.ok(claude >= agents, `.claude (${claude}) should be >= .agents (${agents})`)
  })
})

describe('generated headers', () => {
  it('.claude/skills/adapt/SKILL.md starts with GENERATED header', () => {
    const f = join(ROOT, '.claude/skills/adapt/SKILL.md')
    if (!existsSync(f)) return
    const content = readFileSync(f, 'utf-8')
    assert.ok(content.startsWith('<!-- GENERATED'), 'Missing generated header')
    assert.ok(content.includes('.agentic/source/skills/'), 'Header missing canonical source path')
    assert.ok(content.includes('sha256:'), 'Header missing hash')
  })

  it('.agents/skills/adapt/SKILL.md starts with GENERATED header', () => {
    const f = join(ROOT, '.agents/skills/adapt/SKILL.md')
    if (!existsSync(f)) return
    const content = readFileSync(f, 'utf-8')
    assert.ok(content.startsWith('<!-- GENERATED'), 'Missing generated header')
  })

  it('canonical source does NOT have generated header', () => {
    const f = join(CANONICAL, 'adapt/SKILL.md')
    if (!existsSync(f)) return
    const content = readFileSync(f, 'utf-8')
    assert.ok(!content.startsWith('<!-- GENERATED'), 'Canonical should not have generated header')
  })
})

describe('target integrity', () => {
  it('.agents finance-os-core-invariants maps to canonical finance-os/core-invariants', () => {
    const canonical = join(CANONICAL, 'finance-os/core-invariants/SKILL.md')
    const target = join(ROOT, '.agents/skills/finance-os-core-invariants/SKILL.md')
    if (!existsSync(canonical) || !existsSync(target)) return
    // Target has header, so content differs — just check target references canonical
    const content = readFileSync(target, 'utf-8')
    assert.ok(content.includes('finance-os/core-invariants/SKILL.md'))
  })

  it('all projected SKILL.md files have generated headers', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
    let checked = 0
    for (const [, targetHashes] of Object.entries(manifest.hashes)) {
      for (const relPath of Object.keys(targetHashes)) {
        if (!relPath.endsWith('SKILL.md') && !relPath.endsWith('AGENTS.md')) continue
        // Skip injected reference files (not from canonical skills dir)
        if (relPath.includes('/references/')) continue
        const abs = join(ROOT, relPath)
        if (!existsSync(abs)) continue
        const first = readFileSync(abs, 'utf-8').slice(0, 30)
        assert.ok(first.startsWith('<!-- GENERATED'), `${relPath} missing header`)
        checked++
        if (checked >= 20) return // spot check 20 files
      }
    }
  })
})

describe('sync check command', () => {
  it('exits 0 when targets are in sync', () => {
    const out = execSync('node scripts/agent-context/sync-skills.mjs check', {
      cwd: ROOT, encoding: 'utf-8',
    })
    assert.ok(out.includes('PASS'))
  })
})

describe('canonical completeness', () => {
  it('all codex-only skills exist in .agentic/source/skills/', () => {
    const codexOnly = [
      'api-contract-guard', 'code-change-verification', 'docs-sync',
      'dual-path-guard', 'implementation-strategy', 'powens-safety-review',
      'pr-summary', 'release-sanity', 'repo-recall',
      'test-coverage-improver', 'ui-change-quality',
    ]
    for (const skill of codexOnly) {
      const canonical = join(CANONICAL, skill, 'SKILL.md')
      assert.ok(existsSync(canonical), `${skill} missing from .agentic/source/skills/`)
    }
  })

  it('.agentic/source/skills has no generated headers (is true source)', () => {
    const f = join(CANONICAL, 'code-review/SKILL.md')
    if (!existsSync(f)) return
    const content = readFileSync(f, 'utf-8')
    assert.ok(!content.startsWith('<!-- GENERATED'), 'Canonical must not have generated markers')
  })
})
