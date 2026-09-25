import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeAffectedWorkspaces } from './affected-tasks.mjs'
import { compareSelections, computeMoonAffected, runParity } from './moon-parity.mjs'

const graph = {
  projects: [
    { id: 'root', source: '.', dependencies: [] },
    { id: 'ui', source: 'packages/ui', dependencies: [] },
    { id: 'ai', source: 'packages/ai', dependencies: [] },
    { id: 'web', source: 'apps/web', dependencies: [{ id: 'ui' }, { id: 'ai' }] },
    { id: 'knowledge-service', source: 'apps/knowledge-service', dependencies: [] },
  ],
}

const workspaces = [
  { name: '@finance-os/ui', dir: 'packages/ui', packageJson: {} },
  { name: '@finance-os/ai', dir: 'packages/ai', packageJson: {} },
  {
    name: '@finance-os/web',
    dir: 'apps/web',
    packageJson: {
      dependencies: { '@finance-os/ui': 'workspace:*', '@finance-os/ai': 'workspace:*' },
    },
  },
]

test('Moon selection expands through reverse project dependencies', () => {
  const moon = computeMoonAffected({ graph, files: ['packages/ui/src/button.tsx'] })
  assert.deepEqual(
    moon.map(item => item.id),
    ['web', 'ui']
  )
})

test('Moon attributes repository-level files to the root project', () => {
  const moon = computeMoonAffected({ graph, files: ['docs/architecture.md'] })
  assert.deepEqual(
    moon.map(item => item.id),
    ['root']
  )
})

test('custom and Moon selections agree on workspace changes', () => {
  const files = ['packages/ui/src/button.tsx']
  const result = compareSelections({
    custom: computeAffectedWorkspaces({ files, workspaces }),
    moon: computeMoonAffected({ graph, files }),
  })
  assert.equal(result.verdict, 'agree')
})

test('custom full-run fallbacks are documented gaps, not divergences', () => {
  const files = ['apps/knowledge-service/src/app.py']
  const result = compareSelections({
    custom: computeAffectedWorkspaces({ files, workspaces }),
    moon: computeMoonAffected({ graph, files }),
  })
  assert.equal(result.verdict, 'documented')
  assert.deepEqual(result.moon, ['knowledge-service'])
})

test('a wrong graph edge is reported as divergent', () => {
  const brokenGraph = {
    projects: graph.projects.map(project =>
      project.id === 'web' ? { ...project, dependencies: [{ id: 'ai' }] } : project
    ),
  }
  const files = ['packages/ui/src/button.tsx']
  const result = compareSelections({
    custom: computeAffectedWorkspaces({ files, workspaces }),
    moon: computeMoonAffected({ graph: brokenGraph, files }),
  })
  assert.equal(result.verdict, 'divergent')
})

test('runParity evaluates every fixture', () => {
  const results = runParity({
    graph,
    workspaces,
    fixtures: [
      { name: 'ui', files: ['packages/ui/src/button.tsx'] },
      { name: 'docs', files: ['docs/architecture.md'] },
    ],
  })
  assert.deepEqual(
    results.map(result => result.verdict),
    ['agree', 'documented']
  )
})
