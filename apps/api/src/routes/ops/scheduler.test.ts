import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createOpsSchedulerRoute } from './scheduler'

const config = {
  dailyIntelligenceEnabled: true,
  dailyIntelligenceTimezone: 'Europe/Paris',
  dailyIntelligenceNightCron: '15 23 * * *',
  dailyIntelligenceMorningCron: '30 7 * * *',
  dailyIntelligenceLegacyCron: '0 9 * * 1-5',
  dailyIntelligenceDryRunDefault: false,
  dailyIntelligenceManualTriggerEnabled: true,
  marketDataAutoRefreshEnabled: false,
  signalsSocialPollingEnabled: true,
}

describe('createOpsSchedulerRoute', () => {
  it('exposes next night and morning runs without touching providers', async () => {
    const app = new Elysia()
      .derive(() => ({
        auth: { mode: 'admin' as const },
        requestMeta: { requestId: 'req-scheduler-test', startedAtMs: 0 },
      }))
      .use(
        createOpsSchedulerRoute({
          config,
          now: () => new Date('2026-05-04T05:29:00.000Z'),
        })
      )

    const response = await app.handle(new Request('http://finance-os.local/ops/scheduler/status'))
    const payload = (await response.json()) as {
      nextMorningRun: string
      nextNightRun: string
      schedulerStatus: { socialSchedulerStatus: string; marketSchedulerStatus: string }
    }

    expect(response.status).toBe(200)
    expect(payload.nextMorningRun).toBe('2026-05-04T05:30:00.000Z')
    expect(payload.nextNightRun).toBe('2026-05-04T21:15:00.000Z')
    expect(payload.schedulerStatus.socialSchedulerStatus).toBe('enabled')
    expect(payload.schedulerStatus.marketSchedulerStatus).toBe('disabled')
  })
})
