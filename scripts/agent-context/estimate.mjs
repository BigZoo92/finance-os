#!/usr/bin/env node

/**
 * pnpm agent:context:estimate [file...]
 *
 * Estimates token count for one or more files.
 * If no files given, estimates all agent-relevant docs.
 */

import { estimateFileTokens, estimateFileLines, buildFileRegistry } from './lib.mjs'

const args = process.argv.slice(2)

if (args.length > 0) {
  let total = 0
  for (const file of args) {
    const tokens = estimateFileTokens(file)
    const lines = estimateFileLines(file)
    console.log(`${file}: ${tokens.toLocaleString()} tokens (${lines} lines)`)
    total += tokens
  }
  if (args.length > 1) {
    console.log(`\nTotal: ${total.toLocaleString()} tokens`)
  }
} else {
  const registry = buildFileRegistry()
  let total = 0
  for (const file of registry.sort((a, b) => b.tokens - a.tokens)) {
    console.log(`[${file.tier}] ${file.path}: ${file.tokens.toLocaleString()} tokens`)
    total += file.tokens
  }
  console.log(`\nTotal agent-relevant docs: ${total.toLocaleString()} tokens`)
}
