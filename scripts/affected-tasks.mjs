#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const command = process.argv[2] ?? 'print'

const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf-8',
    shell: process.platform === 'win32',
    stdio: options.stdio ?? 'pipe',
  })

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

const readJson = path => JSON.parse(readFileSync(path, 'utf-8'))

const discoverWorkspaces = () => {
  const workspaces = []

  for (const group of ['apps', 'packages']) {
    const groupDir = join(ROOT, group)
    if (!existsSync(groupDir)) continue

    for (const entry of readdirSync(groupDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue

      const dir = join(groupDir, entry.name)
      const packageJsonPath = join(dir, 'package.json')
      if (!existsSync(packageJsonPath)) continue

      const packageJson = readJson(packageJsonPath)
      workspaces.push({
        name: packageJson.name,
        dir: relative(ROOT, dir).replaceAll('\\', '/'),
        packageJson,
      })
    }
  }

  return workspaces
}

const getWorkspaceDeps = (workspace, workspaceNames) => {
  const dependencyBlocks = [
    workspace.packageJson.dependencies,
    workspace.packageJson.devDependencies,
    workspace.packageJson.peerDependencies,
    workspace.packageJson.optionalDependencies,
  ]

  const deps = new Set()
  for (const block of dependencyBlocks) {
    if (!block) continue
    for (const [name, version] of Object.entries(block)) {
      if (workspaceNames.has(name) && typeof version === 'string' && version.startsWith('workspace:')) {
        deps.add(name)
      }
    }
  }
  return deps
}

const resolveBaseRef = () => {
  const candidates = [
    process.env.FINANCE_OS_AFFECTED_BASE_REF,
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : undefined,
    'origin/main',
    'main',
    'HEAD~1',
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (run('git', ['rev-parse', '--verify', candidate]).status === 0) {
      return candidate
    }
  }

  return null
}

const listChangedFiles = baseRef => {
  const changed = new Set()

  if (!baseRef) {
    return { fullRun: true, reason: 'No comparable git base ref found.', files: [] }
  }

  const diffAgainstBase = run('git', [
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    `${baseRef}...HEAD`,
    '--',
    '.',
  ])
  if (diffAgainstBase.status !== 0) {
    return {
      fullRun: true,
      reason: `Unable to diff against ${baseRef}.`,
      files: [],
    }
  }

  for (const file of diffAgainstBase.stdout.split(/\r?\n/).filter(Boolean)) {
    changed.add(file.replaceAll('\\', '/'))
  }

  for (const args of [
    ['diff', '--name-only', '--diff-filter=ACMR', '--', '.'],
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '--', '.'],
    ['ls-files', '--others', '--exclude-standard'],
  ]) {
    const result = run('git', args)
    if (result.status !== 0) {
      return { fullRun: true, reason: 'Unable to inspect local git changes.', files: [] }
    }

    for (const file of result.stdout.split(/\r?\n/).filter(Boolean)) {
      changed.add(file.replaceAll('\\', '/'))
    }
  }

  return { fullRun: false, reason: null, files: [...changed].sort() }
}

const rootFullRunPatterns = [
  /^\.github\//,
  /^infra\/docker\//,
  /^scripts\/check-ci\.mjs$/,
  /^scripts\/affected-tasks\.mjs$/,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
  /^biome\.json/,
  /^tsconfig/,
]

const computeAffected = () => {
  const workspaces = discoverWorkspaces()
  const workspaceNames = new Set(workspaces.map(workspace => workspace.name))
  const byName = new Map(workspaces.map(workspace => [workspace.name, workspace]))
  const baseRef = resolveBaseRef()
  const changed = listChangedFiles(baseRef)

  if (changed.fullRun) {
    return { fullRun: true, reason: changed.reason, baseRef, files: changed.files, workspaces: [] }
  }

  if (changed.files.length === 0) {
    return { fullRun: false, reason: null, baseRef, files: [], workspaces: [] }
  }

  if (changed.files.some(file => rootFullRunPatterns.some(pattern => pattern.test(file)))) {
    return {
      fullRun: true,
      reason: 'Root orchestration, CI, Docker, lockfile, or tool configuration changed.',
      baseRef,
      files: changed.files,
      workspaces: [],
    }
  }

  const directlyAffected = new Set()
  for (const file of changed.files) {
    const owner = workspaces.find(workspace => file === workspace.dir || file.startsWith(`${workspace.dir}/`))
    if (!owner) {
      return {
        fullRun: true,
        reason: `Changed file is outside a known workspace: ${file}`,
        baseRef,
        files: changed.files,
        workspaces: [],
      }
    }
    directlyAffected.add(owner.name)
  }

  const reverseDeps = new Map(workspaces.map(workspace => [workspace.name, new Set()]))
  for (const workspace of workspaces) {
    for (const dep of getWorkspaceDeps(workspace, workspaceNames)) {
      reverseDeps.get(dep)?.add(workspace.name)
    }
  }

  const affected = new Set(directlyAffected)
  const queue = [...directlyAffected]
  while (queue.length > 0) {
    const current = queue.shift()
    for (const dependent of reverseDeps.get(current) ?? []) {
      if (!affected.has(dependent)) {
        affected.add(dependent)
        queue.push(dependent)
      }
    }
  }

  const affectedWorkspaces = [...affected]
    .map(name => byName.get(name))
    .filter(Boolean)
    .sort((left, right) => left.dir.localeCompare(right.dir))

  return {
    fullRun: false,
    reason: null,
    baseRef,
    files: changed.files,
    workspaces: affectedWorkspaces.map(workspace => ({
      name: workspace.name,
      dir: workspace.dir,
      scripts: workspace.packageJson.scripts ?? {},
    })),
  }
}

const printAffected = affected => {
  console.log(
    JSON.stringify(
      {
        fullRun: affected.fullRun,
        reason: affected.reason,
        baseRef: affected.baseRef,
        files: affected.files,
        workspaces: affected.workspaces.map(workspace => ({
          name: workspace.name,
          dir: workspace.dir,
        })),
      },
      null,
      2
    )
  )
}

const runWorkspaceScript = (scriptName, affected) => {
  if (affected.fullRun) {
    console.log(`Affected graph uncertain: ${affected.reason}`)
    const args = scriptName === 'lint' ? ['lint'] : ['-r', '--if-present', scriptName]
    return run('pnpm', args, { stdio: 'inherit' }).status
  }

  if (affected.workspaces.length === 0) {
    console.log('No affected workspaces.')
    return 0
  }

  if (scriptName === 'lint') {
    const dirs = affected.workspaces.map(workspace => workspace.dir)
    return run('pnpm', ['exec', 'biome', 'lint', ...dirs], { stdio: 'inherit' }).status
  }

  let exitCode = 0
  for (const workspace of affected.workspaces) {
    if (!workspace.scripts?.[scriptName]) {
      continue
    }

    const status = run('pnpm', ['--filter', workspace.name, scriptName], {
      stdio: 'inherit',
    }).status
    if (status !== 0) {
      exitCode = status
      break
    }
  }

  return exitCode
}

const affected = computeAffected()

if (command === 'print') {
  printAffected(affected)
} else if (['lint', 'typecheck', 'test', 'build'].includes(command)) {
  process.exit(runWorkspaceScript(command, affected))
} else {
  console.error('Usage: node scripts/affected-tasks.mjs <print|lint|typecheck|test|build>')
  process.exit(1)
}
