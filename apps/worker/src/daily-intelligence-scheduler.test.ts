import { describe, expect, it } from 'bun:test'
import {
  buildDailyIntelligenceSchedulerStatus,
  buildDailyIntelligenceRequest,
  getNextDailyIntelligenceRun,
  shouldTriggerDailyIntelligenceRun,
  shouldTriggerDailyIntelligenceScheduledRun,
} from './daily-intelligence-scheduler'

describe('daily intelligence scheduler', () => {
  it('triggers on weekdays at 09:00 Europe/Paris by default', () => {
    const decision = shouldTriggerDailyIntelligenceRun({
      now: new Date('2026-05-04T07:00:00.000Z'),
      timezone: 'Europe/Paris',
      marketOpenHour: 9,
      cron: '0 9 * * 1-5',
      lastTriggeredDay: null,
    })

    expect(decision.shouldTrigger).toBe(true)
    expect(decision.dayKey).toBe('2026-05-04')
  })

  it('does not trigger on weekends', () => {
    const decision = shouldTriggerDailyIntelligenceRun({
      now: new Date('2026-05-03T07:00:00.000Z'),
      timezone: 'Europe/Paris',
      marketOpenHour: 9,
      cron: '0 9 * * 1-5',
      lastTriggeredDay: null,
    })

    expect(decision.shouldTrigger).toBe(false)
    expect(decision.skipReason).toBe('weekend')
  })

  it('targets the unified refresh route with the internal token', () => {
    const request = buildDailyIntelligenceRequest({
      apiInternalUrl: 'http://api.internal.local/',
      requestId: 'req-daily',
      privateAccessToken: 'private-token',
      runKind: 'morning',
    })

    expect(request.url).toBe('http://api.internal.local/ops/refresh/all')
    expect(request.init.headers).toMatchObject({
      'x-request-id': 'req-daily',
      'x-internal-token': 'private-token',
    })
    expect(request.init.body).toBe(JSON.stringify({ trigger: 'scheduled', runKind: 'morning' }))
  })

  it('triggers independent night and morning schedules', () => {
    const night = shouldTriggerDailyIntelligenceScheduledRun({
      now: new Date('2026-05-04T21:15:00.000Z'),
      timezone: 'Europe/Paris',
      cron: '15 23 * * *',
      runKind: 'night',
      lastTriggeredKey: null,
    })
    const morning = shouldTriggerDailyIntelligenceScheduledRun({
      now: new Date('2026-05-04T05:30:00.000Z'),
      timezone: 'Europe/Paris',
      cron: '30 7 * * *',
      runKind: 'morning',
      lastTriggeredKey: null,
    })

    expect(night.shouldTrigger).toBe(true)
    expect(night.triggerKey).toBe('night:2026-05-04')
    expect(morning.shouldTrigger).toBe(true)
    expect(morning.triggerKey).toBe('morning:2026-05-04')
  })

  it('computes next night and morning run timestamps in the configured timezone', () => {
    const now = new Date('2026-05-04T05:29:00.000Z')
    expect(
      getNextDailyIntelligenceRun({
        now,
        timezone: 'Europe/Paris',
        cron: '30 7 * * *',
        fallbackHour: 7,
      })
    ).toBe('2026-05-04T05:30:00.000Z')

    const status = buildDailyIntelligenceSchedulerStatus({
      enabled: true,
      timezone: 'Europe/Paris',
      nightCron: '15 23 * * *',
      morningCron: '30 7 * * *',
      now,
    })

    expect(status.nextMorningRun).toBe('2026-05-04T05:30:00.000Z')
    expect(status.nextNightRun).toBe('2026-05-04T21:15:00.000Z')
  })
})
