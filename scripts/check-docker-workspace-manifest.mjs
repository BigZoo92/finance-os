#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const repoRoot = process.cwd()
const dockerfilePath = join(repoRoot, 'infra/docker/Dockerfile')

const workspacePackagePaths = [
  'apps/api',
  'apps/web',
  'apps/worker',
  'packages/ai',
  'packages/db',
  'packages/env',
  'packages/external-investments',
  'packages/finance-engine',
  'packages/powens',
  'packages/prelude',
  'packages/redis',
  'packages/ui',
]

const runtimeApps = {
  api: 'apps/api',
  worker: 'apps/worker',
}

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))

const packagesByName = new Map(
  workspacePackagePaths.map(packagePath => {
    const manifestPath = join(repoRoot, packagePath, 'package.json')
    const manifest = readJson(manifestPath)
    return [
      manifest.name,
      {
        manifest,
        path: packagePath,
      },
    ]
  })
)

const workspaceDependencyNames = manifest =>
  Object.entries(manifest.dependencies ?? {})
    .filter(([, version]) => typeof version === 'string' && version.startsWith('workspace:'))
    .map(([name]) => name)

const collectWorkspaceDependencyPaths = rootPackagePath => {
  const rootManifest = readJson(join(repoRoot, rootPackagePath, 'package.json'))
  const seen = new Set([rootPackagePath])
  const queue = workspaceDependencyNames(rootManifest)

  for (const dependencyName of queue) {
    const dependency = packagesByName.get(dependencyName)
    if (!dependency || seen.has(dependency.path)) {
      continue
    }

    seen.add(dependency.path)
    queue.push(...workspaceDependencyNames(dependency.manifest))
  }

  return [...seen].sort()
}

const dockerfile = readFileSync(dockerfilePath, 'utf8')

const getStageBlock = stageName => {
  const match = dockerfile.match(
    new RegExp(`FROM\\s+[^\\n]+\\s+AS\\s+${stageName}\\b([\\s\\S]*?)(?=\\nFROM\\s|$)`)
  )
  return match?.[1] ?? ''
}

const assertContains = ({ content, label, path, pattern }) => {
  if (pattern.test(content)) {
    return []
  }

  return [`${label}: missing ${path}`]
}

const copyPackageManifestPattern = packagePath =>
  new RegExp(`COPY\\s+${packagePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/package\\.json\\s+`)

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const copyPackageToBundlePattern = packagePath =>
  new RegExp(`COPY\\s+${escapeRegex(packagePath)}\\s+${escapeRegex(packagePath)}\\b`)

const copyPackageFromBundlePattern = (target, packagePath) =>
  new RegExp(
    `COPY\\s+--from=bundle-${target}\\s+(?:--chown=[^\\s]+\\s+)?/app/${escapeRegex(
      packagePath
    )}\\s+\\.\\/${escapeRegex(packagePath)}\\b`
  )

const manifestPaths = new Set()
for (const appPath of ['apps/api', 'apps/web', 'apps/worker']) {
  for (const packagePath of collectWorkspaceDependencyPaths(appPath)) {
    manifestPaths.add(packagePath)
  }
}

const errors = []
const manifestStage = getStageBlock('manifests')
for (const packagePath of [...manifestPaths].sort()) {
  errors.push(
    ...assertContains({
      content: manifestStage,
      label: 'manifest stage',
      path: `${packagePath}/package.json`,
      pattern: copyPackageManifestPattern(packagePath),
    })
  )
}

for (const [target, appPath] of Object.entries(runtimeApps)) {
  const bundleStage = getStageBlock(`bundle-${target}`)
  const runtimeStage = getStageBlock(target)

  for (const packagePath of collectWorkspaceDependencyPaths(appPath)) {
    errors.push(
      ...assertContains({
        content: bundleStage,
        label: `${target} bundle copy`,
        path: packagePath,
        pattern: copyPackageToBundlePattern(packagePath),
      }),
      ...assertContains({
        content: runtimeStage,
        label: `${target} runtime copy`,
        path: packagePath,
        pattern: copyPackageFromBundlePattern(target, packagePath),
      })
    )
  }
}

if (errors.length > 0) {
  console.error('Docker workspace manifest drift detected:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

const checked = [...manifestPaths]
  .sort()
  .map(packagePath => relative(repoRoot, join(repoRoot, packagePath)))
console.log(`Docker workspace manifest check passed (${checked.length} workspace packages).`)
