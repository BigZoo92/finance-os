#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_GITNEXUS_CLI = join(REPO_ROOT, 'node_modules', 'gitnexus', 'dist', 'cli', 'index.js')
const DEFAULT_SYNC_SCRIPT = join(REPO_ROOT, 'scripts', 'sync-skills.mjs')
const ALLOWED_FLAGS = new Set(['--embeddings', '--force', '--verbose'])
const INSTRUCTION_FILES = ['AGENTS.md', 'CLAUDE.md']
const PROJECTION_ROOTS = [join('.claude', 'skills'), join('.agents', 'skills')]

const lstatOrNull = path => {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return null
    throw error
  }
}

const pathKey = path => {
  const normalized = resolve(path)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

const assertInside = ({ child, parent, label }) => {
  const rel = relative(resolve(parent), resolve(child))
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) {
    throw new Error(`${label} must be a strict descendant of ${resolve(parent)}: ${resolve(child)}`)
  }
}

const assertPhysicalDirectory = ({ path, label }) => {
  const stats = lstatOrNull(path)
  if (!stats) throw new Error(`${label} does not exist: ${path}`)
  if (stats.isSymbolicLink()) throw new Error(`${label} must not be a symlink or junction: ${path}`)
  if (!stats.isDirectory()) throw new Error(`${label} must be a directory: ${path}`)
}

const assertPhysicalFile = ({ path, label, allowMissing = false }) => {
  const stats = lstatOrNull(path)
  if (!stats) {
    if (allowMissing) return
    throw new Error(`${label} does not exist: ${path}`)
  }
  if (stats.isSymbolicLink()) throw new Error(`${label} must not be a symlink: ${path}`)
  if (!stats.isFile()) throw new Error(`${label} must be a regular file: ${path}`)
}

const assertPhysicalPath = ({ child, parent, label }) => {
  assertInside({ child, parent, label })
  const parts = relative(resolve(parent), resolve(child)).split(sep)
  let current = resolve(parent)
  assertPhysicalDirectory({ path: current, label })
  for (const part of parts) {
    current = join(current, part)
    assertPhysicalDirectory({ path: current, label })
  }
}

const assertPhysicalTree = ({ root, repoRoot }) => {
  assertPhysicalPath({ child: root, parent: repoRoot, label: 'Skill projection' })
  const visit = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name)
      const stats = lstatSync(fullPath)
      if (stats.isSymbolicLink()) {
        throw new Error(`Skill projection must not contain links: ${fullPath}`)
      }
      if (stats.isDirectory()) {
        visit(fullPath)
      } else if (!stats.isFile()) {
        throw new Error(`Skill projection contains an unsupported entry: ${fullPath}`)
      }
    }
  }
  visit(root)
}

export class CommandExecutionError extends Error {
  constructor({ command, args, status, signal }) {
    const outcome = signal ? `signal ${signal}` : `status ${status ?? 1}`
    super(`Command failed with ${outcome}: ${command} ${args.join(' ')}`)
    this.name = 'CommandExecutionError'
    this.exitCode = typeof status === 'number' && status > 0 ? status : 1
    this.status = status
    this.signal = signal
  }
}

const execute = ({ command, args, cwd, spawn = spawnSync, capture = false }) => {
  const result = spawn(command, args, {
    cwd,
    encoding: capture ? 'utf8' : undefined,
    env: process.env,
    stdio: capture ? 'pipe' : 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new CommandExecutionError({
      command,
      args,
      status: result.status,
      signal: result.signal,
    })
  }
  return result
}

export const validateForwardedArgs = forwarded => {
  const flags = []
  for (const arg of forwarded) {
    if (arg === '--skills' || arg.startsWith('--skills=')) {
      throw new Error('Static GitNexus skill generation is intentionally disabled; omit --skills.')
    }
    if (!ALLOWED_FLAGS.has(arg)) {
      throw new Error(`Unsupported GitNexus refresh argument: ${arg}`)
    }
    if (!flags.includes(arg)) flags.push(arg)
  }
  return flags
}

export const buildAnalyzeArgs = ({ forwarded, repoRoot, dirty, embeddingCount }) => {
  const flags = validateForwardedArgs(forwarded)
  const explicitlyRequestedEmbeddings = flags.includes('--embeddings')
  if (embeddingCount > 0 && !flags.includes('--embeddings')) flags.push('--embeddings')
  if (
    (dirty || (explicitlyRequestedEmbeddings && embeddingCount === 0)) &&
    !flags.includes('--force')
  ) {
    flags.push('--force')
  }
  return ['analyze', ...flags, resolve(repoRoot)]
}

const readEmbeddingCount = repoRoot => {
  const metaPath = join(repoRoot, '.gitnexus', 'meta.json')
  if (!existsSync(metaPath)) return 0
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    const count = Number(meta?.stats?.embeddings ?? 0)
    return Number.isFinite(count) && count > 0 ? count : 0
  } catch {
    return 0
  }
}

const isWorktreeDirty = ({ repoRoot, spawn }) => {
  const result = execute({
    command: 'git',
    args: ['status', '--porcelain=v1', '--untracked-files=normal'],
    cwd: repoRoot,
    spawn,
    capture: true,
  })
  return Boolean(result.stdout?.trim())
}

const snapshotInstructionFile = path => {
  assertPhysicalFile({ path, label: 'Instruction file', allowMissing: true })
  return { path, content: existsSync(path) ? readFileSync(path) : null }
}

const restoreInstructionFile = snapshot => {
  const stats = lstatOrNull(snapshot.path)
  if (snapshot.content === null) {
    if (!stats) return
    if (stats.isSymbolicLink() || stats.isFile()) {
      unlinkSync(snapshot.path)
      return
    }
    throw new Error(`Refusing to remove unexpected instruction entry: ${snapshot.path}`)
  }

  if (stats?.isSymbolicLink()) {
    unlinkSync(snapshot.path)
  } else if (stats && !stats.isFile()) {
    throw new Error(`Refusing to overwrite unexpected instruction entry: ${snapshot.path}`)
  } else if (stats && readFileSync(snapshot.path).equals(snapshot.content)) {
    return
  }
  writeFileSync(snapshot.path, snapshot.content)
}

const throwRefreshErrors = ({ primaryError, cleanupErrors }) => {
  if (!primaryError && cleanupErrors.length === 0) return
  if (primaryError && cleanupErrors.length === 0) throw primaryError
  if (!primaryError && cleanupErrors.length === 1) throw cleanupErrors[0]

  const errors = primaryError ? [primaryError, ...cleanupErrors] : cleanupErrors
  const message = errors.map(error => error.message).join('; cleanup: ')
  const aggregate = new AggregateError(errors, message)
  aggregate.exitCode = primaryError?.exitCode ?? 1
  throw aggregate
}

export const refreshGitNexus = ({
  repoRoot = REPO_ROOT,
  gitnexusCli = DEFAULT_GITNEXUS_CLI,
  syncScript = DEFAULT_SYNC_SCRIPT,
  forwarded = [],
  spawn = spawnSync,
} = {}) => {
  const resolvedRepoRoot = resolve(repoRoot)
  const validatedFlags = validateForwardedArgs(forwarded)
  assertPhysicalDirectory({ path: resolvedRepoRoot, label: 'Repository root' })
  assertPhysicalFile({ path: gitnexusCli, label: 'GitNexus CLI' })
  assertPhysicalFile({ path: syncScript, label: 'Skill sync script' })
  assertPhysicalFile({
    path: join(resolvedRepoRoot, '.gitignore'),
    label: 'Git ignore file',
    allowMissing: true,
  })

  const snapshots = INSTRUCTION_FILES.map(name =>
    snapshotInstructionFile(join(resolvedRepoRoot, name))
  )
  let primaryError = null
  const cleanupErrors = []
  let analyzeArgs = null

  try {
    execute({
      command: process.execPath,
      args: [syncScript, 'sync'],
      cwd: resolvedRepoRoot,
      spawn,
    })
    for (const projection of PROJECTION_ROOTS) {
      assertPhysicalTree({ root: join(resolvedRepoRoot, projection), repoRoot: resolvedRepoRoot })
    }

    analyzeArgs = buildAnalyzeArgs({
      forwarded: validatedFlags,
      repoRoot: resolvedRepoRoot,
      dirty: isWorktreeDirty({ repoRoot: resolvedRepoRoot, spawn }),
      embeddingCount: readEmbeddingCount(resolvedRepoRoot),
    })
    execute({
      command: process.execPath,
      args: [gitnexusCli, ...analyzeArgs],
      cwd: resolvedRepoRoot,
      spawn,
    })
  } catch (error) {
    primaryError = error
  } finally {
    for (const snapshot of snapshots) {
      try {
        restoreInstructionFile(snapshot)
      } catch (error) {
        cleanupErrors.push(error)
      }
    }
    try {
      execute({
        command: process.execPath,
        args: [syncScript, 'sync'],
        cwd: resolvedRepoRoot,
        spawn,
      })
      for (const projection of PROJECTION_ROOTS) {
        assertPhysicalTree({ root: join(resolvedRepoRoot, projection), repoRoot: resolvedRepoRoot })
      }
    } catch (error) {
      cleanupErrors.push(error)
    }
  }

  throwRefreshErrors({ primaryError, cleanupErrors })
  return { analyzeArgs }
}

const main = () => {
  try {
    refreshGitNexus({ forwarded: process.argv.slice(2) })
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = error?.exitCode ?? 1
  }
}

if (pathKey(process.argv[1] ?? '') === pathKey(fileURLToPath(import.meta.url))) main()
