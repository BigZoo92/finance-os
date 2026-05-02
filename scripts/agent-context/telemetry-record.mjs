#!/usr/bin/env node

/**
 * pnpm agent:telemetry:record -- --task-id=ID --type=TYPE --model=MODEL [options]
 *
 * Records an agent task telemetry entry to JSONL file.
 */

import { mkdirSync, appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')
const DATA_DIR = join(ROOT, 'data/agentic-telemetry')

function parseArgs() {
  const args = process.argv.slice(2)
  const result = {}

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, ...valueParts] = arg.slice(2).split('=')
      const value = valueParts.join('=') || 'true'
      result[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value
    }
  }

  return result
}

const args = parseArgs()

if (!args.taskId || !args.type || !args.model) {
  console.error('Usage: pnpm agent:telemetry:record -- --task-id=ID --type=TYPE --model=MODEL [options]')
  console.error()
  console.error('Required:')
  console.error('  --task-id     Task identifier (e.g., batch-42-spec-3)')
  console.error('  --type        Task type: implement|review|debug|refactor|test|docs|batch|spec|improve')
  console.error('  --model       Model used: codex|claude|qwen|kimi|gemma|hermes')
  console.error()
  console.error('Optional:')
  console.error('  --effort      Reasoning effort: low|medium|high|xhigh (default: medium)')
  console.error('  --budget      Budget tier: small|medium|large|xlarge|autonomous (default: medium)')
  console.error('  --packs       Context packs (comma-separated)')
  console.error('  --skills      Skills loaded (comma-separated)')
  console.error('  --tokens-in   Estimated input tokens')
  console.error('  --tokens-out  Estimated output tokens')
  console.error('  --cost        Estimated cost USD')
  console.error('  --success     Task succeeded (default: true)')
  console.error('  --ci          CI result: pass|fail|skip')
  console.error('  --retries     Retry count (default: 0)')
  console.error('  --elapsed     Elapsed time in ms')
  console.error('  --degraded    Degraded reasons (comma-separated)')
  process.exit(1)
}

const record = {
  taskId: args.taskId,
  taskType: args.type,
  timestamp: new Date().toISOString(),
  model: args.model,
  reasoningEffort: args.effort || 'medium',
  contextPacks: args.packs ? args.packs.split(',') : [],
  skills: args.skills ? args.skills.split(',') : [],
  budgetTier: args.budget || 'medium',
  estimatedInputTokens: args.tokensIn ? Number(args.tokensIn) : null,
  estimatedOutputTokens: args.tokensOut ? Number(args.tokensOut) : null,
  actualInputTokens: null,
  actualOutputTokens: null,
  estimatedCostUsd: args.cost ? Number(args.cost) : null,
  actualCostUsd: null,
  cacheHitEstimate: null,
  success: args.success !== 'false',
  ciResult: args.ci || null,
  retryCount: args.retries ? Number(args.retries) : 0,
  degradedReasons: args.degraded ? args.degraded.split(',') : [],
  elapsedMs: args.elapsed ? Number(args.elapsed) : null,
  domain: 'agentic',
}

// Ensure data dir exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

// Ensure .gitignore for data dir
const gitignorePath = join(DATA_DIR, '.gitignore')
if (!existsSync(gitignorePath)) {
  appendFileSync(gitignorePath, '*.jsonl\n')
}

// Write to monthly JSONL file
const monthKey = new Date().toISOString().slice(0, 7)
const filePath = join(DATA_DIR, `${monthKey}.jsonl`)
appendFileSync(filePath, `${JSON.stringify(record)}\n`)

console.log(`Recorded telemetry for task ${record.taskId}:`)
console.log(`  Type: ${record.taskType}`)
console.log(`  Model: ${record.model}`)
console.log(`  Budget: ${record.budgetTier}`)
if (record.estimatedInputTokens) console.log(`  Est. input: ${record.estimatedInputTokens.toLocaleString()} tokens`)
if (record.estimatedCostUsd) console.log(`  Est. cost: $${record.estimatedCostUsd.toFixed(4)}`)
console.log(`  Written to: ${filePath}`)
