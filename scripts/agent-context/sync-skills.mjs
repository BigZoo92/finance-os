#!/usr/bin/env node

/**
 * pnpm agent:skills:sync   — project canonical → all targets, write manifest
 * pnpm agent:skills:check  — CI: verify targets match manifest (exit 1 on drift)
 * pnpm agent:skills:watch  — dev: re-sync on canonical changes
 *
 * Architecture:
 *   .agentic/source/skills/       (single canonical source — edit ONLY here)
 *   .agentic/source/references/   (heavy reference files, shared, not projected by default)
 *   .agentic/manifests/           (SHA-256 hash manifest)
 *
 *   Projections (generated, never edit directly):
 *     → .claude/skills/       (Claude Code)
 *     → .agents/skills/       (Codex — flat finance-os-* names)
 *     → .qwen/skills/         (Qwen — selective subset)
 *     → skills/               (root Impeccable subset)
 *
 * No symlinks. Pure deterministic file copy + SHA-256 hash manifest.
 */

import {
  readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, cpSync,
} from 'node:fs'
import { join, relative, dirname, extname } from 'node:path'
import { createHash } from 'node:crypto'

const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')
const CANONICAL = join(ROOT, '.agentic/source/skills')
const REFERENCES = join(ROOT, '.agentic/source/references')
const MANIFEST_PATH = join(ROOT, '.agentic/manifests/skills-sync-manifest.json')

// Header injected at the top of every projected .md file
const GEN_HEADER_PREFIX = '<!-- GENERATED — DO NOT EDIT'
function generatedHeader(sourceRel, hash) {
  return [
    `<!-- GENERATED — DO NOT EDIT`,
    `     Source: .agentic/source/skills/${sourceRel}`,
    `     Hash:   sha256:${hash.slice(0, 16)}`,
    `     Sync:   pnpm agent:skills:sync -->`,
  ].join('\n')
}

// ────────────────────────────────────────────────────────────────────────────
// Target definitions
// ────────────────────────────────────────────────────────────────────────────

const TARGETS = [
  {
    name: '.claude/skills',
    dir: join(ROOT, '.claude/skills'),
    renameFn: (r) => r, // keep canonical structure
    // Include heavy references for color-expert (Claude has large context)
    injectReferences: {
      'color-expert': 'color-expert',
    },
  },
  {
    name: '.agents/skills',
    dir: join(ROOT, '.agents/skills'),
    renameFn(canonicalRel) {
      return canonicalRel
        .replace(/^finance-os\//, 'finance-os-')
        .replace(/^gitnexus\//, 'gitnexus/')
        .replace(/^generated\//, 'generated/')
    },
    excludePatterns: [
      /^empirical-prompt-tuning$/,
      /^review-skill$/,
      /^learn$/,
    ],
  },
  {
    name: '.qwen/skills',
    dir: join(ROOT, '.qwen/skills'),
    renameFn: (r) => r,
    includePatterns: [
      /^make-interfaces-feel-better$/,
    ],
  },
  {
    name: 'skills',
    dir: join(ROOT, 'skills'),
    renameFn: (r) => r,
    includePatterns: [
      /^adapt$/, /^animate$/, /^arrange$/, /^audit$/, /^bolder$/,
      /^clarify$/, /^colorize$/, /^critique$/, /^delight$/, /^distill$/,
      /^extract$/, /^frontend-design$/, /^harden$/, /^normalize$/,
      /^onboard$/, /^optimize$/, /^overdrive$/, /^polish$/, /^quieter$/,
      /^teach-impeccable$/, /^typeset$/,
    ],
  },
]

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function sha256Buf(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function walkFiles(dir, base = dir) {
  const results = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkFiles(abs, base))
    } else {
      results.push({ rel: relative(base, abs), abs })
    }
  }
  return results
}

function listCanonicalSkills() {
  const skills = []
  for (const entry of readdirSync(CANONICAL, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const subdir = join(CANONICAL, entry.name)
    const hasSkill = existsSync(join(subdir, 'SKILL.md')) || existsSync(join(subdir, 'AGENTS.md'))
    if (hasSkill) {
      skills.push({ name: entry.name, relPath: entry.name, absPath: subdir })
    } else {
      // Nested: finance-os/X, gitnexus/X, generated/X, experimental/X
      for (const nested of readdirSync(subdir, { withFileTypes: true })) {
        if (!nested.isDirectory()) continue
        const nestedDir = join(subdir, nested.name)
        const nestedHas = existsSync(join(nestedDir, 'SKILL.md')) || existsSync(join(nestedDir, 'AGENTS.md'))
        if (nestedHas) {
          skills.push({ name: nested.name, relPath: `${entry.name}/${nested.name}`, absPath: nestedDir })
        }
      }
    }
  }
  return skills
}

function shouldInclude(skill, target) {
  const topLevel = skill.relPath.split('/')[0]
  if (target.excludePatterns?.some(p => p.test(topLevel) || p.test(skill.relPath))) return false
  if (target.includePatterns) return target.includePatterns.some(p => p.test(topLevel) || p.test(skill.relPath))
  return true
}

// ────────────────────────────────────────────────────────────────────────────
// Sync one target
// ────────────────────────────────────────────────────────────────────────────

function syncTarget(target, canonicalSkills) {
  const actions = []
  const hashes = {}

  for (const skill of canonicalSkills) {
    if (!shouldInclude(skill, target)) continue

    const targetRelPath = target.renameFn(skill.relPath)
    const targetDir = join(target.dir, targetRelPath)
    const files = walkFiles(skill.absPath)

    for (const file of files) {
      const srcAbs = file.abs
      const srcRel = `${skill.relPath}/${file.rel}`
      const dstAbs = join(targetDir, file.rel)
      const dstRel = relative(ROOT, dstAbs)
      const isMd = extname(file.rel) === '.md'

      // Read source, compute hash on raw source
      const srcBuf = readFileSync(srcAbs)
      const srcHash = sha256Buf(srcBuf)

      // For .md files: prepend generated header
      let outputBuf
      if (isMd) {
        const header = generatedHeader(srcRel, srcHash)
        outputBuf = Buffer.from(header + '\n\n' + srcBuf.toString('utf-8'))
      } else {
        outputBuf = srcBuf
      }
      const outputHash = sha256Buf(outputBuf)

      let needsCopy = true
      if (existsSync(dstAbs)) {
        if (sha256File(dstAbs) === outputHash) {
          needsCopy = false
        }
      }

      // Manifest stores the OUTPUT hash (what the target file should be)
      hashes[dstRel] = outputHash

      if (needsCopy) {
        actions.push({ src: srcRel, dst: dstRel })
        mkdirSync(dirname(dstAbs), { recursive: true })
        writeFileSync(dstAbs, outputBuf)
      }
    }

    // Inject heavy references for this target if configured
    if (target.injectReferences?.[skill.name]) {
      const refName = target.injectReferences[skill.name]
      const refDir = join(REFERENCES, refName)
      if (existsSync(refDir)) {
        const refFiles = walkFiles(refDir)
        for (const file of refFiles) {
          const dstAbs = join(targetDir, 'references', file.rel)
          const dstRel = relative(ROOT, dstAbs)
          const srcBuf = readFileSync(file.abs)
          const outputHash = sha256Buf(srcBuf)

          let needsCopy = true
          if (existsSync(dstAbs)) {
            if (sha256File(dstAbs) === outputHash) needsCopy = false
          }
          hashes[dstRel] = outputHash
          if (needsCopy) {
            actions.push({ src: `references/${refName}/${file.rel}`, dst: dstRel })
            mkdirSync(dirname(dstAbs), { recursive: true })
            writeFileSync(dstAbs, srcBuf)
          }
        }
      }
    }
  }

  return { actions, hashes }
}

// ────────────────────────────────────────────────────────────────────────────
// Manifest
// ────────────────────────────────────────────────────────────────────────────

function writeManifest(allHashes) {
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true })
  const manifest = {
    version: 2,
    generatedAt: new Date().toISOString(),
    canonical: '.agentic/source/skills',
    references: '.agentic/source/references',
    targets: Object.keys(allHashes),
    fileCount: Object.values(allHashes).reduce((s, h) => s + Object.keys(h).length, 0),
    hashes: allHashes,
  }
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n')
  return manifest
}

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return null
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
}

// ────────────────────────────────────────────────────────────────────────────
// Commands
// ────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const command = args[0] || 'sync'

if (command === 'sync') {
  console.log('Syncing from .agentic/source/skills/ ...\n')
  const skills = listCanonicalSkills()
  console.log(`Canonical: ${skills.length} skills`)

  const allHashes = {}
  let totalCopied = 0

  for (const target of TARGETS) {
    const { actions, hashes } = syncTarget(target, skills)
    allHashes[target.name] = hashes
    totalCopied += actions.length
    const fileCount = Object.keys(hashes).length
    console.log(actions.length > 0
      ? `  ${target.name}: ${fileCount} files, ${actions.length} updated`
      : `  ${target.name}: ${fileCount} files, up to date`)
  }

  const manifest = writeManifest(allHashes)
  console.log(`\nManifest: ${manifest.fileCount} files across ${manifest.targets.length} targets`)
  console.log(`Written to: ${relative(ROOT, MANIFEST_PATH)}`)
  console.log(totalCopied > 0 ? `\n${totalCopied} file(s) written.` : '\nAll targets up to date.')

} else if (command === 'check') {
  const manifest = readManifest()
  if (!manifest) {
    console.error('No manifest found. Run `pnpm agent:skills:sync` first.')
    process.exit(1)
  }

  let drift = 0, missing = 0, ok = 0

  for (const [, targetHashes] of Object.entries(manifest.hashes)) {
    for (const [relPath, expectedHash] of Object.entries(targetHashes)) {
      const absPath = join(ROOT, relPath)
      if (!existsSync(absPath)) { console.error(`MISSING: ${relPath}`); missing++; continue }
      if (sha256File(absPath) !== expectedHash) { console.error(`DRIFT: ${relPath}`); drift++ }
      else ok++
    }
  }

  console.log(`\nSkills sync check: ${ok} ok, ${drift} drifted, ${missing} missing`)
  if (drift > 0 || missing > 0) {
    console.error('\nFAIL: targets do not match canonical. Run `pnpm agent:skills:sync` to fix.')
    process.exit(1)
  }
  console.log('PASS: all targets match canonical.')

} else if (command === 'watch') {
  const { watch } = await import('node:fs')
  console.log('Watching .agentic/source/skills/ for changes... (Ctrl+C to stop)\n')

  let debounce = null
  watch(CANONICAL, { recursive: true }, (event, filename) => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => {
      console.log(`[${new Date().toISOString().slice(11, 19)}] Change: ${filename} — re-syncing...`)
      const skills = listCanonicalSkills()
      const allHashes = {}
      let total = 0
      for (const target of TARGETS) {
        const { actions, hashes } = syncTarget(target, skills)
        allHashes[target.name] = hashes
        total += actions.length
      }
      writeManifest(allHashes)
      if (total > 0) console.log(`  ${total} file(s) synced.`)
    }, 300)
  })
  process.on('SIGINT', () => { console.log('\nStopped.'); process.exit(0) })
  setInterval(() => {}, 60000)

} else {
  console.log('Usage:')
  console.log('  pnpm agent:skills:sync   — project canonical → all targets + write manifest')
  console.log('  pnpm agent:skills:check  — CI: verify all targets match manifest')
  console.log('  pnpm agent:skills:watch  — dev: watch canonical + auto-sync')
  process.exit(1)
}
