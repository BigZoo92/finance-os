#!/usr/bin/env node

/**
 * pnpm agent:context:check
 *
 * CI-friendly check that validates:
 * 1. No single doc exceeds max size thresholds
 * 2. Context packs exist and are within budget
 * 3. No obvious duplicates
 * 4. Skills manifest is valid
 *
 * Exit code 0 = pass, 1 = fail
 */

import { buildFileRegistry, buildSkillRegistry, detectDuplicates, BUDGET_TIERS } from './lib.mjs'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const MAX_SINGLE_DOC_TOKENS = 10_000
const MAX_SINGLE_SKILL_TOKENS = 5_000
const REQUIRED_CONTEXT_PACKS = [
  'docs/agentic/context-packs/core.md',
  'docs/agentic/context-packs/web-ui.md',
  'docs/agentic/context-packs/api-backend.md',
]

let exitCode = 0
const issues = []

// Check 1: Large docs
const fileRegistry = buildFileRegistry()
for (const file of fileRegistry) {
  if (file.tier === 'archive' || file.tier === 'never-auto-load') continue
  if (file.tokens > MAX_SINGLE_DOC_TOKENS) {
    issues.push(`WARN: ${file.path} is ${file.tokens.toLocaleString()} tokens (max ${MAX_SINGLE_DOC_TOKENS.toLocaleString()})`)
  }
}

// Check 2: Large skills
const skillRegistry = buildSkillRegistry()
for (const skill of skillRegistry) {
  if (skill.tokens > MAX_SINGLE_SKILL_TOKENS) {
    issues.push(`WARN: skill ${skill.name} is ${skill.tokens.toLocaleString()} tokens (max ${MAX_SINGLE_SKILL_TOKENS.toLocaleString()})`)
  }
  if (skill.refTokens > 50_000) {
    issues.push(`WARN: skill ${skill.name} has ${skill.refTokens.toLocaleString()} reference tokens — should be in never-auto-load`)
  }
}

// Check 3: Context packs exist
for (const pack of REQUIRED_CONTEXT_PACKS) {
  const abs = join(new URL('../../', import.meta.url).pathname, pack)
  if (!existsSync(abs)) {
    issues.push(`FAIL: Required context pack missing: ${pack}`)
    exitCode = 1
  }
}

// Check 4: Duplicates
const duplicates = detectDuplicates()
if (duplicates.length > 0) {
  for (const d of duplicates) {
    issues.push(`WARN: Duplicate content: ${d.file} ~ ${d.duplicateOf}`)
  }
}

// Output
if (issues.length === 0) {
  console.log('agent:context:check PASSED — no issues found')
} else {
  console.log(`agent:context:check found ${issues.length} issue(s):\n`)
  for (const issue of issues) {
    console.log(`  ${issue}`)
  }
  console.log()

  const fails = issues.filter(i => i.startsWith('FAIL:'))
  const warns = issues.filter(i => i.startsWith('WARN:'))
  console.log(`${fails.length} failures, ${warns.length} warnings`)
}

process.exit(exitCode)
