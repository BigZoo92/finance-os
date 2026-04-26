#!/usr/bin/env node

/**
 * pnpm agent:context:pack
 *
 * Generates compact context packs for each task domain.
 * Each pack is a self-contained markdown file suitable for prompt prefixes.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { estimateTokens, ROOT } from './lib.mjs'

const PACKS_DIR = join(ROOT, 'docs/agentic/context-packs')

function readIfExists(relPath) {
  const abs = join(ROOT, relPath)
  if (!existsSync(abs)) return ''
  return readFileSync(abs, 'utf-8')
}

function extractSection(content, heading) {
  const lines = content.split('\n')
  const startIdx = lines.findIndex(l => l.trim().startsWith(`## ${heading}`) || l.trim().startsWith(`# ${heading}`))
  if (startIdx === -1) return ''
  const collected = []
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].match(/^#{1,2}\s/) && i > startIdx + 1) break
    collected.push(lines[i])
  }
  return collected.join('\n').trim()
}

function writePack(name, content) {
  const tokens = estimateTokens(content)
  const path = join(PACKS_DIR, `${name}.md`)
  writeFileSync(path, content)
  console.log(`  ${name}.md: ${tokens.toLocaleString()} tokens`)
  return { name, path: `docs/agentic/context-packs/${name}.md`, tokens }
}

const packs = []

console.log('Generating context packs...\n')

// --- CORE PACK ---
const agentsMd = readIfExists('AGENTS.md')
const globalInvariants = extractSection(agentsMd, 'Global Invariants')
const globalVerification = extractSection(agentsMd, 'Global Verification')
const globalReview = extractSection(agentsMd, 'Global Review')

packs.push(writePack('core', `# Core Context Pack — Finance-OS

> Auto-generated. Source: AGENTS.md
> Do not edit directly — regenerate with \`pnpm agent:context:pack\`

## Global Invariants

${globalInvariants}

## Verification

${globalVerification}

## Review Severity

${globalReview}

## Key Rules

- Single-user finance cockpit, no multi-tenancy
- demo/admin dual-path mandatory
- \`exactOptionalPropertyTypes\` enabled
- No secrets in VITE_*, no PII logging
- Fail-soft on all integrations
- Public traffic via apps/web only
`))

// --- WEB-UI PACK ---
const designMd = readIfExists('DESIGN.md')
const webAgentsMd = readIfExists('apps/web/AGENTS.md')
const designDirection = readIfExists('docs/context/DESIGN-DIRECTION.md')

packs.push(writePack('web-ui', `# Web UI Context Pack — Finance-OS

> Auto-generated. Sources: DESIGN.md, apps/web/AGENTS.md, docs/context/DESIGN-DIRECTION.md
> Do not edit directly — regenerate with \`pnpm agent:context:pack\`

## Design System

${designMd}

## Web App Rules

${webAgentsMd ? webAgentsMd.substring(0, 3000) : 'See apps/web/AGENTS.md'}

## Design Direction

${designDirection ? designDirection.substring(0, 2000) : 'See docs/context/DESIGN-DIRECTION.md'}

## Key Constraints

- Aurora Pink brand identity (rose magenta primary, electric violet accent-2)
- Inter + JetBrains Mono typography
- 4-step surface depth system (surface-0/1/2/3)
- Financial amounts use .font-financial class
- Semantic color tokens for financial data (positive/negative/warning)
- Mobile-responsive, prefers-reduced-motion
- Do not touch the Liquid Ether hero on the cockpit page
`))

// --- API BACKEND PACK ---
const apiAgentsMd = readIfExists('apps/api/AGENTS.md')
const conventions = readIfExists('docs/context/CONVENTIONS.md')

packs.push(writePack('api-backend', `# API Backend Context Pack — Finance-OS

> Auto-generated. Sources: apps/api/AGENTS.md, docs/context/CONVENTIONS.md
> Do not edit directly — regenerate with \`pnpm agent:context:pack\`

## API Rules

${apiAgentsMd ? apiAgentsMd.substring(0, 3000) : 'See apps/api/AGENTS.md'}

## Conventions

${conventions ? conventions.substring(0, 3000) : 'See docs/context/CONVENTIONS.md'}

## Key Constraints

- Bun + Elysia runtime
- Structured logging, secret-safe
- x-request-id propagation
- demo/admin dual-path
- Public traffic proxied from apps/web, not directly exposed
`))

// --- WORKER SYNC PACK ---
const workerAgentsMd = readIfExists('apps/worker/AGENTS.md')

packs.push(writePack('worker-sync', `# Worker Sync Context Pack — Finance-OS

> Auto-generated. Sources: apps/worker/AGENTS.md, packages/redis/AGENTS.md
> Do not edit directly — regenerate with \`pnpm agent:context:pack\`

## Worker Rules

${workerAgentsMd ? workerAgentsMd.substring(0, 2000) : 'See apps/worker/AGENTS.md'}

## Key Constraints

- Bun runtime
- Redis-based job queue
- Powens sync jobs
- Batch upsert patterns
- Fail-soft on provider errors
`))

// --- AI ADVISOR PACK ---
const aiSetup = readIfExists('docs/AI-SETUP.md')

packs.push(writePack('ai-advisor', `# AI Advisor Context Pack — Finance-OS

> Auto-generated. Source: docs/AI-SETUP.md, packages/ai/
> Do not edit directly — regenerate with \`pnpm agent:context:pack\`

## AI Advisor Architecture

${aiSetup ? aiSetup.substring(0, 3000) : 'See docs/AI-SETUP.md'}

## Key Constraints

- AI Advisor is NOT the agentic development pipeline
- Deterministic finance-engine outputs first, LLM enriches/explains/challenges
- Budget policy: daily + monthly caps, challenger and deep-analysis gates
- Pricing registry in packages/ai/src/pricing/registry.ts
- Cost ledger tracks per-model, per-feature usage in PostgreSQL
- Knowledge graph context enriches recommendations (not source of truth)
- Never enable trading execution
`))

// --- KNOWLEDGE GRAPH PACK ---
const kgAdr = readIfExists('docs/adr/temporal-knowledge-graph-graphrag.md')

packs.push(writePack('knowledge-graph', `# Knowledge Graph Context Pack — Finance-OS

> Auto-generated. Source: docs/adr/temporal-knowledge-graph-graphrag.md
> Do not edit directly — regenerate with \`pnpm agent:context:pack\`

## Architecture Summary

The Temporal Knowledge Graph / GraphRAG layer provides AI Advisor memory:
- Neo4j for entity relationships + temporal validity
- Qdrant for semantic vector search
- Local deterministic fallback when services unavailable
- apps/knowledge-service (Python FastAPI) as internal-only service

## Key Constraints

- Internal-only, never publicly exposed
- Not a source of truth for transactions
- Not part of the agentic development pipeline
- Must fail soft when unavailable
- Demo mode uses deterministic fixtures only
- Agentic dev observations are tagged domain='agentic' and isolated from financial data
`))

// --- DEPLOY CI PACK ---
const infraAgentsMd = readIfExists('infra/docker/AGENTS.md')
const deployMd = readIfExists('docs/deployment.md')

packs.push(writePack('deploy-ci', `# Deploy & CI Context Pack — Finance-OS

> Auto-generated. Sources: infra/docker/AGENTS.md, docs/deployment.md
> Do not edit directly — regenerate with \`pnpm agent:context:pack\`

## Infrastructure Rules

${infraAgentsMd ? infraAgentsMd.substring(0, 2000) : 'See infra/docker/AGENTS.md'}

## Deployment

${deployMd ? deployMd.substring(0, 3000) : 'See docs/deployment.md'}

## Key Constraints

- GHCR container registry
- Dokploy deployment
- Multi-stage Docker builds
- CI via GitHub Actions
- Smoke tests for route topology
`))

// --- DESIGN SYSTEM PACK ---
packs.push(writePack('design-system', `# Design System Context Pack — Finance-OS

> Auto-generated. Sources: DESIGN.md, docs/frontend/design-system.md
> Do not edit directly — regenerate with \`pnpm agent:context:pack\`

## Identity: Aurora Pink

- Primary: rose magenta (oklch ~355 hue)
- Accent-2: electric violet (oklch ~295 hue)
- Typography: Inter (display/body), JetBrains Mono (financial data)
- Surface depth: 4 levels (surface-0 through surface-3)

## Component Conventions

- Use existing components: KpiTile, Panel, PageHeader, RangePill, BrandMark, AuroraBackdrop, StatusDot
- Financial amounts: .font-financial class (monospace, tabular figures)
- Semantic colors: positive/negative/warning (never brand rose for signal)
- React Bits components in apps/web/src/components/reactbits/ (MIT + Commons Clause)

## States Matrix (every widget)

- Loading (skeleton)
- Empty (no data)
- Error (failed fetch)
- Degraded (partial data)
- Normal (full data)

## Motion

- respect prefers-reduced-motion
- enter: fade + translate (200ms ease-out)
- exit: fade (150ms ease-in)
`))

// --- TESTING PACK ---
packs.push(writePack('testing', `# Testing Context Pack — Finance-OS

> Auto-generated. Source: docs/agentic/testing-canonical.md
> Do not edit directly — regenerate with \`pnpm agent:context:pack\`

## Verification Commands

- \`pnpm check:ci\` — auto-scoped CI checks
- \`pnpm lint\` — Biome linter
- \`pnpm typecheck\` — TypeScript checking across all packages
- \`pnpm -r --if-present test\` — run all tests
- \`pnpm -r --if-present build\` — build all packages
- \`pnpm smoke:api\` / \`pnpm smoke:prod\` — smoke tests

## Key Rules

- Behavior changes require test evidence
- Demo and admin paths both need test coverage
- UI changes require screenshot notes
- Worker tests must cover idempotency and fail-soft
`))

// --- SECURITY PACK ---
packs.push(writePack('security', `# Security Context Pack — Finance-OS

> Auto-generated. Source: AGENTS.md invariants
> Do not edit directly — regenerate with \`pnpm agent:context:pack\`

## Non-Negotiable Rules

- Never put secrets in VITE_* (client-exposed)
- Never log Powens codes, tokens, cookies, or PII
- Encrypt sensitive tokens at rest
- exactOptionalPropertyTypes enabled
- x-request-id propagation end-to-end
- Error payloads must be normalized and safe to expose
- Public traffic terminates on apps/web only

## Review Priorities

- P0: secret leak, token exposure, data loss, broken demo/admin split
- P1: contract regression, missing demo path, unsafe logging
- P2: style/cleanup
`))

// --- AUTOPILOT PACK ---
packs.push(writePack('autopilot', `# Autopilot Context Pack — Finance-OS

> Auto-generated. Source: AGENTS.md autopilot section
> Do not edit directly — regenerate with \`pnpm agent:context:pack\`

## Autopilot Workflow

- batch: issues are first-class product briefs
- Spec expansion: 1:1 with raw bullet list, no extra specs
- One implementation lane auto-starts at a time
- Implementation PRs: draft agent/impl-* branches
- Patch contract: AUTOPILOT_PATCH_V1, exactly one diff fence
- PR-thread patches must pass git apply --check
- Merge-on-green: requires real non-stub files, no agent stubs, green CI
- CI failures summarized back to PR thread
- One writer per active branch (Codex or human/Claude, not both)

## Context Budget (new)

- Every batch/spec/improve prompt should declare a context budget tier
- Use context packs instead of copying full docs
- Available tiers: small (8K), medium (16K), large (32K), xlarge (64K), autonomous (128K)
`))

// Summary
console.log(`\nGenerated ${packs.length} context packs.`)
const totalTokens = packs.reduce((sum, p) => sum + p.tokens, 0)
console.log(`Total: ${totalTokens.toLocaleString()} tokens across all packs.`)
