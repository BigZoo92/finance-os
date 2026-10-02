#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const resolvePnpmExec = env =>
  env.npm_execpath
    ? {
        command: process.execPath,
        baseArgs: [env.npm_execpath],
      }
    : {
        command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
        baseArgs: [],
      }

export const ciSteps = [
  {
    name: 'Install dependencies',
    args: ['install', '--frozen-lockfile'],
  },
  {
    name: 'Panda codegen',
    args: ['panda:codegen'],
  },
  {
    name: 'Root tooling tests',
    args: ['test'],
  },
  {
    name: 'Agent skill projection check',
    args: ['agent:skills:check'],
  },
  {
    name: 'Documentation link check',
    args: ['docs:check'],
  },
  {
    name: 'Root lint (oxlint, type-aware)',
    args: ['lint'],
  },
  {
    name: 'Format check (oxfmt)',
    args: ['format:check'],
  },
  {
    name: 'Docker workspace manifest drift check',
    args: ['docker:check'],
  },
  {
    name: 'Moon graph and constraints',
    args: ['moon:validate'],
  },
  {
    name: 'Workspace lint',
    args: ['-r', '--if-present', 'lint'],
  },
  {
    name: 'Typecheck',
    args: ['-r', '--if-present', 'typecheck'],
  },
  {
    name: 'Database schema check',
    args: ['db:check'],
  },
  {
    name: 'Test',
    args: ['-r', '--if-present', 'test'],
  },
  {
    name: 'Python checks',
    args: ['python:check'],
  },
  {
    name: 'Build',
    args: ['-r', '--if-present', 'build'],
  },
  {
    name: 'Client bundle denylist',
    args: ['check:client-bundle'],
  },
  {
    name: 'Client bundle budget',
    args: ['check:bundle-budget'],
  },
]

export function runCheckCi({
  argv = process.argv.slice(2),
  env = process.env,
  spawn = spawnSync,
  logger = console,
} = {}) {
  if (argv.length) throw new Error(`Unsupported check:ci argument: ${argv[0]}`)
  const pnpmExec = resolvePnpmExec(env)

  for (const step of ciSteps) {
    logger.log(`\n==> ${step.name}`)
    logger.log(`pnpm ${step.args.join(' ')}`)

    const args = [...pnpmExec.baseArgs, ...step.args]
    const result = spawn(pnpmExec.command, args, {
      stdio: 'inherit',
      env: {
        ...env,
        CI: 'true',
      },
    })

    if (result.error) throw result.error
    if (result.status !== 0) {
      const outcome = result.signal ? `signal ${result.signal}` : `status ${result.status ?? 1}`
      const error = new Error(`check:ci step "${step.name}" failed with ${outcome}`)
      error.exitCode = typeof result.status === 'number' && result.status > 0 ? result.status : 1
      throw error
    }
  }

  logger.log('\ncheck:ci completed successfully.')
  return { steps: ciSteps }
}

const main = () => {
  try {
    runCheckCi()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = error?.exitCode ?? 1
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main()
