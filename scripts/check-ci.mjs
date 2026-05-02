#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { detectDesktopScope } from './desktop-scope.mjs'

const pnpmExec = process.env.npm_execpath
  ? {
      command: process.execPath,
      baseArgs: [process.env.npm_execpath],
    }
  : {
      command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      baseArgs: [],
    }

function parseScope(argv) {
  const scopeArg = argv.find((arg) => arg.startsWith('--scope='))
  if (!scopeArg) return 'auto'
  return scopeArg.slice('--scope='.length)
}

const scope = parseScope(process.argv.slice(2))

const coreSteps = [
  {
    name: 'Install dependencies',
    args: ['install', '--frozen-lockfile'],
  },
  {
    name: 'Root lint (known failing baseline)',
    args: ['lint'],
    allowFailure: true,
    failureMessage:
      'Root Biome lint is intentionally visible here and in CI until the existing baseline is fixed.',
  },
  {
    name: 'Docker workspace manifest drift check',
    args: ['docker:check'],
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
    name: 'Test',
    args: ['-r', '--if-present', 'test'],
  },
  {
    name: 'Build',
    args: ['-r', '--if-present', 'build'],
  },
]

const desktopSteps = [
  {
    name: 'Build desktop shell',
    args: ['desktop:build'],
  },
]

function buildStepsForScope(selectedScope) {
  if (selectedScope === 'core') {
    return {
      steps: coreSteps,
      desktopDecision: null,
    }
  }

  if (selectedScope === 'desktop') {
    return {
      steps: [
        coreSteps[0],
        ...desktopSteps,
      ],
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

  const desktopDecision = detectDesktopScope({
    baseRef: process.env.FINANCE_OS_DESKTOP_BASE_REF || 'origin/main',
    mode: process.env.FINANCE_OS_DESKTOP_SCOPE || 'auto',
  })

  return {
    steps: desktopDecision.required ? [...coreSteps, ...desktopSteps] : coreSteps,
    desktopDecision,
  }
}

const { steps, desktopDecision } = buildStepsForScope(scope)
const knownFailingChecks = []

if (desktopDecision && !desktopDecision.required && scope === 'auto') {
  console.log('\n==> Desktop CI skipped')
  console.log(desktopDecision.reason)
  console.log('Use `pnpm check:ci:full` or `pnpm check:ci:desktop` to force Tauri validation.')
}

for (const step of steps) {
  console.log(`\n==> ${step.name}`)
  console.log(`pnpm ${step.args.join(' ')}`)

  const result = spawnSync(pnpmExec.command, [...pnpmExec.baseArgs, ...step.args], {
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: 'true',
    },
  })

  if (result.error) {
    throw result.error
  }

  if (typeof result.status === 'number' && result.status !== 0 && step.allowFailure) {
    knownFailingChecks.push({
      name: step.name,
      message: step.failureMessage,
    })
    console.log(`\nKnown failing check did not pass: ${step.name}`)
    console.log(step.failureMessage)
    continue
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status)
  }
}

if (knownFailingChecks.length > 0) {
  console.log('\nKnown failing checks reported explicitly:')
  for (const check of knownFailingChecks) {
    console.log(`- ${check.name}: ${check.message}`)
  }
}

console.log(
  `\ncheck:ci (${scope}) completed successfully${
    knownFailingChecks.length > 0 ? ' with known failing checks reported explicitly' : ''
  }.`
)
