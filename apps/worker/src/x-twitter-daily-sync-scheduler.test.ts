import { describe, expect, it } from 'bun:test'
import {
  __testing,
  shouldTriggerXDailySync,
  startXDailySyncScheduler,
} from './x-twitter-daily-sync-scheduler'

describe('shouldTriggerXDailySync', () => {
  it('skips when the same dayKey was already triggered', () => {
    const decision = shouldTriggerXDailySync({
      now: new Date('2026-05-12T07:00:00Z'),
      timezone: 'Europe/Paris',
      cron: '0 7 * * *',
      lastTriggeredDay: '2026-05-12',
    })
    expect(decision.shouldTrigger).toBe(false)
    expect(decision.skipReason).toBe('already_triggered_today')
  })

  it('triggers when current minute matches the cron in the configured timezone', () => {
    // 09:00 Europe/Paris in summer is 07:00Z
    const decision = shouldTriggerXDailySync({
      now: new Date('2026-05-12T07:00:00Z'),
      timezone: 'Europe/Paris',
      cron: '0 9 * * *',
      lastTriggeredDay: null,
    })
    expect(decision.shouldTrigger).toBe(true)
  })

  it('skips outside the cron minute', () => {
    const decision = shouldTriggerXDailySync({
      now: new Date('2026-05-12T08:01:00Z'),
      timezone: 'UTC',
      cron: '0 8 * * *',
      lastTriggeredDay: null,
    })
    expect(decision.shouldTrigger).toBe(false)
    expect(decision.skipReason).toBe('outside_cron_minute')
  })

  it('marks invalid cron as invalid_cron', () => {
    const decision = shouldTriggerXDailySync({
      now: new Date('2026-05-12T07:00:00Z'),
      timezone: 'UTC',
      cron: 'NaN NaN * * *',
      lastTriggeredDay: null,
    })
    expect(decision.shouldTrigger).toBe(false)
    expect(decision.skipReason).toBe('invalid_cron')
  })
})

describe('buildXDailySyncRequest', () => {
  it('targets the dashboard daily-previous-day-sync endpoint', () => {
    const req = __testing.buildXDailySyncRequest({
      apiInternalUrl: 'http://api:3001',
      requestId: 'req-1',
      privateAccessToken: 'tok',
    })
    expect(req.url).toBe(
      'http://api:3001/dashboard/signals/x-twitter/daily-previous-day-sync'
    )
    expect((req.init.headers as Record<string, string>)['x-internal-token']).toBe('tok')
    expect(req.init.body).toContain('automatic_capped')
  })
})

describe('startXDailySyncScheduler', () => {
  it('returns a no-op when enabled=false', () => {
    let invocations = 0
    const handle = startXDailySyncScheduler({
      enabled: false,
      cron: '0 7 * * *',
      timezone: 'Europe/Paris',
      trigger: async () => {
        invocations += 1
      },
      log: () => {},
    })
    handle.stop()
    expect(invocations).toBe(0)
  })
})
