#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const services = [
  {
    name: 'knowledge-service',
    cwd: 'apps/knowledge-service',
  },
  {
    name: 'quant-service',
    cwd: 'apps/quant-service',
  },
]

const commands = {
  lint: ['run', '--extra', 'dev', 'ruff', 'check', '.'],
  format: ['run', '--extra', 'dev', 'ruff', 'format', '.'],
  'format-check': ['run', '--extra', 'dev', 'ruff', 'format', '--check', '.'],
  test: ['run', '--extra', 'dev', 'pytest'],
}

const commandName = process.argv[2]

if (!commandName || !(commandName in commands)) {
  console.error('Usage: node scripts/python-services.mjs <lint|format|format-check|test>')
  process.exit(1)
}

const run = ({ command, args, cwd, stdio = 'inherit' }) => {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    shell: process.platform === 'win32',
    stdio,
  })

  if (result.error) {
    throw result.error
  }

  return result.status ?? 1
}

const resolveUvCommand = () => {
  const uvStatus = run({
    command: 'uv',
    args: ['--version'],
    cwd: process.cwd(),
    stdio: 'ignore',
  })

  if (uvStatus === 0) {
    return {
      command: 'uv',
      baseArgs: [],
    }
  }

  const pythonUvStatus = run({
    command: 'python',
    args: ['-m', 'uv', '--version'],
    cwd: process.cwd(),
    stdio: 'ignore',
  })

  if (pythonUvStatus === 0) {
    return {
      command: 'python',
      baseArgs: ['-m', 'uv'],
    }
  }

  console.error('uv is required for Python service checks. Install uv or run CI with setup-uv.')
  process.exit(1)
}

const uv = resolveUvCommand()
let exitCode = 0

for (const service of services) {
  console.log(`\n==> Python ${commandName}: ${service.name}`)
  const status = run({
    command: uv.command,
    args: [...uv.baseArgs, ...commands[commandName]],
    cwd: service.cwd,
  })

  if (status !== 0) {
    exitCode = status
    break
  }
}

process.exit(exitCode)
