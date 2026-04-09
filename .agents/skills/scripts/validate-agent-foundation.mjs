import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../../..')

const rootAgentsFile = 'AGENTS.md'
const nestedAgentFiles = [
  'apps/api/AGENTS.md',
  'apps/web/AGENTS.md',
  'apps/worker/AGENTS.md',
  'packages/db/AGENTS.md',
  'packages/env/AGENTS.md',
  'packages/powens/AGENTS.md',
  'packages/redis/AGENTS.md',
  'packages/ui/AGENTS.md',
  'packages/prelude/AGENTS.md',
]

const docSpecs = [
  { file: 'docs/agentic/INDEX.md', requiredHeadings: ['## Maps', '## Local Guides', '## Repo-Local Skills', '## Validation'], minLinks: 6 },
  { file: 'docs/agentic/architecture-map.md', requiredHeadings: ['## Runtime Entry Points', '## Package Anchors', '## Layering Expectations', '## First Reads By Change Type'], minLinks: 8 },
  { file: 'docs/agentic/contracts-map.md', requiredHeadings: ['## Required API Contracts', '## Route Protection and Compatibility', '## Powens Flow Contracts', '## Manual Contract Checks'], minLinks: 8 },
  { file: 'docs/agentic/testing-map.md', requiredHeadings: ['## Current Automated Coverage', '## Scope-Based Verification', '## Known Gaps', '## Manual Checks Worth Doing'], minLinks: 6 },
  { file: 'docs/agentic/ui-quality-map.md', requiredHeadings: ['## Primary UI Surfaces', '## Quality Bar', '## UI Change Expectations', '## Manual UI Checklist'], minLinks: 3 },
  { file: 'docs/agentic/release-map.md', requiredHeadings: ['## Workflow Topology', '## Deployment and Runtime Docs', '## Release Guardrails', '## Smoke and Manual Checks'], minLinks: 6 },
  { file: 'docs/agentic/code_review.md', requiredHeadings: ['## Severity', '## Always Check', '## UI-Specific Checks', '## Usually Ignore', '## Review Mindset'], minLinks: 0 },
]

const skillSpecs = [
  {
    name: 'implementation-strategy',
    triggerTokens: ['auth', 'contract', 'provider', 'layer'],
    outputTokens: ['scope', 'verification', 'rollback'],
  },
  {
    name: 'code-change-verification',
    triggerTokens: ['docs', 'skills', 'api', 'web'],
    outputTokens: ['commands', 'pass', 'gaps'],
  },
  {
    name: 'dual-path-guard',
    triggerTokens: ['demo', 'admin', 'auth', 'short-circuit'],
    outputTokens: ['severity', 'file', 'tests'],
  },
  {
    name: 'api-contract-guard',
    triggerTokens: ['route', 'contract', 'endpoint', '404'],
    outputTokens: ['endpoint', 'caller', 'test'],
  },
  {
    name: 'powens-safety-review',
    triggerTokens: ['powens', 'token', 'callback', 'encryption'],
    outputTokens: ['security', 'storage', 'auth-state', 'manual'],
  },
  {
    name: 'ui-change-quality',
    triggerTokens: ['ui', 'dashboard', 'state', 'screenshot'],
    outputTokens: ['rationale', 'loading', 'error', 'screenshot'],
  },
  {
    name: 'docs-sync',
    triggerTokens: ['agents', 'docs', 'contract', 'env'],
    outputTokens: ['files', 'update', 'skill'],
  },
  {
    name: 'pr-summary',
    triggerTokens: ['pr', 'risk', 'test', 'rollback'],
    outputTokens: ['summary', 'risk', 'test', 'rollback'],
  },
  {
    name: 'release-sanity',
    triggerTokens: ['release', 'deploy', 'workflow', 'smoke'],
    outputTokens: ['impact', 'workflow', 'smoke', 'risk'],
  },
  {
    name: 'test-coverage-improver',
    triggerTokens: ['test', 'coverage', 'gap', 'priority'],
    outputTokens: ['priority', 'target', 'assertion'],
  },
  {
    name: 'repo-recall',
    triggerTokens: ['architecture', 'contracts', 'testing', 'release'],
    outputTokens: ['entrypoints', 'contracts', 'tests', 'risks'],
  },
]

const requiredSkillHeadings = [
  '## Trigger',
  '## Inputs',
  '## Output',
  '## Workflow',
  '## Trigger Examples',
  '## Verification',
]

const errors = []

const toAbsolute = relativePath => path.join(repoRoot, relativePath)

const readText = relativePath => readFileSync(toAbsolute(relativePath), 'utf8')

const ensureFile = relativePath => {
  if (!existsSync(toAbsolute(relativePath))) {
    errors.push(`Missing file: ${relativePath}`)
    return false
  }

  return true
}

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getSection = (text, heading) => {
  const regex = new RegExp(`${escapeRegExp(heading)}\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`)
  const match = text.match(regex)
  return match ? match[1].trim() : ''
}

const parseFrontmatter = text => {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!match) {
    return null
  }

  const data = {}
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')

    data[key] = value
  }

  return data
}

const resolveLinkTarget = (filePath, target) => {
  if (
    target.startsWith('http://') ||
    target.startsWith('https://') ||
    target.startsWith('#') ||
    target.startsWith('mailto:')
  ) {
    return null
  }

  return path.resolve(path.dirname(toAbsolute(filePath)), target)
}

const getLocalLinks = (filePath, text) => {
  const links = []
  const regex = /\[[^\]]+\]\(([^)]+)\)/g

  for (const match of text.matchAll(regex)) {
    const target = match[1]
    const resolved = resolveLinkTarget(filePath, target)
    if (!resolved) {
      continue
    }

    links.push({ target, resolved })
  }

  return links
}

const validateLinks = (filePath, text, minLinks) => {
  const localLinks = getLocalLinks(filePath, text)

  if (localLinks.length < minLinks) {
    errors.push(`${filePath} should have at least ${String(minLinks)} local repo links; found ${String(localLinks.length)}`)
  }

  for (const link of localLinks) {
    if (!existsSync(link.resolved)) {
      errors.push(`${filePath} contains a broken local link: ${link.target}`)
    }
  }
}

const countBullets = text => {
  return text
    .split('\n')
    .filter(line => /^\s*-\s+/.test(line))
    .length
}

const validateRootAgents = () => {
  if (!ensureFile(rootAgentsFile)) {
    return
  }

  const text = readText(rootAgentsFile)
  for (const heading of [
    '## Global Invariants',
    '## Global Verification',
    '## Global Review',
    '## Local Guides',
    '## Agentic Maps',
  ]) {
    if (!text.includes(heading)) {
      errors.push(`${rootAgentsFile} is missing heading: ${heading}`)
    }
  }

  if (!text.includes('.agents/skills/')) {
    errors.push(`${rootAgentsFile} should point to .agents/skills/`)
  }

  if (!text.includes('docs/agentic/')) {
    errors.push(`${rootAgentsFile} should point to docs/agentic/`)
  }

  validateLinks(rootAgentsFile, text, 10)
}

const validateNestedAgents = () => {
  for (const filePath of nestedAgentFiles) {
    if (!ensureFile(filePath)) {
      continue
    }

    const text = readText(filePath)
    for (const heading of ['## Local Rules', '## Verify', '## Pitfalls']) {
      if (!text.includes(heading)) {
        errors.push(`${filePath} is missing heading: ${heading}`)
      }
    }

    validateLinks(filePath, text, 1)
  }
}

const validateDocs = () => {
  for (const spec of docSpecs) {
    if (!ensureFile(spec.file)) {
      continue
    }

    const text = readText(spec.file)
    for (const heading of spec.requiredHeadings) {
      if (!text.includes(heading)) {
        errors.push(`${spec.file} is missing heading: ${heading}`)
      }
    }

    validateLinks(spec.file, text, spec.minLinks)
  }
}

const validateSkills = () => {
  for (const spec of skillSpecs) {
    const filePath = `.agents/skills/${spec.name}/SKILL.md`
    if (!ensureFile(filePath)) {
      continue
    }

    const text = readText(filePath)
    const frontmatter = parseFrontmatter(text)
    if (!frontmatter) {
      errors.push(`${filePath} is missing YAML frontmatter`)
      continue
    }

    if (frontmatter.name !== spec.name) {
      errors.push(`${filePath} has frontmatter name "${frontmatter.name ?? ''}" but expected "${spec.name}"`)
    }

    if (!frontmatter.description) {
      errors.push(`${filePath} is missing a description in frontmatter`)
    }

    for (const heading of requiredSkillHeadings) {
      if (!text.includes(heading)) {
        errors.push(`${filePath} is missing heading: ${heading}`)
      }
    }

    const triggerSection = getSection(text, '## Trigger').toLowerCase()
    const outputSection = getSection(text, '## Output').toLowerCase()
    const examplesSection = getSection(text, '## Trigger Examples')
    const searchableTriggerText = `${String(frontmatter.description).toLowerCase()}\n${triggerSection}`

    for (const token of spec.triggerTokens) {
      if (!searchableTriggerText.includes(token)) {
        errors.push(`${filePath} trigger coverage is missing token: ${token}`)
      }
    }

    for (const token of spec.outputTokens) {
      if (!outputSection.includes(token)) {
        errors.push(`${filePath} output contract is missing token: ${token}`)
      }
    }

    if (countBullets(examplesSection) < 2) {
      errors.push(`${filePath} should include at least two trigger examples`)
    }

    validateLinks(filePath, text, 2)
  }
}

validateRootAgents()
validateNestedAgents()
validateDocs()
validateSkills()

if (errors.length > 0) {
  console.error('Agent foundation validation failed:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log(
  `Agent foundation validation passed: 1 root AGENTS, ${String(nestedAgentFiles.length)} nested AGENTS, ${String(docSpecs.length)} docs, ${String(skillSpecs.length)} skills.`
)
