import assert from 'node:assert/strict'
import test from 'node:test'
import { buildStepsForScope, coreSteps, parseScope, runCheckCi } from './check-ci.mjs'

const silentLogger = { log() {} }

test('check:ci scope parsing is strict', () => {
  assert.equal(parseScope([]), 'auto')
  for (const scope of ['auto', 'core', 'desktop', 'full']) {
    assert.equal(parseScope([`--scope=${scope}`]), scope)
  }
  for (const argv of [['--scope=ful'], ['--scope='], ['core'], ['--scope=core', '--scope=full']]) {
    assert.throws(() => parseScope(argv), /Invalid|Unsupported|only one/)
  }
})

test('core CI mirrors the Python gate before build and full scope adds desktop', () => {
  const pythonIndex = coreSteps.findIndex(step => step.args[0] === 'python:check')
  const buildIndex = coreSteps.findIndex(step => step.args.includes('build'))
  assert.ok(pythonIndex >= 0)
  assert.ok(buildIndex > pythonIndex)

  const full = buildStepsForScope('full')
  assert.equal(full.steps.at(-1).args[0], 'desktop:build')
  const auto = buildStepsForScope('auto', {
    env: {},
    detect: () => ({ required: false, reason: 'not needed' }),
  })
  assert.equal(auto.steps, coreSteps)
  assert.equal(auto.desktopDecision.required, false)
})

test('a child terminated by signal fails instead of producing a false success', () => {
  let calls = 0
  assert.throws(
    () =>
      runCheckCi({
        argv: ['--scope=core'],
        env: {},
        logger: silentLogger,
        spawn: () => {
          calls += 1
          return { status: null, signal: 'SIGTERM' }
        },
      }),
    error => error.exitCode === 1 && /signal SIGTERM/.test(error.message)
  )
  assert.equal(calls, 1)
})

test('a nonzero child status is preserved and stops subsequent steps', () => {
  let calls = 0
  assert.throws(
    () =>
      runCheckCi({
        argv: ['--scope=core'],
        env: {},
        logger: silentLogger,
        spawn: () => {
          calls += 1
          return { status: 23, signal: null }
        },
      }),
    error => error.exitCode === 23 && /status 23/.test(error.message)
  )
  assert.equal(calls, 1)
})

test('successful core execution includes the root, skill, docs, Python, and build gates', () => {
  const called = []
  const result = runCheckCi({
    argv: ['--scope=core'],
    env: {},
    logger: silentLogger,
    spawn: (command, args, options) => {
      called.push({ command, args, options })
      return { status: 0, signal: null }
    },
  })

  assert.equal(result.scope, 'core')
  assert.equal(called.length, coreSteps.length)
  assert.ok(called.some(call => call.args.includes('test')))
  assert.ok(called.some(call => call.args.includes('agent:skills:check')))
  assert.ok(called.some(call => call.args.includes('docs:check')))
  assert.ok(called.some(call => call.args.includes('python:check')))
  assert.ok(called.some(call => call.args.includes('build')))
  assert.ok(called.every(call => call.options.env.CI === 'true'))
})
