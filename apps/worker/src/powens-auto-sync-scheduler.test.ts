import { describe, expect, it } from 'bun:test'
import { startPowensAutoSyncScheduler } from './powens-auto-sync-scheduler'

describe('startPowensAutoSyncScheduler', () => {
  it('returns null with an explicit reason when auto-sync is disabled', () => {
    const events: Array<Record<string, unknown>> = []

    const timer = startPowensAutoSyncScheduler({
      externalIntegrationsSafeMode: false,
      autoSyncEnabled: false,
      intervalMs: 1000,
      trigger: async () => undefined,
      log: event => {
        events.push(event)
      },
    })

    expect(timer).toBeNull()
    expect(events[0]?.reason).toBe('WORKER_AUTO_SYNC_ENABLED=false')
  })

  it('starts the interval when auto-sync is enabled', () => {
    const events: Array<Record<string, unknown>> = []
    const intervals: number[] = []

    const timer = startPowensAutoSyncScheduler({
      externalIntegrationsSafeMode: false,
      autoSyncEnabled: true,
      intervalMs: 900000,
      trigger: async () => undefined,
      log: event => {
        events.push(event)
      },
      setIntervalFn: ((handler: TimerHandler, timeout?: number) => {
        void handler
        intervals.push(timeout ?? 0)
        return 123 as unknown as ReturnType<typeof setInterval>
      }) as typeof setInterval,
    })

    expect(timer).toBe(123)
    expect(intervals).toEqual([900000])
    expect(events.at(-1)?.msg).toBe('worker scheduler started')
  })
})
