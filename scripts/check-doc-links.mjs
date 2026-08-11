#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { lstat, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const listed = spawnSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.md'],
  { cwd: repoRoot, encoding: 'utf8' }
)
if (listed.error) throw listed.error
if (listed.status !== 0)
  throw new Error(listed.stderr.trim() || 'Unable to list repository Markdown')

const markdownFiles = []
for (const path of listed.stdout.split(/\r?\n/).filter(Boolean)) {
  const fullPath = join(repoRoot, path)
  try {
    const stats = await lstat(fullPath)
    if (stats.isFile() && !stats.isSymbolicLink()) markdownFiles.push(fullPath)
  } catch {
    // Staged or unstaged deletion: there is no document left to validate.
  }
}

const failures = []
for (const file of markdownFiles.sort()) {
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/)
  let fence = null
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const fenceMatch = line.match(/^\s*(```+|~~~+)/)
    if (fenceMatch) {
      fence = fence ? null : fenceMatch[1][0]
      continue
    }
    if (fence) continue

    const links = line.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+['"][^'"]*['"])?\)/g)
    for (const match of links) {
      const raw = match[1].replace(/^<|>$/g, '')
      if (!raw || raw.startsWith('#') || /^(?:https?:|mailto:|data:)/i.test(raw)) continue
      if (/^(?:file:|[a-z]:[\\/])/i.test(raw)) {
        failures.push(`${relative(repoRoot, file)}:${index + 1}: non-portable link ${raw}`)
        continue
      }
      if (raw.startsWith('/')) continue // Product route, not a repository file.
      const targetPart = raw.split('#', 1)[0].split('?', 1)[0]
      let decoded
      try {
        decoded = decodeURIComponent(targetPart)
      } catch {
        failures.push(`${relative(repoRoot, file)}:${index + 1}: invalid encoded link ${raw}`)
        continue
      }
      const target = resolve(dirname(file), decoded)
      try {
        await lstat(target)
      } catch {
        failures.push(`${relative(repoRoot, file)}:${index + 1}: missing ${raw}`)
      }
    }
  }
}

if (failures.length) {
  console.error(`Documentation link check failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Documentation link check passed (${markdownFiles.length} Markdown files).`)
}
