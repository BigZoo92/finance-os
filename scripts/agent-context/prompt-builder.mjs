#!/usr/bin/env node

/**
 * pnpm agent:prompt:build -- --domains=DOMAIN[,DOMAIN] --budget=TIER --task="description"
 *
 * Builds a cache-optimized prompt with stable prefix + volatile suffix.
 * Outputs the prompt structure and cacheability metrics.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { selectContextForTask, estimateTokens, ROOT } from './lib.mjs'

function parseArgs() {
  const args = process.argv.slice(2)
  let domains = []
  let budgetTier = 'medium'
  let task = ''
  let format = 'text'

  for (const arg of args) {
    if (arg.startsWith('--domains=')) {
      domains = arg.replace('--domains=', '').split(',').filter(Boolean)
    } else if (arg.startsWith('--budget=')) {
      budgetTier = arg.replace('--budget=', '')
    } else if (arg.startsWith('--task=')) {
      task = arg.replace('--task=', '')
    } else if (arg === '--json') {
      format = 'json'
    } else if (arg === '--markdown') {
      format = 'markdown'
    }
  }

  if (domains.length === 0) {
    console.error('Usage: pnpm agent:prompt:build -- --domains=web-ui --budget=medium --task="description"')
    process.exit(1)
  }

  return { domains, budgetTier, task, format }
}

function readPack(name) {
  const path = join(ROOT, 'docs/agentic/context-packs', `${name}.md`)
  if (!existsSync(path)) return ''
  return readFileSync(path, 'utf-8')
}

function readSkill(skillPath) {
  const abs = join(ROOT, skillPath)
  if (!existsSync(abs)) return ''
  return readFileSync(abs, 'utf-8')
}

const { domains, budgetTier, task, format } = parseArgs()
const selection = selectContextForTask({ domains, budgetTier })

// Build stable prefix
const stableParts = []

// 1. System role
stableParts.push(`You are an expert software engineer working on Finance-OS, a personal single-user finance cockpit.
Follow the invariants and conventions below precisely.`)

// 2. Core context pack (always)
const corePack = readPack('core')
if (corePack) stableParts.push(corePack)

// 3. Domain context packs
const domainPackMap = {
  'web-ui': 'web-ui',
  'tanstack': 'web-ui',
  'api-backend': 'api-backend',
  'worker-sync': 'worker-sync',
  'ai-advisor': 'ai-advisor',
  'knowledge-graph': 'knowledge-graph',
  'docker-deploy': 'deploy-ci',
  'ci-cd': 'deploy-ci',
  'design-polish': 'design-system',
  'testing': 'testing',
  'security': 'security',
  'agentic-autopilot': 'autopilot',
}

const loadedPacks = new Set(['core'])
for (const domain of domains) {
  const packName = domainPackMap[domain]
  if (packName && !loadedPacks.has(packName)) {
    const pack = readPack(packName)
    if (pack) {
      stableParts.push(pack)
      loadedPacks.add(packName)
    }
  }
}

// 4. Selected skills (sorted alphabetically for cache stability)
const sortedSkills = [...selection.skills].sort((a, b) => a.name.localeCompare(b.name))
for (const skill of sortedSkills) {
  const content = readSkill(skill.mainFile)
  if (content) {
    stableParts.push(`--- SKILL: ${skill.name} (${skill.tier}) ---\n${content}`)
  }
}

const stablePrefix = stableParts.join('\n\n')
const stableTokens = estimateTokens(stablePrefix)

// Build volatile suffix
const volatileParts = []

if (task) {
  volatileParts.push(`## Task\n\n${task}`)
}

volatileParts.push(`## Output Contract\n
- Respond with concrete code changes, not theoretical advice.
- Follow existing code style and conventions.
- Respect demo/admin dual-path.
- Do not expose secrets in VITE_*.
- Do not log PII or tokens.`)

const volatileSuffix = volatileParts.join('\n\n')
const volatileTokens = estimateTokens(volatileSuffix)
const totalTokens = stableTokens + volatileTokens
const cacheability = totalTokens > 0 ? stableTokens / totalTokens : 0

if (format === 'json') {
  console.log(JSON.stringify({
    domains,
    budgetTier,
    budget: selection.budgetTokens,
    stableTokens,
    volatileTokens,
    totalTokens,
    cacheability: Math.round(cacheability * 100) / 100,
    loadedPacks: [...loadedPacks],
    loadedSkills: sortedSkills.map(s => s.name),
    warnings: selection.warnings,
  }, null, 2))
} else if (format === 'markdown') {
  console.log(stablePrefix)
  console.log('\n---\n')
  console.log(volatileSuffix)
} else {
  console.log('Prompt Structure')
  console.log('================\n')
  console.log(`Domains: ${domains.join(', ')}`)
  console.log(`Budget: ${budgetTier} (${selection.budgetTokens.toLocaleString()} tokens)`)
  console.log()
  console.log('Stable Prefix:')
  console.log(`  System role: ~100 tokens`)
  console.log(`  Context packs: ${[...loadedPacks].join(', ')}`)
  console.log(`  Skills: ${sortedSkills.map(s => s.name).join(', ')}`)
  console.log(`  Total stable: ${stableTokens.toLocaleString()} tokens`)
  console.log()
  console.log('Volatile Suffix:')
  console.log(`  Task: ${task || '(none)'}`)
  console.log(`  Output contract: ~100 tokens`)
  console.log(`  Total volatile: ${volatileTokens.toLocaleString()} tokens`)
  console.log()
  console.log(`Total: ${totalTokens.toLocaleString()} tokens`)
  console.log(`Cacheability: ${(cacheability * 100).toFixed(0)}%`)
  console.log()

  if (cacheability > 0.5) {
    console.log('Rating: GOOD — most of the prompt is cacheable')
  } else if (cacheability > 0.3) {
    console.log('Rating: FAIR — consider moving more content to stable prefix')
  } else {
    console.log('Rating: POOR — large task payload limits cache savings')
  }
}
