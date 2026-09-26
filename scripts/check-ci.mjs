#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectDesktopScope } from './desktop-scope.mjs'

const VALID_SCOPES = new Set(['auto', 'core', 'desktop', 'full'])

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

export function parseScope(argv) {
  const unsupported = argv.filter(arg => !arg.startsWith('--scope='))
  if (unsupported.length) throw new Error(`Unsupported check:ci argument: ${unsupported[0]}`)
  const scopeArgs = argv.filter(arg => arg.startsWith('--scope='))
  if (scopeArgs.length > 1) throw new Error('check:ci accepts only one --scope argument')
  const scope = scopeArgs.length ? scopeArgs[0].slice('--scope='.length) : 'auto'
  if (!VALID_SCOPES.has(scope)) {
    throw new Error(`Invalid check:ci scope: ${scope || '<empty>'}`)
  }
  return scope
}

export const coreSteps = [
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
    name: 'Root lint',
    args: ['lint'],
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
]

export const desktopSteps = [
  {
    name: 'Build desktop shell',
    args: ['desktop:build'],
  },
]

export function buildStepsForScope(
  selectedScope,
  { env = process.env, detect = detectDesktopScope } = {}
) {
  if (!VALID_SCOPES.has(selectedScope)) throw new Error(`Invalid check:ci scope: ${selectedScope}`)
  if (selectedScope === 'core') {
    return {
      steps: coreSteps,
      desktopDecision: null,
    }
  }

  if (selectedScope === 'desktop') {
    return {
      steps: [coreSteps[0], ...desktopSteps],
      desktopDecision: {
        required: true,
        reason: 'Desktop CI scope requested explicitly.',
      },
    }
  }

  if (selectedScope === 'full') {
    return {
      steps: [...coreSteps, ...desktopSteps],
      desktopDecision: {
        required: true,
        reason: 'Full CI scope requested explicitly.',
      },
    }
  }

  const desktopDecision = detect({
    baseRef: env.FINANCE_OS_DESKTOP_BASE_REF || 'origin/main',
    mode: env.FINANCE_OS_DESKTOP_SCOPE || 'auto',
  })

  return {
    steps: desktopDecision.required ? [...coreSteps, ...desktopSteps] : coreSteps,
    desktopDecision,
  }
}

export function runCheckCi({
  argv = process.argv.slice(2),
  env = process.env,
  spawn = spawnSync,
  logger = console,
  detect = detectDesktopScope,
} = {}) {
  const scope = parseScope(argv)
  const pnpmExec = resolvePnpmExec(env)
  const { steps, desktopDecision } = buildStepsForScope(scope, { env, detect })

  if (desktopDecision && !desktopDecision.required && scope === 'auto') {
    logger.log('\n==> Desktop CI skipped')
    logger.log(desktopDecision.reason)
    logger.log('Use `pnpm check:ci:full` or `pnpm check:ci:desktop` to force Tauri validation.')
  }

  for (const step of steps) {
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

  logger.log(`\ncheck:ci (${scope}) completed successfully.`)
  return { scope, steps, desktopDecision }
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
