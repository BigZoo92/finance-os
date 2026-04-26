#!/usr/bin/env node

/**
 * pnpm agent:context:select -- --domains=web-ui,tanstack --budget=medium
 *
 * Selects relevant docs and skills for a task, respecting budget constraints.
 * Outputs a manifest showing what was selected and why.
 */

import { selectContextForTask, BUDGET_TIERS, TASK_DOMAINS } from './lib.mjs'

function parseArgs() {
  const args = process.argv.slice(2)
  let domains = []
  let budgetTier = 'medium'
  let format = 'text'

  for (const arg of args) {
    if (arg.startsWith('--domains=')) {
      domains = arg.replace('--domains=', '').split(',').filter(Boolean)
    } else if (arg.startsWith('--budget=')) {
      budgetTier = arg.replace('--budget=', '')
    } else if (arg === '--json') {
      format = 'json'
    } else if (arg === '--help') {
      console.log(`Usage: pnpm agent:context:select -- --domains=DOMAIN[,DOMAIN...] --budget=TIER [--json]`)
      console.log(`\nBudget tiers: ${Object.entries(BUDGET_TIERS).map(([k,v]) => `${k} (${v.toLocaleString()})`).join(', ')}`)
      console.log(`\nDomains: ${Object.keys(TASK_DOMAINS).join(', ')}`)
      process.exit(0)
    }
  }

  if (domains.length === 0) {
    console.error('Error: --domains is required. Use --help for available domains.')
    process.exit(1)
  }

  return { domains, budgetTier, format }
}

const { domains, budgetTier, format } = parseArgs()
const result = selectContextForTask({ domains, budgetTier })

if (format === 'json') {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(`Context Selection for: ${domains.join(', ')}`)
  console.log(`Budget: ${budgetTier} (${result.budgetTokens.toLocaleString()} tokens)`)
  console.log(`Used: ${result.usedTokens.toLocaleString()} tokens (${result.utilization}%)`)
  console.log(`Remaining: ${result.remainingTokens.toLocaleString()} tokens`)
  console.log()

  if (result.warnings.length > 0) {
    console.log('WARNINGS:')
    for (const w of result.warnings) console.log(`  - ${w}`)
    console.log()
  }

  console.log('Selected Documents:')
  for (const doc of result.docs) {
    console.log(`  [${doc.tier}] ${doc.path} (${doc.tokens.toLocaleString()} tokens)`)
  }
  console.log()

  console.log('Selected Skills:')
  for (const skill of result.skills) {
    const tag = skill.required ? 'required' : 'optional'
    console.log(`  [${skill.tier}/${tag}] ${skill.name} (${skill.tokens.toLocaleString()} tokens)`)
  }
}
