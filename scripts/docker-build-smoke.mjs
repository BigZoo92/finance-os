#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const isCi = process.env.CI === 'true'

const run = (command, args, options = {}) =>
  spawnSync(command, args, {
    cwd: process.cwd(),
    shell: process.platform === 'win32',
    stdio: options.stdio ?? 'inherit',
    env: {
      ...process.env,
      DOCKER_BUILDKIT: '1',
    },
  })

const dockerVersion = run('docker', ['version'], { stdio: 'pipe' })
if ((dockerVersion.status ?? 1) !== 0) {
  const message =
    'Docker daemon is unavailable; skipping local Docker build smoke. CI must run this check with Docker available.'
  if (isCi) {
    console.error(message)
    process.exit(dockerVersion.status ?? 1)
  }

  console.warn(message)
  process.exit(0)
}

const rootTargets = ['web', 'api', 'worker']
for (const target of rootTargets) {
  console.log(`\n==> Docker build smoke: infra/docker/Dockerfile target=${target}`)
  const result = run('docker', ['build', '--target', target, '-f', 'infra/docker/Dockerfile', '.'])
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

const pythonServices = [
  ['knowledge-service', 'apps/knowledge-service/Dockerfile', 'apps/knowledge-service'],
  ['quant-service', 'apps/quant-service/Dockerfile', 'apps/quant-service'],
]

for (const [name, dockerfile, context] of pythonServices) {
  console.log(`\n==> Docker build smoke: ${name}`)
  const result = run('docker', ['build', '-f', dockerfile, context])
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}
