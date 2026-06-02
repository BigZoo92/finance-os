import { describe, expect, it } from 'bun:test'
import { shouldRecoverStaleRun } from './recover-stale-background-runs'

describe('recover stale background runs', () => {
  it('only recovers running rows older than the stale threshold', () => {
    const now = new Date('2026-05-03T01:00:00.000Z')
    const staleStartedAt = new Date('2026-05-03T00:00:00.000Z')
    const freshStartedAt = new Date('2026-05-03T00:55:00.000Z')

    expect(
      shouldRecoverStaleRun({
        status: 'running',
        startedAt: staleStartedAt,
        now,
        staleAfterMs: 30 * 60 * 1000,
      })
    ).toBe(true)
    expect(
      shouldRecoverStaleRun({
        status: 'running',
        startedAt: freshStartedAt,
        now,
        staleAfterMs: 30 * 60 * 1000,
      })
    ).toBe(false)
    expect(
      shouldRecoverStaleRun({
        status: 'success',
        startedAt: staleStartedAt,
        now,
        staleAfterMs: 30 * 60 * 1000,
      })
    ).toBe(false)
  })
})
