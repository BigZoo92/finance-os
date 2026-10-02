#!/usr/bin/env node

import {
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rmdir,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CORE_SCHEMA, load as parseYaml } from 'js-yaml'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const CANONICAL_SKILLS_ROOT = join(REPO_ROOT, '.agentic', 'source', 'skills')
export const PROJECTION_ROOTS = [
  join(REPO_ROOT, '.claude', 'skills'),
  join(REPO_ROOT, '.agents', 'skills'),
]

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i
const containsWindowsControl = value =>
  [...value].some(character => character.codePointAt(0) <= 0x1f)
const containsInvalidYamlControl = value =>
  [...value].some(character => {
    const code = character.codePointAt(0)
    return (
      code <= 0x08 ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      (code >= 0x7f && code <= 0x84) ||
      (code >= 0x86 && code <= 0x9f)
    )
  })

export const validatePortableEntryNames = ({ names, parent }) => {
  const seen = new Map()
  for (const name of names) {
    if (
      /[<>:"/\\|?*]/.test(name) ||
      containsWindowsControl(name) ||
      /[ .]$/.test(name) ||
      WINDOWS_RESERVED_NAME.test(name)
    ) {
      throw new Error(`Canonical skill entry is not Windows-portable: ${join(parent, name)}`)
    }
    const key = name.normalize('NFC').toLowerCase()
    const previous = seen.get(key)
    if (previous) {
      throw new Error(
        `Canonical skill entries collide on case-insensitive filesystems: ${join(parent, previous)} and ${join(parent, name)}`
      )
    }
    seen.set(key, name)
  }
}

const lstatOrNull = async path => {
  try {
    return await lstat(path)
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return null
    throw error
  }
}

const exists = async path => (await lstatOrNull(path)) !== null

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

const assertPhysicalDirectory = async ({ path, label, allowMissing = false }) => {
  const entry = await lstatOrNull(path)
  if (!entry) {
    if (allowMissing) return
    throw new Error(`${label} does not exist: ${path}`)
  }
  if (entry.isSymbolicLink()) throw new Error(`${label} must not be a symlink or junction: ${path}`)
  if (!entry.isDirectory()) throw new Error(`${label} must be a directory: ${path}`)
}

const assertPhysicalPath = async ({ path, parent, label, allowMissing = false }) => {
  assertInside({ child: path, parent, label })
  const segments = relative(resolve(parent), resolve(path)).split(sep)
  let current = resolve(parent)

  for (const segment of ['', ...segments]) {
    if (segment) current = join(current, segment)
    const entry = await lstatOrNull(current)
    if (!entry) {
      if (allowMissing) return
      throw new Error(`${label} does not exist: ${current}`)
    }
    if (entry.isSymbolicLink()) {
      throw new Error(`${label} has a symlink or junction path component: ${current}`)
    }
    if (!entry.isDirectory())
      throw new Error(`${label} path component is not a directory: ${current}`)
  }
}

const assertRealPathInside = async ({ child, parent, label }) => {
  const [physicalChild, physicalParent] = await Promise.all([realpath(child), realpath(parent)])
  assertInside({ child: physicalChild, parent: physicalParent, label })
}

export const assertOwnedTarget = async ({ targetRoot, allowedTargetRoots, repoRoot }) => {
  assertInside({ child: targetRoot, parent: repoRoot, label: 'Projection root' })
  const allowed = new Set(allowedTargetRoots.map(pathKey))
  if (!allowed.has(pathKey(targetRoot))) {
    throw new Error(`Refusing unmanaged projection root: ${resolve(targetRoot)}`)
  }
  await assertPhysicalPath({
    path: targetRoot,
    parent: repoRoot,
    label: 'Projection root',
    allowMissing: true,
  })
  if (await exists(targetRoot)) {
    await assertRealPathInside({ child: targetRoot, parent: repoRoot, label: 'Projection root' })
  }
}

const parseFrontmatter = ({ content, directoryName, path }) => {
  const text = content.toString('utf8')
  if (content[0] === 0xef || !/^---\r?\n/.test(text)) {
    throw new Error(`SKILL.md must start with YAML frontmatter at byte 0: ${path}`)
  }
  const normalized = text.replaceAll('\r\n', '\n')
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)
  if (!match) throw new Error(`Invalid YAML frontmatter boundary: ${path}`)
  if (containsInvalidYamlControl(match[1])) {
    throw new Error(`Invalid YAML control character in frontmatter: ${path}`)
  }

  let document
  try {
    document = parseYaml(match[1], { schema: CORE_SCHEMA, json: false })
  } catch (error) {
    throw new Error(`Invalid YAML frontmatter in ${path}: ${error.message}`, { cause: error })
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error(`SKILL.md frontmatter must be a mapping: ${path}`)
  }

  const values = new Map()
  for (const [key, value] of Object.entries(document)) {
    if (!['name', 'description'].includes(key)) {
      throw new Error(`SKILL.md frontmatter allows only name and description: ${path}`)
    }
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Skill ${key} must be a non-empty string: ${path}`)
    }
    values.set(key, value)
  }

  const name = values.get('name') ?? ''
  const description = values.get('description') ?? ''
  if (name.length > 64) throw new Error(`Skill name must be at most 64 characters: ${path}`)
  if (description.length > 1024) {
    throw new Error(`Skill description must be at most 1024 characters: ${path}`)
  }
  if (!name || name !== directoryName) {
    throw new Error(`Skill name must equal its directory (${directoryName}): ${path}`)
  }
  if (!description) throw new Error(`Skill description is required: ${path}`)
  return { name, description }
}

const walkSourceDirectory = async ({ current, skillRoot, files }) => {
  const entries = await readdir(current, { withFileTypes: true })
  validatePortableEntryNames({ names: entries.map(entry => entry.name), parent: current })
  entries.sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    const fullPath = join(current, entry.name)
    const stats = await lstat(fullPath)
    if (stats.isSymbolicLink())
      throw new Error(`Canonical skills cannot contain links: ${fullPath}`)
    if (stats.isDirectory()) {
      await walkSourceDirectory({ current: fullPath, skillRoot, files })
      continue
    }
    if (!stats.isFile()) throw new Error(`Unsupported canonical skill entry: ${fullPath}`)
    files.set(relative(skillRoot, fullPath).split(sep).join('/'), await readFile(fullPath))
  }
}

export const readCanonicalSkills = async sourceRoot => {
  await assertPhysicalDirectory({ path: sourceRoot, label: 'Canonical skill root' })
  const entries = await readdir(sourceRoot, { withFileTypes: true })
  validatePortableEntryNames({ names: entries.map(entry => entry.name), parent: sourceRoot })
  entries.sort((a, b) => a.name.localeCompare(b.name))
  const skills = []

  for (const entry of entries) {
    const skillRoot = join(sourceRoot, entry.name)
    const stats = await lstat(skillRoot)
    if (stats.isSymbolicLink() || !stats.isDirectory() || !SKILL_NAME.test(entry.name)) {
      throw new Error(
        `Canonical root may contain only flat kebab-case skill directories: ${skillRoot}`
      )
    }
    const skillPath = join(skillRoot, 'SKILL.md')
    if (!(await exists(skillPath))) throw new Error(`Missing SKILL.md: ${skillRoot}`)
    const files = new Map()
    await walkSourceDirectory({ current: skillRoot, skillRoot, files })
    const skillContent = files.get('SKILL.md')
    const metadata = parseFrontmatter({
      content: skillContent,
      directoryName: entry.name,
      path: skillPath,
    })
    skills.push({ ...metadata, files })
  }

  if (skills.length === 0) throw new Error(`No canonical skills found in ${sourceRoot}`)
  return skills
}

const buildExpected = skills => {
  const files = new Map()
  const directories = new Set()
  for (const skill of skills) {
    directories.add(skill.name)
    for (const [withinSkill, content] of skill.files) {
      const rel = `${skill.name}/${withinSkill}`
      files.set(rel, content)
      const parts = rel.split('/')
      for (let i = 1; i < parts.length; i += 1) directories.add(parts.slice(0, i).join('/'))
    }
  }
  return { files, directories }
}

const walkProjection = async ({ current, root, actual }) => {
  const entries = await readdir(current, { withFileTypes: true })
  entries.sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    const fullPath = join(current, entry.name)
    const rel = relative(root, fullPath).split(sep).join('/')
    const stats = await lstat(fullPath)
    if (stats.isSymbolicLink()) {
      actual.set(rel, { type: 'link', fullPath })
    } else if (stats.isDirectory()) {
      actual.set(rel, { type: 'directory', fullPath })
      await walkProjection({ current: fullPath, root, actual })
    } else if (stats.isFile()) {
      actual.set(rel, { type: 'file', fullPath, content: await readFile(fullPath) })
    } else {
      actual.set(rel, { type: 'other', fullPath })
    }
  }
}

export const inspectProjection = async ({ targetRoot, expected }) => {
  const actual = new Map()
  if (await exists(targetRoot))
    await walkProjection({ current: targetRoot, root: targetRoot, actual })

  const report = { ok: [], drifted: [], missing: [], extra: [] }
  for (const [rel, expectedContent] of expected.files) {
    const entry = actual.get(rel)
    if (!entry) {
      report.missing.push(rel)
    } else if (entry.type !== 'file' || !entry.content.equals(expectedContent)) {
      report.drifted.push(rel)
    } else {
      report.ok.push(rel)
    }
  }

  for (const [rel, entry] of actual) {
    if (entry.type === 'directory') {
      if (!expected.directories.has(rel) && !expected.files.has(rel)) report.extra.push(rel)
    } else if (!expected.files.has(rel)) {
      report.extra.push(rel)
    }
  }

  for (const key of Object.keys(report)) report[key].sort()
  return { report, actual }
}

const removeEntry = async ({ fullPath, boundary }) => {
  assertInside({ child: fullPath, parent: boundary, label: 'Deletion target' })
  if (!(await exists(fullPath))) return
  const stats = await lstat(fullPath)
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    await unlink(fullPath)
    return
  }
  const children = await readdir(fullPath)
  for (const child of children) await removeEntry({ fullPath: join(fullPath, child), boundary })
  await rmdir(fullPath)
}

const syncProjection = async ({ targetRoot, expected, inspection }) => {
  const removable = new Set(inspection.report.extra)
  for (const rel of inspection.report.drifted) {
    const entry = inspection.actual.get(rel)
    if (entry && entry.type !== 'file') removable.add(rel)
  }
  for (const rel of [...removable].sort((a, b) => b.split('/').length - a.split('/').length)) {
    await removeEntry({ fullPath: join(targetRoot, ...rel.split('/')), boundary: targetRoot })
  }

  for (const [rel, content] of expected.files) {
    const fullPath = join(targetRoot, ...rel.split('/'))
    await mkdir(dirname(fullPath), { recursive: true })
    const entry = inspection.actual.get(rel)
    if (entry?.type !== 'file' || !entry.content.equals(content)) await writeFile(fullPath, content)
  }

  const after = await inspectProjection({ targetRoot, expected })
  if (after.report.drifted.length || after.report.missing.length || after.report.extra.length) {
    throw new Error(`Projection did not converge: ${targetRoot}`)
  }
  return after.report
}

export const reconcileSkills = async ({
  sourceRoot,
  targetRoots,
  allowedTargetRoots,
  repoRoot,
  write = false,
}) => {
  if (!Array.isArray(allowedTargetRoots) || allowedTargetRoots.length === 0) {
    throw new Error('allowedTargetRoots is required and must be non-empty')
  }
  await validateSkillRoots({ sourceRoot, targetRoots, allowedTargetRoots, repoRoot })
  const skills = await readCanonicalSkills(sourceRoot)
  const expected = buildExpected(skills)
  const targets = []

  for (const targetRoot of targetRoots) {
    const inspection = await inspectProjection({ targetRoot, expected })
    targets.push({ targetRoot, inspection, before: inspection.report })
  }

  if (write) {
    for (const targetRoot of targetRoots) await mkdir(targetRoot, { recursive: true })
    await validateSkillRoots({ sourceRoot, targetRoots, allowedTargetRoots, repoRoot })
  }

  for (const target of targets) {
    target.after = write
      ? await syncProjection({
          targetRoot: target.targetRoot,
          expected,
          inspection: target.inspection,
        })
      : target.before
    delete target.inspection
  }

  return { skills, expected, targets }
}

export const validateSkillRoots = async ({
  sourceRoot,
  targetRoots,
  allowedTargetRoots,
  repoRoot,
}) => {
  if (!Array.isArray(allowedTargetRoots) || allowedTargetRoots.length === 0) {
    throw new Error('allowedTargetRoots is required and must be non-empty')
  }
  await assertPhysicalPath({
    path: sourceRoot,
    parent: repoRoot,
    label: 'Canonical skill root',
  })
  for (const targetRoot of targetRoots) {
    await assertOwnedTarget({ targetRoot, allowedTargetRoots, repoRoot })
  }
}

const totals = targets => {
  const result = { ok: 0, drifted: 0, missing: 0, extra: 0 }
  for (const target of targets) {
    for (const key of Object.keys(result)) result[key] += target.before[key].length
  }
  return result
}

const printReport = (result, { reconciled = false } = {}) => {
  for (const target of result.targets) {
    const label = relative(REPO_ROOT, target.targetRoot).split(sep).join('/')
    const report = reconciled ? target.after : target.before
    const counts = Object.fromEntries(
      Object.entries(report).map(([key, values]) => [key, values.length])
    )
    console.log(
      `${label}: ${counts.ok} ok, ${counts.drifted} drifted, ${counts.missing} missing, ${counts.extra} extra`
    )
  }
}

const main = async () => {
  const command = process.argv[2] ?? 'check'
  if (command === 'list') {
    const skills = await readCanonicalSkills(CANONICAL_SKILLS_ROOT)
    for (const skill of skills) console.log(`${skill.name}\t${skill.description}`)
    return
  }
  if (!['check', 'sync'].includes(command)) {
    throw new Error('Usage: node scripts/sync-skills.mjs <check|sync|list>')
  }

  const result = await reconcileSkills({
    sourceRoot: CANONICAL_SKILLS_ROOT,
    targetRoots: PROJECTION_ROOTS,
    allowedTargetRoots: PROJECTION_ROOTS,
    repoRoot: REPO_ROOT,
    write: command === 'sync',
  })
  printReport(result, { reconciled: command === 'sync' })
  const dirty = totals(result.targets)
  if (command === 'check' && (dirty.drifted || dirty.missing || dirty.extra)) process.exitCode = 1
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
