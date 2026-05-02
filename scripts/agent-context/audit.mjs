#!/usr/bin/env node

/**
 * pnpm agent:context:audit
 *
 * Audits all agent-relevant documentation for size, duplication, and staleness.
 * Outputs both human-readable report and machine-readable JSON.
 */

import { buildFileRegistry, buildSkillRegistry, detectDuplicates, ROOT } from './lib.mjs'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const fileRegistry = buildFileRegistry()
const skillRegistry = buildSkillRegistry()
const duplicates = detectDuplicates()

// Sort by tokens descending
const sortedFiles = [...fileRegistry].sort((a, b) => b.tokens - a.tokens)
const sortedSkills = [...skillRegistry].sort((a, b) => b.tokens - a.tokens)

const totalDocTokens = sortedFiles.reduce((sum, f) => sum + f.tokens, 0)
const totalSkillTokens = sortedSkills.reduce((sum, s) => sum + s.tokens, 0)
const totalRefTokens = sortedSkills.reduce((sum, s) => sum + s.refTokens, 0)

// Build report
const lines = [
  '# Agent Context Audit Report',
  '',
  `Generated: ${new Date().toISOString().slice(0, 10)}`,
  '',
  '## Summary',
  '',
  `| Metric | Value |`,
  `|---|---|`,
  `| Total doc files | ${sortedFiles.length} |`,
  `| Total doc tokens | ${totalDocTokens.toLocaleString()} |`,
  `| Total skills | ${sortedSkills.length} |`,
  `| Total skill tokens (main files) | ${totalSkillTokens.toLocaleString()} |`,
  `| Total skill reference tokens | ${totalRefTokens.toLocaleString()} |`,
  `| Duplicates detected | ${duplicates.length} |`,
  '',
  '## Top 20 Largest Documents',
  '',
  '| File | Tier | Tokens |',
  '|---|---|---|',
  ...sortedFiles.slice(0, 20).map(f => `| ${f.path} | ${f.tier} | ${f.tokens.toLocaleString()} |`),
  '',
  '## Top 20 Largest Skills',
  '',
  '| Skill | Tier | Main Tokens | Ref Tokens |',
  '|---|---|---|---|',
  ...sortedSkills.slice(0, 20).map(s => `| ${s.name} | ${s.tier} | ${s.tokens.toLocaleString()} | ${s.refTokens.toLocaleString()} |`),
  '',
  '## Tier Distribution (Docs)',
  '',
  '| Tier | Count | Tokens |',
  '|---|---|---|',
]

const tierGroups = {}
for (const f of sortedFiles) {
  if (!tierGroups[f.tier]) tierGroups[f.tier] = { count: 0, tokens: 0 }
  tierGroups[f.tier].count++
  tierGroups[f.tier].tokens += f.tokens
}
for (const [tier, data] of Object.entries(tierGroups)) {
  lines.push(`| ${tier} | ${data.count} | ${data.tokens.toLocaleString()} |`)
}

lines.push('')
lines.push('## Tier Distribution (Skills)')
lines.push('')
lines.push('| Tier | Count | Tokens |')
lines.push('|---|---|---|')

const skillTierGroups = {}
for (const s of sortedSkills) {
  if (!skillTierGroups[s.tier]) skillTierGroups[s.tier] = { count: 0, tokens: 0 }
  skillTierGroups[s.tier].count++
  skillTierGroups[s.tier].tokens += s.tokens
}
for (const [tier, data] of Object.entries(skillTierGroups)) {
  lines.push(`| ${tier} | ${data.count} | ${data.tokens.toLocaleString()} |`)
}

if (duplicates.length > 0) {
  lines.push('')
  lines.push('## Duplicates Detected')
  lines.push('')
  for (const d of duplicates) {
    lines.push(`- \`${d.file}\` duplicates \`${d.duplicateOf}\``)
  }
}

const report = lines.join('\n')
console.log(report)

// Write machine-readable manifest
const manifest = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalDocFiles: sortedFiles.length,
    totalDocTokens,
    totalSkills: sortedSkills.length,
    totalSkillTokens,
    totalRefTokens,
    duplicateCount: duplicates.length,
  },
  files: sortedFiles,
  skills: sortedSkills,
  duplicates,
  tierDistribution: {
    docs: tierGroups,
    skills: skillTierGroups,
  },
}

const manifestPath = join(ROOT, 'docs/agentic/context-audit-manifest.json')
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
console.log(`\nManifest written to: ${manifestPath}`)
