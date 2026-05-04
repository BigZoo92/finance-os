import { describe, expect, it } from 'bun:test'
import {
  buildDailyIntelligenceRequest,
  shouldTriggerDailyIntelligenceRun,
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
    })

    expect(request.url).toBe('http://api.internal.local/ops/refresh/all')
    expect(request.init.headers).toMatchObject({
      'x-request-id': 'req-daily',
      'x-internal-token': 'private-token',
    })
    expect(request.init.body).toBe(JSON.stringify({ trigger: 'scheduled' }))
  })
})
