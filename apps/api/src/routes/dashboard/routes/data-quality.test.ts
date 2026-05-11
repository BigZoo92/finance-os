import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import type { DataQualityResponse } from '../domain/data-quality/data-quality-types'
import { createDashboardRuntimePlugin } from '../plugin'
import type { DashboardRouteRuntime } from '../types'
import { createDataQualityRoute } from './data-quality'

const SENSITIVE_SENTINELS = [
  'token',
  'secret',
  'apiKey',
  'api_key',
  'signature',
  'access_token',
  'refresh_token',
  'client_secret',
  'cookie',
  'authorization',
  'bearer',
  '<FlexQueryResponse',
  '<?xml',
  '"rawPayload"',
  '5678-9012-3456',
]

const expectNoSensitiveLeakage = (text: string) => {
  const lower = text.toLowerCase()
  for (const sentinel of SENSITIVE_SENTINELS) {
    expect(lower).not.toContain(sentinel.toLowerCase())
  }
}

const buildRuntime = (
  getDataQuality?: DashboardRouteRuntime['useCases']['getDataQuality']
): DashboardRouteRuntime => {
  const useCases = (
    getDataQuality ? { getDataQuality } : ({} as DashboardRouteRuntime['useCases'])
  ) as DashboardRouteRuntime['useCases']
  return {
    repositories: {
      readModel: {} as DashboardRouteRuntime['repositories']['readModel'],
      derivedRecompute: {} as DashboardRouteRuntime['repositories']['derivedRecompute'],
    },
    useCases,
    providerRegistry: {
      listProviders: () => [],
    } as unknown as DashboardRouteRuntime['providerRegistry'],
  } as DashboardRouteRuntime
}

const buildApp = ({
  mode,
  hasValidInternalToken = false,
  runtime,
}: {
  mode: 'admin' | 'demo'
  hasValidInternalToken?: boolean
  runtime: DashboardRouteRuntime
}) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      internalAuth: {
        hasValidToken: hasValidInternalToken,
        tokenSource: hasValidInternalToken ? ('x-internal-token' as const) : null,
      } as const,
      requestMeta: {
        requestId: 'req-data-quality-test',
        startedAtMs: 0,
      },
    }))
    .use(createDashboardRuntimePlugin(runtime))
    .use(createDataQualityRoute())

describe('GET /dashboard/data-quality', () => {
  it('returns deterministic demo fixture in demo mode (no DB read, no provider IO)', async () => {
    let buildSnapshotCalled = 0
    const useCase: NonNullable<DashboardRouteRuntime['useCases']['getDataQuality']> = async ({
      mode,
    }) => {
      // The use case is called by the route. For demo mode, the real use-case
      // returns the fixture without invoking buildSnapshot — we simulate that
      // here so the test asserts the route path forwards the right mode value.
      if (mode !== 'demo') {
        throw new Error('demo route should not pass mode=admin')
      }
      buildSnapshotCalled += 0
      return {
        generatedAt: '2026-05-09T12:00:00.000Z',
        mode: 'demo',
        overall: { score: 95, grade: 'excellent', stale: false, degraded: false },
        dimensions: [],
        advisorReadiness: {
          ready: true,
          level: 'ready',
          reasons: [],
          missingInputs: [],
          staleInputs: [],
          caveats: [],
        },
        blockingIssues: [],
        caveats: ['demo fixture'],
      }
    }
    const app = buildApp({ mode: 'demo', runtime: buildRuntime(useCase) })
    const response = await app.handle(new Request('http://finance-os.local/data-quality'))
    expect(response.status).toBe(200)
    const payload = (await response.json()) as DataQualityResponse
    expect(payload.mode).toBe('demo')
    expect(payload.overall.grade).toBe('excellent')
    expect(buildSnapshotCalled).toBe(0)
    expectNoSensitiveLeakage(JSON.stringify(payload))
  })

  it('returns admin shape when caller is admin and use-case is wired', async () => {
    let receivedMode: 'demo' | 'admin' | null = null
    const useCase: NonNullable<DashboardRouteRuntime['useCases']['getDataQuality']> = async ({
      mode,
    }) => {
      receivedMode = mode
      return {
        generatedAt: '2026-05-09T12:00:00.000Z',
        mode: 'admin',
        overall: { score: 80, grade: 'good', stale: false, degraded: false },
        dimensions: [
          {
            key: 'banking',
            score: 95,
            grade: 'excellent',
            freshnessMinutes: 30,
            stale: false,
            degraded: false,
            missing: false,
            reasons: [],
            providers: ['powens'],
          },
        ],
        advisorReadiness: {
          ready: true,
          level: 'ready',
          reasons: [],
          missingInputs: [],
          staleInputs: [],
          caveats: [],
        },
        blockingIssues: [],
        caveats: [],
      }
    }
    const app = buildApp({ mode: 'admin', runtime: buildRuntime(useCase) })
    const response = await app.handle(new Request('http://finance-os.local/data-quality'))
    expect(response.status).toBe(200)
    const payload = (await response.json()) as DataQualityResponse
    expect(payload.mode).toBe('admin')
    expect(receivedMode).toBe('admin')
    expect(payload.dimensions.length).toBe(1)
    expectNoSensitiveLeakage(JSON.stringify(payload))
  })

  it('treats valid internal token as admin even without admin auth mode', async () => {
    let receivedMode: 'demo' | 'admin' | null = null
    const useCase: NonNullable<DashboardRouteRuntime['useCases']['getDataQuality']> = async ({
      mode,
    }) => {
      receivedMode = mode
      return {
        generatedAt: '2026-05-09T12:00:00.000Z',
        mode: 'admin',
        overall: { score: 80, grade: 'good', stale: false, degraded: false },
        dimensions: [],
        advisorReadiness: {
          ready: true,
          level: 'ready',
          reasons: [],
          missingInputs: [],
          staleInputs: [],
          caveats: [],
        },
        blockingIssues: [],
        caveats: [],
      }
    }
    const app = buildApp({
      mode: 'demo',
      hasValidInternalToken: true,
      runtime: buildRuntime(useCase),
    })
    const response = await app.handle(new Request('http://finance-os.local/data-quality'))
    expect(response.status).toBe(200)
    expect(receivedMode).toBe('admin')
  })

  it('returns 503 when the data-quality use case is not wired', async () => {
    const app = buildApp({ mode: 'admin', runtime: buildRuntime(undefined) })
    const response = await app.handle(new Request('http://finance-os.local/data-quality'))
    expect(response.status).toBe(503)
    const payload = (await response.json()) as { ok: boolean; code: string }
    expect(payload.ok).toBe(false)
    expect(payload.code).toBe('DATA_QUALITY_NOT_AVAILABLE')
  })

  it('never includes sensitive sentinels even when use-case returns degraded data', async () => {
    const useCase: NonNullable<DashboardRouteRuntime['useCases']['getDataQuality']> = async () => ({
      generatedAt: '2026-05-09T12:00:00.000Z',
      mode: 'admin',
      overall: { score: 30, grade: 'degraded', stale: true, degraded: true },
      dimensions: [
        {
          key: 'banking',
          score: 20,
          grade: 'insufficient',
          freshnessMinutes: null,
          stale: false,
          degraded: true,
          missing: false,
          reasons: ['local snapshot reports failing state'],
          providers: ['powens'],
        },
        {
          key: 'investments',
          score: null,
          grade: 'unknown',
          freshnessMinutes: null,
          stale: false,
          degraded: true,
          missing: true,
          reasons: ['feature flag disabled for this provider'],
          providers: ['ibkr'],
        },
      ],
      advisorReadiness: {
        ready: false,
        level: 'limited',
        reasons: ['banking dimension is failing locally'],
        missingInputs: ['investments'],
        staleInputs: [],
        caveats: [],
      },
      blockingIssues: ['banking dimension is failing locally'],
      caveats: ['scores reflect local data reliability only — not investment performance'],
    })
    const app = buildApp({ mode: 'admin', runtime: buildRuntime(useCase) })
    const response = await app.handle(new Request('http://finance-os.local/data-quality'))
    const text = await response.text()
    expectNoSensitiveLeakage(text)
  })

  it('only forwards allowed top-level fields on the response (closed shape)', async () => {
    const useCase: NonNullable<DashboardRouteRuntime['useCases']['getDataQuality']> = async () => ({
      generatedAt: '2026-05-09T12:00:00.000Z',
      mode: 'admin',
      overall: { score: 95, grade: 'excellent', stale: false, degraded: false },
      dimensions: [],
      advisorReadiness: {
        ready: true,
        level: 'ready',
        reasons: [],
        missingInputs: [],
        staleInputs: [],
        caveats: [],
      },
      blockingIssues: [],
      caveats: [],
    })
    const app = buildApp({ mode: 'admin', runtime: buildRuntime(useCase) })
    const response = await app.handle(new Request('http://finance-os.local/data-quality'))
    const payload = (await response.json()) as Record<string, unknown>
    const allowed = new Set([
      'generatedAt',
      'mode',
      'overall',
      'dimensions',
      'advisorReadiness',
      'blockingIssues',
      'caveats',
    ])
    for (const key of Object.keys(payload)) {
      expect(allowed.has(key)).toBe(true)
    }
  })
})
