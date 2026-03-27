import { describe, expect, it } from 'bun:test'
import { shouldRunReconnectRecoverySync } from './reconnect-recovery'

describe('shouldRunReconnectRecoverySync', () => {
  it('allows non reconnect_required connections immediately', () => {
    expect(
      shouldRunReconnectRecoverySync({
        status: 'connected',
        lastFailedAt: null,
        lastSyncAttemptAt: null,
        now: new Date('2026-03-27T12:00:00.000Z'),
      })
    ).toBe(true)
  })

  it('blocks reconnect_required retries during the cooldown window', () => {
    expect(
      shouldRunReconnectRecoverySync({
        status: 'reconnect_required',
        lastFailedAt: '2026-03-27T08:00:00.000Z',
        lastSyncAttemptAt: '2026-03-27T08:05:00.000Z',
        now: new Date('2026-03-27T20:00:00.000Z'),
      })
    ).toBe(false)
  })

  it('allows reconnect_required retries after cooldown', () => {
    expect(
      shouldRunReconnectRecoverySync({
        status: 'reconnect_required',
        lastFailedAt: '2026-03-25T08:00:00.000Z',
        lastSyncAttemptAt: '2026-03-25T08:05:00.000Z',
        now: new Date('2026-03-27T20:00:00.000Z'),
      })
    ).toBe(true)
  })

  it('fails open when reconnect timestamps are absent', () => {
    expect(
      shouldRunReconnectRecoverySync({
        status: 'reconnect_required',
        lastFailedAt: null,
        lastSyncAttemptAt: null,
        now: new Date('2026-03-27T20:00:00.000Z'),
      })
    ).toBe(true)
  })
})
