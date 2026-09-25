#!/usr/bin/env node
// Moon Stage A parity check: the Moon project graph must describe the
// repository at least as precisely as the custom affected script. For a set of
// representative change fixtures, both selections are computed from the same
// file lists and compared. Documented divergences (files the custom script can
// only treat as "run everything") are reported, not failed; any other
// disagreement fails, because it means the Moon graph is wrong.
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeAffectedWorkspaces, discoverWorkspaces } from './affected-tasks.mjs'

const ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))

/** Representative changes per file family (paths relative to the repo root). */
export const PARITY_FIXTURES = [
  { name: 'ui package', files: ['packages/ui/src/components/ui/button.tsx'] },
  { name: 'finance engine', files: ['packages/finance-engine/src/types.ts'] },
  { name: 'api route', files: ['apps/api/src/routes/dashboard/routes/summary.ts'] },
  { name: 'db schema', files: ['packages/db/src/schema/valuation.ts'] },
  { name: 'python service', files: ['apps/knowledge-service/src/finance_os_knowledge/app.py'] },
  { name: 'desktop shell', files: ['apps/desktop/src-tauri/tauri.conf.json'] },
  { name: 'docs', files: ['docs/architecture.md'] },
  { name: 'infra', files: ['infra/docker/Dockerfile'] },
  { name: 'agentic skill', files: ['.agentic/source/skills/finance-os-core/SKILL.md'] },
  { name: 'root tooling', files: ['package.json'] },
]

/** Longest-prefix owner lookup over Moon project sources; the root project is the fallback. */
const findOwner = (projects, file) => {
  let owner = null
  for (const project of projects) {
    if (project.source === '.') continue
    if (file === project.source || file.startsWith(`${project.source}/`)) {
      if (!owner || project.source.length > owner.source.length) owner = project
    }
  }
  return owner ?? projects.find(project => project.source === '.') ?? null
}

/**
 * Pure Moon-graph selection: owner projects plus every project that depends on
 * them (transitively). The root project owns repository-level files.
 */
export const computeMoonAffected = ({ graph, files }) => {
  const projects = graph.projects
  const byId = new Map(projects.map(project => [project.id, project]))
  const dependents = new Map(projects.map(project => [project.id, new Set()]))
  for (const project of projects) {
    for (const dependency of project.dependencies ?? []) {
      dependents.get(dependency.id)?.add(project.id)
    }
  }

  const affected = new Set()
  const queue = []
  for (const file of files) {
    const owner = findOwner(projects, file)
    if (owner && !affected.has(owner.id)) {
      affected.add(owner.id)
      queue.push(owner.id)
    }
  }
  while (queue.length > 0) {
    const current = queue.shift()
    for (const dependent of dependents.get(current) ?? []) {
      if (!affected.has(dependent)) {
        affected.add(dependent)
        queue.push(dependent)
      }
    }
  }

  return [...affected]
    .map(id => byId.get(id))
    .filter(Boolean)
    .map(project => ({ id: project.id, source: project.source }))
    .sort((left, right) => left.source.localeCompare(right.source))
}

/**
 * Compares the custom selection with Moon's for one fixture.
 * - `agree`: identical workspace sets.
 * - `documented`: the custom script falls back to a full run for files it
 *   cannot attribute (Python, desktop, docs, infra, agentic, root tooling)
 *   while Moon attributes them to a project. This is the known Stage A gap.
 * - `divergent`: both attribute the change and disagree — a graph error.
 */
export const compareSelections = ({ custom, moon }) => {
  if (custom.fullRun) {
    return { verdict: 'documented', detail: custom.reason, moon: moon.map(item => item.id) }
  }
  const customDirs = custom.workspaces.map(workspace => workspace.dir).sort()
  const moonDirs = moon.map(item => item.source).sort()
  const same =
    customDirs.length === moonDirs.length &&
    customDirs.every((dir, index) => dir === moonDirs[index])
  return same
    ? { verdict: 'agree', detail: null, moon: moon.map(item => item.id) }
    : {
        verdict: 'divergent',
        detail: `custom=[${customDirs.join(', ')}] moon=[${moonDirs.join(', ')}]`,
        moon: moon.map(item => item.id),
      }
}

export const runParity = ({ graph, workspaces, fixtures = PARITY_FIXTURES }) =>
  fixtures.map(fixture => ({
    name: fixture.name,
    files: fixture.files,
    ...compareSelections({
      custom: computeAffectedWorkspaces({ files: fixture.files, workspaces }),
      moon: computeMoonAffected({ graph, files: fixture.files }),
    }),
  }))

const loadMoonGraph = () => {
  const result = spawnSync('pnpm', ['exec', 'moon', 'query', 'projects'], {
    cwd: ROOT,
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    throw new Error(`moon query projects failed: ${result.stderr || result.stdout}`)
  }
  return JSON.parse(result.stdout)
}

const main = () => {
  const graph = loadMoonGraph()
  const results = runParity({ graph, workspaces: discoverWorkspaces(ROOT) })
  const divergent = results.filter(result => result.verdict === 'divergent')

  console.log(`Moon graph: ${graph.projects.length} projects`)
  for (const result of results) {
    const moon = result.moon.join(', ') || '(none)'
    const suffix = result.detail ? ` :: ${result.detail}` : ''
    console.log(`- [${result.verdict}] ${result.name}: moon -> ${moon}${suffix}`)
  }

  if (divergent.length > 0) {
    console.error(`Moon parity failed: ${divergent.length} divergent fixture(s).`)
    process.exitCode = 1
    return
  }

  console.log(
    'Moon parity passed (documented full-run fallbacks are the Stage A gap Moon closes in Stage B).'
  )
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
