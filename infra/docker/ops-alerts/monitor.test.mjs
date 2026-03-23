import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAlertPayload,
  evaluateDiskFreePercent,
  evaluateWorkerHeartbeat,
  is5xxBurstActive,
  isHealthcheckAlertActive,
  nextConsecutiveFailures,
  parseBooleanEnv,
  parsePositiveNumberEnv,
  register5xxEvent,
} from './monitor-lib.mjs'

test('register5xxEvent tracks only 5xx responses inside the rolling window', () => {
  const windowMs = 60_000
  const base = 1_000_000

  let events = []
  events = register5xxEvent(events, base, windowMs, 502)
  events = register5xxEvent(events, base + 10_000, windowMs, 200)
  events = register5xxEvent(events, base + 20_000, windowMs, 503)
  events = register5xxEvent(events, base + 30_000, windowMs, 500)

  assert.equal(events.length, 3)
  assert.equal(is5xxBurstActive(events, base + 30_000, windowMs, 3), true)
  assert.equal(is5xxBurstActive(events, base + 95_000, windowMs, 3), false)
})

test('nextConsecutiveFailures resets to zero after a healthy probe', () => {
  assert.equal(nextConsecutiveFailures(0, false), 1)
  assert.equal(nextConsecutiveFailures(1, false), 2)
  assert.equal(nextConsecutiveFailures(2, true), 0)
  assert.equal(isHealthcheckAlertActive(2, 2), true)
  assert.equal(isHealthcheckAlertActive(1, 2), false)
})

test('evaluateWorkerHeartbeat detects stale and missing heartbeat files', () => {
  assert.deepEqual(
    evaluateWorkerHeartbeat({
      now: 120_000,
      heartbeatTimestamp: Number.NaN,
      staleAfterMs: 30_000,
    }),
    {
      active: true,
      reason: 'missing_or_invalid_timestamp',
      ageMs: null,
    }
  )

  assert.deepEqual(
    evaluateWorkerHeartbeat({
      now: 120_000,
      heartbeatTimestamp: 60_000,
      staleAfterMs: 30_000,
    }),
    {
      active: true,
      reason: 'stale_heartbeat',
      ageMs: 60_000,
    }
  )

  assert.deepEqual(
    evaluateWorkerHeartbeat({
      now: 120_000,
      heartbeatTimestamp: 100_000,
      staleAfterMs: 30_000,
    }),
    {
      active: false,
      reason: 'healthy',
      ageMs: 20_000,
    }
  )
})

test('evaluateDiskFreePercent detects low free capacity and missing stats', () => {
  assert.deepEqual(evaluateDiskFreePercent({ freePercent: 8, thresholdPercent: 10 }), {
    active: true,
    reason: 'low_disk_free_percent',
  })

  assert.deepEqual(evaluateDiskFreePercent({ freePercent: Number.NaN, thresholdPercent: 10 }), {
    active: true,
    reason: 'missing_disk_metric',
  })

  assert.deepEqual(evaluateDiskFreePercent({ freePercent: 12, thresholdPercent: 10 }), {
    active: false,
    reason: 'healthy',
  })
})

test('env parsers preserve sane fallbacks', () => {
  assert.equal(parseBooleanEnv('true', false), true)
  assert.equal(parseBooleanEnv('off', true), false)
  assert.equal(parseBooleanEnv('invalid', true), true)

  assert.equal(parsePositiveNumberEnv('15000', 1), 15000)
  assert.equal(parsePositiveNumberEnv('-1', 7), 7)
  assert.equal(parsePositiveNumberEnv('nope', 7), 7)
})

test('buildAlertPayload keeps the normalized webhook contract stable', () => {
  const payload = buildAlertPayload({
    status: 'triggered',
    family: 'worker_stalled',
    severity: 'critical',
    summary: 'worker stale',
    details: { staleAfterMs: 120_000 },
    timestamp: '2026-03-23T00:00:00.000Z',
  })

  assert.deepEqual(payload, {
    source: 'finance-os',
    status: 'triggered',
    family: 'worker_stalled',
    severity: 'critical',
    summary: 'worker stale',
    details: { staleAfterMs: 120_000 },
    timestamp: '2026-03-23T00:00:00.000Z',
  })
})
