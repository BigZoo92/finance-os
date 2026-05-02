/**
 * Agent Context Budget Manager — Shared Library
 *
 * Token estimation, file classification, context pack generation.
 * No external dependencies — uses Node.js built-ins only.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')

// ---------------------------------------------------------------------------
// Token estimation (deterministic, ~4 chars per token approximation)
// ---------------------------------------------------------------------------

export function estimateTokens(text) {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export function estimateFileTokens(filePath) {
  try {
    const abs = filePath.startsWith('/') ? filePath : join(ROOT, filePath)
    const content = readFileSync(abs, 'utf-8')
    return estimateTokens(content)
  } catch {
    return 0
  }
}

export function estimateFileLines(filePath) {
  try {
    const abs = filePath.startsWith('/') ? filePath : join(ROOT, filePath)
    const content = readFileSync(abs, 'utf-8')
    return content.split('\n').length
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Budget tiers
// ---------------------------------------------------------------------------

export const BUDGET_TIERS = {
  small: 8_000,
  medium: 16_000,
  large: 32_000,
  xlarge: 64_000,
  autonomous: 128_000,
}

export const DEFAULT_BUDGET_TIER = 'medium'

// ---------------------------------------------------------------------------
// Context tiers (priority order)
// ---------------------------------------------------------------------------

export const CONTEXT_TIERS = ['always', 'domain-core', 'task-relevant', 'optional', 'archive', 'never-auto-load']

// ---------------------------------------------------------------------------
// File registry — all agent-relevant docs with tier classification
// ---------------------------------------------------------------------------

export function buildFileRegistry() {
  const registry = []

  const add = (path, tier, domain, description) => {
    const tokens = estimateFileTokens(path)
    if (tokens > 0) {
      registry.push({ path, tier, domain, description, tokens })
    }
  }

  // Always-load
  add('AGENTS.md', 'always', 'core', 'Global invariants and agentic contract')
  add('DESIGN.md', 'always', 'design', 'Design system source of truth')

  // Domain-core docs
  add('docs/context/STACK.md', 'domain-core', 'core', 'Technical stack and architecture')
  add('docs/context/APP-ARCHITECTURES.md', 'domain-core', 'core', 'Per-app architecture with graphs')
  add('docs/context/FEATURES.md', 'domain-core', 'core', 'All business features')
  add('docs/context/CONVENTIONS.md', 'domain-core', 'core', 'Coding conventions and best practices')
  add('docs/context/DESIGN-DIRECTION.md', 'domain-core', 'design', 'Artistic direction')

  // Task-relevant docs
  add('docs/context/ENV-REFERENCE.md', 'task-relevant', 'env', 'Environment variables reference')
  add('docs/context/EXTERNAL-SERVICES.md', 'task-relevant', 'services', 'External services and APIs')
  add('docs/context/NEWS-FETCH.md', 'task-relevant', 'news', 'News pipeline architecture')
  add('docs/context/MARKETS-MACRO.md', 'task-relevant', 'markets', 'Markets and macro data pipeline')
  add('docs/context/PERFORMANCE-PLAYBOOK.md', 'task-relevant', 'performance', 'Performance optimization guide')
  add('docs/context/TAURI-DESKTOP.md', 'task-relevant', 'desktop', 'Tauri desktop app context')
  add('docs/SKILLS-INVENTORY.md', 'task-relevant', 'skills', 'Skills inventory with trust tiers')
  add('docs/agentic/policy-verification-bundle.md', 'task-relevant', 'review', 'Verification checklists')
  add('docs/agentic/execution-map.md', 'task-relevant', 'architecture', 'Runtime execution flows')
  add('docs/agentic/code_review.md', 'task-relevant', 'review', 'Code review severity and checklist')
  add('docs/agentic/architecture-canonical.md', 'task-relevant', 'architecture', 'Canonical architecture template')
  add('docs/agentic/contracts-canonical.md', 'task-relevant', 'contracts', 'HTTP contract guidance')
  add('docs/agentic/testing-canonical.md', 'task-relevant', 'testing', 'Verification strategy')
  add('docs/agentic/release-canonical.md', 'task-relevant', 'deploy', 'Release/deploy guidance')
  add('docs/agentic/design-guidance-canonical.md', 'task-relevant', 'design', 'UI/UX quality guidance')
  add('docs/deployment.md', 'task-relevant', 'deploy', 'Deployment documentation')
  add('docs/AI-SETUP.md', 'task-relevant', 'ai-advisor', 'AI setup documentation')
  add('docs/adr/temporal-knowledge-graph-graphrag.md', 'task-relevant', 'knowledge-graph', 'Knowledge graph ADR')

  // Local AGENTS.md files
  const localAgentsFiles = [
    ['apps/api/AGENTS.md', 'api-backend'],
    ['apps/web/AGENTS.md', 'web-ui'],
    ['apps/worker/AGENTS.md', 'worker-sync'],
    ['apps/desktop/AGENTS.md', 'desktop'],
    ['infra/docker/AGENTS.md', 'docker-deploy'],
    ['packages/db/AGENTS.md', 'database'],
    ['packages/env/AGENTS.md', 'env'],
    ['packages/powens/AGENTS.md', 'powens'],
    ['packages/redis/AGENTS.md', 'redis'],
    ['packages/ui/AGENTS.md', 'web-ui'],
    ['packages/prelude/AGENTS.md', 'core'],
  ]
  for (const [path, domain] of localAgentsFiles) {
    add(path, 'domain-core', domain, `Local AGENTS.md for ${domain}`)
  }

  // Archive
  add('FINANCE-OS-CONTEXT.md', 'archive', 'core', 'Monolithic external-chat context pack (do not auto-load)')

  // Never-auto-load: color-expert references are handled by skill router exclusion

  return registry
}

// ---------------------------------------------------------------------------
// Skill registry
// ---------------------------------------------------------------------------

export function buildSkillRegistry() {
  const skills = []
  const skillDirs = ['.agentic/source/skills']

  for (const baseDir of skillDirs) {
    const absBase = join(ROOT, baseDir)
    if (!existsSync(absBase)) continue

    walkSkills(absBase, baseDir, skills)
  }

  return skills
}

function walkSkills(dir, relBase, skills) {
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const subdir = join(dir, entry.name)
    const skillFile = join(subdir, 'SKILL.md')
    const agentsFile = join(subdir, 'AGENTS.md')
    const mainFile = existsSync(skillFile) ? skillFile : existsSync(agentsFile) ? agentsFile : null

    if (mainFile) {
      const relPath = relative(ROOT, subdir)
      const tokens = estimateFileTokens(mainFile)
      const { tier, domains } = classifySkill(relPath, entry.name)

      // Check for large reference dirs
      const refsDir = join(subdir, 'references')
      let refTokens = 0
      if (existsSync(refsDir)) {
        refTokens = estimateDirTokens(refsDir)
      }

      skills.push({
        name: entry.name,
        path: relPath,
        mainFile: relative(ROOT, mainFile),
        tokens,
        refTokens,
        tier,
        domains,
      })
    } else {
      // Recurse into nested dirs (e.g., finance-os/core-invariants/)
      walkSkills(subdir, relBase, skills)
    }
  }
}

function estimateDirTokens(dir) {
  let total = 0
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isFile() && ['.md', '.txt', '.json'].includes(extname(entry.name))) {
        total += estimateFileTokens(full)
      } else if (entry.isDirectory()) {
        total += estimateDirTokens(full)
      }
    }
  } catch { /* ignore */ }
  return total
}

function classifySkill(relPath, name) {
  // Finance-OS local skills — highest priority
  if (relPath.includes('finance-os/') || name.startsWith('finance-os-')) {
    const domainMap = {
      'core-invariants': ['core-invariants', 'security', 'env'],
      'web-ssr-auth': ['web-ui', 'tanstack', 'auth'],
      'powens-integration': ['powens'],
      'worker-sync': ['worker-sync', 'redis'],
      'deploy-ghcr-dokploy': ['docker-deploy', 'ci-cd'],
      'observability-failsoft': ['observability', 'core-invariants'],
      'ui-cockpit': ['web-ui', 'design-polish'],
    }
    for (const [key, domains] of Object.entries(domainMap)) {
      if (name.includes(key) || relPath.includes(key)) {
        return { tier: 'core', domains }
      }
    }
    return { tier: 'core', domains: ['core-invariants'] }
  }

  // GitNexus skills
  if (relPath.includes('gitnexus/')) {
    return { tier: 'core', domains: ['agentic-autopilot', 'architecture'] }
  }

  // Generated domain skills
  if (relPath.includes('generated/')) {
    const domainName = name.replace('cluster-', '')
    return { tier: 'optional', domains: [domainName] }
  }

  // Known external skills
  const externalMap = {
    'vercel-react-best-practices': { tier: 'recommended', domains: ['web-ui'] },
    'vercel-composition-patterns': { tier: 'recommended', domains: ['web-ui'] },
    'tanstack-start-best-practices': { tier: 'recommended', domains: ['tanstack', 'web-ui'] },
    'tanstack-query-best-practices': { tier: 'recommended', domains: ['tanstack', 'web-ui'] },
    'tanstack-router-best-practices': { tier: 'recommended', domains: ['tanstack', 'web-ui'] },
    'tanstack-integration-best-practices': { tier: 'recommended', domains: ['tanstack', 'web-ui'] },
    'drizzle-best-practices': { tier: 'recommended', domains: ['database'] },
    'postgresql-code-review': { tier: 'recommended', domains: ['database'] },
    'redis-development': { tier: 'recommended', domains: ['redis'] },
    'security-and-hardening': { tier: 'recommended', domains: ['security'] },
    'ci-cd-and-automation': { tier: 'recommended', domains: ['ci-cd'] },
    'git-workflow-and-versioning': { tier: 'recommended', domains: ['ci-cd'] },
    'documentation-and-adrs': { tier: 'recommended', domains: ['documentation'] },
    'code-review': { tier: 'recommended', domains: ['review'] },
    'webapp-testing': { tier: 'recommended', domains: ['testing'] },
    'performance': { tier: 'recommended', domains: ['performance'] },
    'core-web-vitals': { tier: 'recommended', domains: ['performance'] },
    'web-quality-audit': { tier: 'recommended', domains: ['performance', 'accessibility'] },
  }

  if (externalMap[name]) return externalMap[name]

  // Impeccable UI skills
  const impeccableSkills = [
    'adapt', 'animate', 'arrange', 'audit', 'bolder', 'clarify', 'color-expert',
    'colorize', 'creative-direction', 'critique', 'delight', 'design-tokens', 'distill',
    'extract', 'frontend-design', 'frontend-design-review', 'frontend-skill', 'harden',
    'make-interfaces-feel-better', 'motion-design-patterns', 'normalize', 'onboard',
    'optimize', 'overdrive', 'polish', 'quieter', 'teach-impeccable', 'typeset',
    'typography-audit', 'ui-animation', 'ui-audit', 'ui-design', 'visual-qa',
    'web-design-guidelines',
  ]
  if (impeccableSkills.includes(name)) {
    return { tier: 'optional', domains: ['design-polish', 'web-ui'] }
  }

  // Experimental
  if (relPath.includes('experimental/')) {
    return { tier: 'experimental', domains: ['security'] }
  }

  // Meta skills
  if (['learn', 'review-skill', 'empirical-prompt-tuning'].includes(name)) {
    return { tier: 'optional', domains: ['agentic-autopilot'] }
  }

  return { tier: 'optional', domains: ['unknown'] }
}

// ---------------------------------------------------------------------------
// Task domain mapping
// ---------------------------------------------------------------------------

export const TASK_DOMAINS = {
  'core-invariants': {
    requiredSkills: ['finance-os/core-invariants'],
    optionalSkills: ['security-and-hardening'],
    docs: ['AGENTS.md'],
  },
  'web-ui': {
    requiredSkills: ['finance-os/ui-cockpit', 'finance-os/web-ssr-auth'],
    optionalSkills: ['vercel-react-best-practices', 'vercel-composition-patterns'],
    docs: ['AGENTS.md', 'DESIGN.md', 'apps/web/AGENTS.md'],
  },
  'tanstack': {
    requiredSkills: ['finance-os/web-ssr-auth', 'tanstack-start-best-practices'],
    optionalSkills: ['tanstack-router-best-practices', 'tanstack-query-best-practices', 'tanstack-integration-best-practices'],
    docs: ['AGENTS.md', 'apps/web/AGENTS.md'],
  },
  'api-backend': {
    requiredSkills: ['finance-os/core-invariants'],
    optionalSkills: ['security-and-hardening'],
    docs: ['AGENTS.md', 'apps/api/AGENTS.md'],
  },
  'worker-sync': {
    requiredSkills: ['finance-os/worker-sync'],
    optionalSkills: ['redis-development'],
    docs: ['AGENTS.md', 'apps/worker/AGENTS.md'],
  },
  'powens': {
    requiredSkills: ['finance-os/powens-integration', 'finance-os/core-invariants'],
    optionalSkills: [],
    docs: ['AGENTS.md', 'packages/powens/AGENTS.md'],
  },
  'knowledge-graph': {
    requiredSkills: ['finance-os/core-invariants'],
    optionalSkills: [],
    docs: ['AGENTS.md', 'docs/adr/temporal-knowledge-graph-graphrag.md'],
  },
  'ai-advisor': {
    requiredSkills: ['finance-os/core-invariants'],
    optionalSkills: [],
    docs: ['AGENTS.md', 'docs/AI-SETUP.md'],
  },
  'database': {
    requiredSkills: ['drizzle-best-practices'],
    optionalSkills: ['postgresql-code-review'],
    docs: ['AGENTS.md', 'packages/db/AGENTS.md'],
  },
  'redis': {
    requiredSkills: ['finance-os/worker-sync'],
    optionalSkills: ['redis-development'],
    docs: ['AGENTS.md', 'packages/redis/AGENTS.md'],
  },
  'docker-deploy': {
    requiredSkills: ['finance-os/deploy-ghcr-dokploy'],
    optionalSkills: ['ci-cd-and-automation'],
    docs: ['AGENTS.md', 'infra/docker/AGENTS.md', 'docs/deployment.md'],
  },
  'ci-cd': {
    requiredSkills: ['finance-os/deploy-ghcr-dokploy'],
    optionalSkills: ['ci-cd-and-automation', 'git-workflow-and-versioning'],
    docs: ['AGENTS.md', 'infra/docker/AGENTS.md'],
  },
  'testing': {
    requiredSkills: ['finance-os/core-invariants'],
    optionalSkills: ['webapp-testing'],
    docs: ['AGENTS.md', 'docs/agentic/testing-canonical.md'],
  },
  'performance': {
    requiredSkills: ['performance'],
    optionalSkills: ['core-web-vitals'],
    docs: ['AGENTS.md', 'docs/context/PERFORMANCE-PLAYBOOK.md'],
  },
  'design-polish': {
    requiredSkills: ['finance-os/ui-cockpit'],
    optionalSkills: ['polish', 'critique', 'audit'],
    docs: ['AGENTS.md', 'DESIGN.md'],
  },
  'security': {
    requiredSkills: ['finance-os/core-invariants', 'security-and-hardening'],
    optionalSkills: [],
    docs: ['AGENTS.md'],
  },
  'review': {
    requiredSkills: ['code-review', 'finance-os/core-invariants'],
    optionalSkills: ['postgresql-code-review'],
    docs: ['AGENTS.md', 'docs/agentic/code_review.md'],
  },
  'documentation': {
    requiredSkills: ['documentation-and-adrs'],
    optionalSkills: [],
    docs: ['AGENTS.md'],
  },
  'agentic-autopilot': {
    requiredSkills: ['finance-os/core-invariants'],
    optionalSkills: [],
    docs: ['AGENTS.md', 'docs/agentic/INDEX.md'],
  },
}

// ---------------------------------------------------------------------------
// Context pack builder
// ---------------------------------------------------------------------------

export function selectContextForTask({ domains, budgetTier = DEFAULT_BUDGET_TIER }) {
  const budget = BUDGET_TIERS[budgetTier] || BUDGET_TIERS[DEFAULT_BUDGET_TIER]
  const fileRegistry = buildFileRegistry()
  const skillRegistry = buildSkillRegistry()

  // Collect relevant docs by tier priority
  const selectedDocs = []
  let usedTokens = 0

  // Phase 1: always-load docs
  for (const file of fileRegistry.filter(f => f.tier === 'always')) {
    if (usedTokens + file.tokens <= budget) {
      selectedDocs.push(file)
      usedTokens += file.tokens
    }
  }

  // Phase 2: domain-core docs matching any requested domain
  const domainDocs = new Set()
  for (const domain of domains) {
    const mapping = TASK_DOMAINS[domain]
    if (mapping) {
      for (const doc of mapping.docs) {
        domainDocs.add(doc)
      }
    }
  }

  for (const file of fileRegistry.filter(f => f.tier === 'domain-core')) {
    if (domainDocs.has(file.path) || domains.includes(file.domain)) {
      if (usedTokens + file.tokens <= budget) {
        selectedDocs.push(file)
        usedTokens += file.tokens
      }
    }
  }

  // Phase 3: task-relevant docs matching domains
  for (const file of fileRegistry.filter(f => f.tier === 'task-relevant')) {
    if (domains.includes(file.domain)) {
      if (usedTokens + file.tokens <= budget) {
        selectedDocs.push(file)
        usedTokens += file.tokens
      }
    }
  }

  // Collect relevant skills
  const selectedSkills = []
  const requiredSkillNames = new Set()
  const optionalSkillNames = new Set()

  for (const domain of domains) {
    const mapping = TASK_DOMAINS[domain]
    if (mapping) {
      for (const s of mapping.requiredSkills) requiredSkillNames.add(s)
      for (const s of mapping.optionalSkills) optionalSkillNames.add(s)
    }
  }

  // Select required skills first
  for (const skill of skillRegistry) {
    const matchesRequired = requiredSkillNames.has(skill.name) ||
      [...requiredSkillNames].some(r => skill.path.includes(r))
    if (matchesRequired && usedTokens + skill.tokens <= budget) {
      selectedSkills.push({ ...skill, required: true })
      usedTokens += skill.tokens
    }
  }

  // Then optional skills if budget allows (max 3)
  let optionalCount = 0
  for (const skill of skillRegistry) {
    if (optionalCount >= 3) break
    const matchesOptional = optionalSkillNames.has(skill.name) ||
      [...optionalSkillNames].some(o => skill.path.includes(o) || skill.name === o)
    const alreadySelected = selectedSkills.some(s => s.name === skill.name)
    if (matchesOptional && !alreadySelected && usedTokens + skill.tokens <= budget) {
      selectedSkills.push({ ...skill, required: false })
      usedTokens += skill.tokens
      optionalCount++
    }
  }

  return {
    budgetTier,
    budgetTokens: budget,
    usedTokens,
    remainingTokens: budget - usedTokens,
    utilization: Math.round((usedTokens / budget) * 100),
    docs: selectedDocs,
    skills: selectedSkills,
    domains,
    warnings: usedTokens > budget ? [`Budget exceeded by ${usedTokens - budget} tokens`] : [],
  }
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export function detectDuplicates() {
  const fileRegistry = buildFileRegistry()
  const seen = new Map()
  const duplicates = []

  for (const file of fileRegistry) {
    try {
      const abs = file.path.startsWith('/') ? file.path : join(ROOT, file.path)
      const content = readFileSync(abs, 'utf-8').trim()
      const key = content.substring(0, 500) // First 500 chars as fingerprint
      if (seen.has(key)) {
        duplicates.push({ file: file.path, duplicateOf: seen.get(key) })
      } else {
        seen.set(key, file.path)
      }
    } catch { /* ignore */ }
  }

  return duplicates
}

export { ROOT }
