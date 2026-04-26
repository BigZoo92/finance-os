import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  estimateTokens,
  estimateFileTokens,
  buildFileRegistry,
  buildSkillRegistry,
  selectContextForTask,
  BUDGET_TIERS,
  TASK_DOMAINS,
  CONTEXT_TIERS,
  detectDuplicates,
} from './lib.mjs'

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    assert.equal(estimateTokens(''), 0)
  })

  it('returns 0 for null/undefined', () => {
    assert.equal(estimateTokens(null), 0)
    assert.equal(estimateTokens(undefined), 0)
  })

  it('estimates ~4 chars per token', () => {
    const text = 'a'.repeat(400)
    assert.equal(estimateTokens(text), 100)
  })

  it('rounds up', () => {
    assert.equal(estimateTokens('abc'), 1) // 3/4 = 0.75, ceil = 1
  })
})

describe('estimateFileTokens', () => {
  it('returns 0 for non-existent file', () => {
    assert.equal(estimateFileTokens('/nonexistent/file.md'), 0)
  })

  it('returns positive for AGENTS.md', () => {
    const tokens = estimateFileTokens('AGENTS.md')
    assert.ok(tokens > 0, `Expected positive tokens, got ${tokens}`)
  })
})

describe('BUDGET_TIERS', () => {
  it('has all expected tiers', () => {
    const expected = ['small', 'medium', 'large', 'xlarge', 'autonomous']
    for (const tier of expected) {
      assert.ok(tier in BUDGET_TIERS, `Missing tier: ${tier}`)
    }
  })

  it('tiers are in ascending order', () => {
    const tiers = Object.values(BUDGET_TIERS)
    for (let i = 1; i < tiers.length; i++) {
      assert.ok(tiers[i] > tiers[i - 1], `Tier ${i} should be larger than ${i - 1}`)
    }
  })

  it('small is 8000', () => {
    assert.equal(BUDGET_TIERS.small, 8_000)
  })
})

describe('CONTEXT_TIERS', () => {
  it('has always as first tier', () => {
    assert.equal(CONTEXT_TIERS[0], 'always')
  })

  it('has never-auto-load as last tier', () => {
    assert.equal(CONTEXT_TIERS[CONTEXT_TIERS.length - 1], 'never-auto-load')
  })
})

describe('TASK_DOMAINS', () => {
  it('has web-ui domain', () => {
    assert.ok('web-ui' in TASK_DOMAINS)
  })

  it('web-ui requires ui-cockpit skill', () => {
    const domain = TASK_DOMAINS['web-ui']
    assert.ok(domain.requiredSkills.some(s => s.includes('ui-cockpit')))
  })

  it('every domain has requiredSkills and optionalSkills', () => {
    for (const [name, domain] of Object.entries(TASK_DOMAINS)) {
      assert.ok(Array.isArray(domain.requiredSkills), `${name} missing requiredSkills`)
      assert.ok(Array.isArray(domain.optionalSkills), `${name} missing optionalSkills`)
      assert.ok(Array.isArray(domain.docs), `${name} missing docs`)
    }
  })

  it('all required skills reference valid skill names', () => {
    // Just check they are non-empty strings
    for (const [name, domain] of Object.entries(TASK_DOMAINS)) {
      for (const skill of domain.requiredSkills) {
        assert.ok(typeof skill === 'string' && skill.length > 0, `${name} has invalid required skill: ${skill}`)
      }
    }
  })
})

describe('buildFileRegistry', () => {
  it('returns array of files', () => {
    const registry = buildFileRegistry()
    assert.ok(Array.isArray(registry))
    assert.ok(registry.length > 0)
  })

  it('every file has required fields', () => {
    const registry = buildFileRegistry()
    for (const file of registry) {
      assert.ok(typeof file.path === 'string', 'Missing path')
      assert.ok(typeof file.tier === 'string', 'Missing tier')
      assert.ok(typeof file.domain === 'string', 'Missing domain')
      assert.ok(typeof file.tokens === 'number', 'Missing tokens')
      assert.ok(file.tokens > 0, `File ${file.path} has 0 tokens`)
    }
  })

  it('AGENTS.md is in always tier', () => {
    const registry = buildFileRegistry()
    const agentsMd = registry.find(f => f.path === 'AGENTS.md')
    assert.ok(agentsMd, 'AGENTS.md not found in registry')
    assert.equal(agentsMd.tier, 'always')
  })

  it('FINANCE-OS-CONTEXT.md is in archive tier', () => {
    const registry = buildFileRegistry()
    const contextMd = registry.find(f => f.path === 'FINANCE-OS-CONTEXT.md')
    assert.ok(contextMd, 'FINANCE-OS-CONTEXT.md not found')
    assert.equal(contextMd.tier, 'archive')
  })
})

describe('buildSkillRegistry', () => {
  it('returns array of skills', () => {
    const skills = buildSkillRegistry()
    assert.ok(Array.isArray(skills))
    assert.ok(skills.length > 0)
  })

  it('every skill has required fields', () => {
    const skills = buildSkillRegistry()
    for (const skill of skills) {
      assert.ok(typeof skill.name === 'string', 'Missing name')
      assert.ok(typeof skill.path === 'string', 'Missing path')
      assert.ok(typeof skill.tokens === 'number', 'Missing tokens')
      assert.ok(typeof skill.tier === 'string', 'Missing tier')
      assert.ok(Array.isArray(skill.domains), 'Missing domains')
    }
  })

  it('has Finance-OS core skills', () => {
    const skills = buildSkillRegistry()
    const coreSkills = skills.filter(s => s.tier === 'core')
    assert.ok(coreSkills.length >= 7, `Expected at least 7 core skills, got ${coreSkills.length}`)
  })

  it('classifies color-expert as optional', () => {
    const skills = buildSkillRegistry()
    const colorExpert = skills.find(s => s.name === 'color-expert')
    if (colorExpert) {
      assert.equal(colorExpert.tier, 'optional')
      // References moved to .agentic/source/references/ — refTokens may be 0 in canonical
    }
  })
})

describe('selectContextForTask', () => {
  it('respects budget for small tier', () => {
    const result = selectContextForTask({ domains: ['web-ui'], budgetTier: 'small' })
    assert.ok(result.usedTokens <= BUDGET_TIERS.small, `Used ${result.usedTokens} > budget ${BUDGET_TIERS.small}`)
  })

  it('respects budget for medium tier', () => {
    const result = selectContextForTask({ domains: ['web-ui'], budgetTier: 'medium' })
    assert.ok(result.usedTokens <= BUDGET_TIERS.medium, `Used ${result.usedTokens} > budget ${BUDGET_TIERS.medium}`)
  })

  it('returns selected docs and skills', () => {
    const result = selectContextForTask({ domains: ['web-ui'], budgetTier: 'large' })
    assert.ok(result.docs.length > 0, 'No docs selected')
    assert.ok(result.skills.length > 0, 'No skills selected')
  })

  it('always includes AGENTS.md', () => {
    const result = selectContextForTask({ domains: ['database'], budgetTier: 'medium' })
    const hasAgents = result.docs.some(d => d.path === 'AGENTS.md')
    assert.ok(hasAgents, 'AGENTS.md should always be included')
  })

  it('returns utilization percentage', () => {
    const result = selectContextForTask({ domains: ['web-ui'], budgetTier: 'medium' })
    assert.ok(result.utilization >= 0 && result.utilization <= 100)
  })

  it('marks skills as required or optional', () => {
    const result = selectContextForTask({ domains: ['web-ui'], budgetTier: 'large' })
    const hasRequired = result.skills.some(s => s.required === true)
    assert.ok(hasRequired, 'Should have at least one required skill')
  })
})

describe('detectDuplicates', () => {
  it('returns array', () => {
    const dupes = detectDuplicates()
    assert.ok(Array.isArray(dupes))
  })
})

describe('no VITE_ secrets in context packs', () => {
  it('context packs do not contain actual secret values', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const packsDir = join(new URL('../../', import.meta.url).pathname, 'docs/agentic/context-packs')

    let files
    try {
      files = readdirSync(packsDir).filter(f => f.endsWith('.md'))
    } catch {
      // Packs not generated yet — skip
      return
    }

    for (const file of files) {
      const content = readFileSync(join(packsDir, file), 'utf-8')
      // Should not contain actual env var values
      assert.ok(!content.includes('sk-'), `${file} contains what looks like an API key`)
      assert.ok(!content.includes('ghp_'), `${file} contains what looks like a GitHub token`)
      assert.ok(!content.includes('POWENS_'), `${file} contains Powens env var reference that might be a secret`)
    }
  })
})
