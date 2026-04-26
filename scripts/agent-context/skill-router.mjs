#!/usr/bin/env node

/**
 * pnpm agent:context:select -- --domains=... uses this logic internally.
 * This standalone script provides detailed skill routing analysis.
 *
 * Usage: node scripts/agent-context/skill-router.mjs [--domain=DOMAIN] [--json] [--audit]
 */

import { buildSkillRegistry, TASK_DOMAINS } from './lib.mjs'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')
const args = process.argv.slice(2)
const domain = args.find(a => a.startsWith('--domain='))?.replace('--domain=', '') || null
const json = args.includes('--json')
const audit = args.includes('--audit')

const skills = buildSkillRegistry()

if (audit) {
  // Full audit mode: show all skills with classification
  console.log('# Skill Router Audit\n')

  const tierOrder = ['core', 'recommended', 'optional', 'experimental']
  for (const tier of tierOrder) {
    const tierSkills = skills.filter(s => s.tier === tier).sort((a, b) => b.tokens - a.tokens)
    if (tierSkills.length === 0) continue

    console.log(`## ${tier.toUpperCase()} (${tierSkills.length} skills, ${tierSkills.reduce((s, sk) => s + sk.tokens, 0).toLocaleString()} tokens)\n`)
    for (const skill of tierSkills) {
      const refNote = skill.refTokens > 0 ? ` (+${skill.refTokens.toLocaleString()} ref)` : ''
      console.log(`  ${skill.name}: ${skill.tokens.toLocaleString()} tokens${refNote} — domains: [${skill.domains.join(', ')}]`)
    }
    console.log()
  }

  // Overlap detection
  console.log('## Overlap Detection\n')
  const domainSkills = new Map()
  for (const skill of skills) {
    for (const d of skill.domains) {
      if (!domainSkills.has(d)) domainSkills.set(d, [])
      domainSkills.get(d).push(skill)
    }
  }
  for (const [d, sks] of domainSkills) {
    if (sks.length > 1) {
      const names = sks.map(s => `${s.name}(${s.tier})`).join(', ')
      console.log(`  ${d}: ${names}`)
    }
  }

  // Generate manifest
  const manifest = {
    generatedAt: new Date().toISOString(),
    totalSkills: skills.length,
    totalTokens: skills.reduce((s, sk) => s + sk.tokens, 0),
    totalRefTokens: skills.reduce((s, sk) => s + sk.refTokens, 0),
    byTier: {},
    taskDomains: TASK_DOMAINS,
    skills: skills.map(s => ({
      name: s.name,
      path: s.path,
      tier: s.tier,
      domains: s.domains,
      tokens: s.tokens,
      refTokens: s.refTokens,
    })),
  }
  for (const tier of tierOrder) {
    const tierSkills = skills.filter(s => s.tier === tier)
    manifest.byTier[tier] = {
      count: tierSkills.length,
      tokens: tierSkills.reduce((s, sk) => s + sk.tokens, 0),
    }
  }

  const manifestPath = join(ROOT, 'docs/agentic/skill-routing-manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`\nManifest written to: ${manifestPath}`)
  process.exit(0)
}

if (domain) {
  const mapping = TASK_DOMAINS[domain]
  if (!mapping) {
    console.error(`Unknown domain: ${domain}. Available: ${Object.keys(TASK_DOMAINS).join(', ')}`)
    process.exit(1)
  }

  const required = mapping.requiredSkills
  const optional = mapping.optionalSkills

  const resolvedRequired = []
  const resolvedOptional = []

  for (const skillName of required) {
    const found = skills.find(s => s.name === skillName || s.path.includes(skillName))
    if (found) resolvedRequired.push(found)
    else console.warn(`  WARNING: Required skill not found: ${skillName}`)
  }

  for (const skillName of optional) {
    const found = skills.find(s => s.name === skillName || s.path.includes(skillName))
    if (found) resolvedOptional.push(found)
  }

  if (json) {
    console.log(JSON.stringify({ domain, required: resolvedRequired, optional: resolvedOptional }, null, 2))
  } else {
    console.log(`Skills for domain: ${domain}\n`)
    console.log('Required:')
    for (const s of resolvedRequired) {
      console.log(`  [${s.tier}] ${s.name} — ${s.tokens.toLocaleString()} tokens`)
    }
    console.log('\nOptional:')
    for (const s of resolvedOptional) {
      console.log(`  [${s.tier}] ${s.name} — ${s.tokens.toLocaleString()} tokens`)
    }
    console.log(`\nTotal: ${(resolvedRequired.reduce((s, sk) => s + sk.tokens, 0) + resolvedOptional.reduce((s, sk) => s + sk.tokens, 0)).toLocaleString()} tokens`)
  }
} else {
  console.log('Available task domains:\n')
  for (const [name, mapping] of Object.entries(TASK_DOMAINS)) {
    console.log(`  ${name}:`)
    console.log(`    required: ${mapping.requiredSkills.join(', ')}`)
    if (mapping.optionalSkills.length > 0) {
      console.log(`    optional: ${mapping.optionalSkills.join(', ')}`)
    }
  }
  console.log('\nUse --domain=NAME to see resolved skills, --audit for full analysis')
}
