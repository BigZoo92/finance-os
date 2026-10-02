import assert from 'node:assert/strict'
import test from 'node:test'
import { ciSteps, runCheckCi } from './check-ci.mjs'

const silentLogger = { log() {} }

test('check:ci rejects arguments', () => {
  for (const argv of [['--scope=core'], ['core']]) {
    assert.throws(
      () => runCheckCi({ argv, env: {}, logger: silentLogger, spawn: () => assert.fail() }),
      /Unsupported check:ci argument/
    )
  }
})

test('CI mirrors the Python gate before build', () => {
  const pythonIndex = ciSteps.findIndex(step => step.args[0] === 'python:check')
  const buildIndex = ciSteps.findIndex(step => step.args.includes('build'))
  assert.ok(pythonIndex >= 0)
  assert.ok(buildIndex > pythonIndex)
})

test('a child terminated by signal fails instead of producing a false success', () => {
  let calls = 0
  assert.throws(
    () =>
      runCheckCi({
        argv: [],
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
        argv: [],
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

test('successful execution includes the root, skill, docs, Python, and build gates', () => {
  const called = []
  const result = runCheckCi({
    argv: [],
    env: {},
    logger: silentLogger,
    spawn: (command, args, options) => {
      called.push({ command, args, options })
      return { status: 0, signal: null }
    },
  })

  assert.equal(result.steps, ciSteps)
  assert.equal(called.length, ciSteps.length)
  assert.ok(called.some(call => call.args.includes('test')))
  assert.ok(called.some(call => call.args.includes('agent:skills:check')))
  assert.ok(called.some(call => call.args.includes('docs:check')))
  assert.ok(called.some(call => call.args.includes('python:check')))
  assert.ok(called.some(call => call.args.includes('build')))
  assert.ok(called.every(call => call.options.env.CI === 'true'))
})
