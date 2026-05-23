import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createNewsRoute } from './news'
import type { DashboardRouteRuntime } from '../types'

const createApp = (runtime: DashboardRouteRuntime) =>
  new Elysia()
    .derive(() => ({
      auth: { mode: 'admin' as const },
      internalAuth: { hasValidToken: false, tokenSource: null },
      requestMeta: { requestId: 'req-news-test', startedAtMs: 0 },
      dashboard: runtime,
    }))
    .use(createNewsRoute())

describe('createNewsRoute', () => {
  it('accepts social_poll as an explicit internal news ingest trigger', async () => {
    let ingestCalls = 0
    const app = createApp({
      repositories: {},
      providerRegistry: {} as never,
      useCases: {
        ingestNews: async (input: { requestId: string }) => {
          ingestCalls += 1
          expect(input.requestId).toBe('req-news-test')
          return { inserted: 1, updated: 0, skipped: 0 }
        },
      },
    } as unknown as DashboardRouteRuntime)

    const response = await app.handle(
      new Request('http://finance-os.local/news/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trigger: 'social_poll' }),
      })
    )
    const payload = (await response.json()) as {
      ok: boolean
      trigger: string
      source: string
      inserted: number
    }

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.trigger).toBe('social_poll')
    expect(payload.source).toBe('social_scheduler')
    expect(payload.inserted).toBe(1)
    expect(ingestCalls).toBe(1)
  })
})
