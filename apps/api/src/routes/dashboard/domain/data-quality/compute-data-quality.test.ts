import { describe, expect, it } from 'bun:test'
import { computeDataQuality } from './compute-data-quality'
import { buildDataQualityDemoFixtureInput } from './data-quality-demo-fixture'
import type { DataQualityDimensionInput, DataQualityResponse } from './data-quality-types'

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
  // raw payload sentinels:
  '<FlexQueryResponse',
  '<?xml',
  '"rawPayload"',
  // account-number-shaped sentinel:
  '5678-9012-3456',
]

const expectNoSensitiveLeakage = (response: DataQualityResponse): void => {
  const stringified = JSON.stringify(response).toLowerCase()
  for (const sentinel of SENSITIVE_SENTINELS) {
    expect(stringified).not.toContain(sentinel.toLowerCase())
  }
}

const NOW = new Date('2026-05-09T12:00:00.000Z')

const baseDimension = (
  overrides: Partial<DataQualityDimensionInput> & { key: DataQualityDimensionInput['key'] }
): DataQualityDimensionInput => ({
  status: 'ok',
  lastSuccessAt: '2026-05-09T11:30:00.000Z',
  lastFailureAt: null,
  providers: [],
  staleAfterMinutes: 1440,
  ...overrides,
})

describe('computeDataQuality (pure helper)', () => {
  it('returns deterministic demo fixture twice in a row', () => {
    const fixture = buildDataQualityDemoFixtureInput()
    const a = computeDataQuality({
      mode: 'demo',
      generatedAt: fixture.generatedAt,
      dimensions: fixture.dimensions,
    })
    const b = computeDataQuality({
      mode: 'demo',
      generatedAt: fixture.generatedAt,
      dimensions: fixture.dimensions,
    })
    expect(a).toEqual(b)
    expect(a.mode).toBe('demo')
    expect(a.overall.grade).toBe('excellent')
    expect(a.advisorReadiness.level).toBe('ready')
    expect(a.dimensions.length).toBe(8)
    expectNoSensitiveLeakage(a)
  })

  it('keeps unknown numeric fields null when input is missing', () => {
    const result = computeDataQuality({
      mode: 'admin',
      generatedAt: NOW,
      dimensions: [
        baseDimension({ key: 'banking', status: 'missing', lastSuccessAt: null }),
        baseDimension({ key: 'investments', status: 'unconfigured', lastSuccessAt: null }),
        baseDimension({ key: 'crypto', status: 'disabled_by_flag', lastSuccessAt: null }),
        baseDimension({ key: 'market_data', status: 'unknown', lastSuccessAt: null }),
      ],
    })

    for (const dim of result.dimensions) {
      expect(dim.score).toBeNull()
      expect(dim.grade).toBe('unknown')
      expect(dim.freshnessMinutes).toBeNull()
      expect(dim.missing).toBe(true)
    }
    expect(result.advisorReadiness.level).toBe('not_ready')
  })

  it('does NOT report unconfigured/disabled providers as `down`', () => {
    const result = computeDataQuality({
      mode: 'admin',
      generatedAt: NOW,
      dimensions: [
        baseDimension({ key: 'banking', status: 'unconfigured', lastSuccessAt: null }),
        baseDimension({ key: 'investments', status: 'disabled_by_flag', lastSuccessAt: null }),
      ],
    })
    expect(result.blockingIssues).toEqual([])
    for (const dim of result.dimensions) {
      // Unconfigured / disabled never become `down`, they stay null/unknown.
      expect(dim.score).toBeNull()
    }
  })

  it('marks stale data as stale and downgrades from ok', () => {
    const result = computeDataQuality({
      mode: 'admin',
      generatedAt: NOW,
      dimensions: [
        baseDimension({
          key: 'market_data',
          status: 'ok',
          lastSuccessAt: '2026-05-08T00:00:00.000Z',
          staleAfterMinutes: 60,
        }),
      ],
    })
    const md = result.dimensions.find(d => d.key === 'market_data')
    expect(md?.stale).toBe(true)
    expect(md?.degraded).toBe(true)
    expect(md?.grade).toBe('degraded')
    expect(md?.freshnessMinutes).toBeGreaterThan(60)
    expect(result.overall.stale).toBe(true)
  })

  it('maps explicit `down` to a low non-null score and adds a blocking issue', () => {
    const result = computeDataQuality({
      mode: 'admin',
      generatedAt: NOW,
      dimensions: [
        baseDimension({ key: 'banking', status: 'down', lastSuccessAt: null }),
        baseDimension({
          key: 'investments',
          status: 'ok',
          lastSuccessAt: '2026-05-09T11:30:00.000Z',
        }),
      ],
    })
    const banking = result.dimensions.find(d => d.key === 'banking')
    expect(banking?.score).toBe(20)
    expect(banking?.grade).toBe('insufficient')
    expect(result.blockingIssues).toContain('banking dimension is failing locally')
  })

  it('caps overall grade conservatively when any dimension is degraded', () => {
    const result = computeDataQuality({
      mode: 'admin',
      generatedAt: NOW,
      dimensions: [
        baseDimension({
          key: 'banking',
          status: 'ok',
          lastSuccessAt: '2026-05-09T11:30:00.000Z',
        }),
        baseDimension({
          key: 'investments',
          status: 'degraded',
          lastSuccessAt: '2026-05-09T11:00:00.000Z',
        }),
      ],
    })
    // The avg of 95 + 60 = 77.5, but anyDegraded caps it to <=75.
    expect(result.overall.score).toBeLessThanOrEqual(75)
    expect(result.overall.degraded).toBe(true)
  })

  it('emits a stable canonical dimension order regardless of input order', () => {
    const out1 = computeDataQuality({
      mode: 'admin',
      generatedAt: NOW,
      dimensions: [
        baseDimension({ key: 'post_mortems', status: 'ok' }),
        baseDimension({ key: 'banking', status: 'ok' }),
        baseDimension({ key: 'evals', status: 'ok' }),
        baseDimension({ key: 'crypto', status: 'ok' }),
      ],
    })
    const out2 = computeDataQuality({
      mode: 'admin',
      generatedAt: NOW,
      dimensions: [
        baseDimension({ key: 'evals', status: 'ok' }),
        baseDimension({ key: 'crypto', status: 'ok' }),
        baseDimension({ key: 'banking', status: 'ok' }),
        baseDimension({ key: 'post_mortems', status: 'ok' }),
      ],
    })
    expect(out1.dimensions.map(d => d.key)).toEqual(out2.dimensions.map(d => d.key))
    expect(out1.dimensions.map(d => d.key)).toEqual(['banking', 'crypto', 'evals', 'post_mortems'])
  })

  it('never leaks sensitive sentinels in JSON.stringify output', () => {
    const fixture = buildDataQualityDemoFixtureInput()
    const result = computeDataQuality({
      mode: 'demo',
      generatedAt: fixture.generatedAt,
      dimensions: fixture.dimensions,
    })
    expectNoSensitiveLeakage(result)
  })
})

describe('advisor readiness rules', () => {
  it('returns `not_ready` when banking is missing AND investments is missing', () => {
    const result = computeDataQuality({
      mode: 'admin',
      generatedAt: NOW,
      dimensions: [
        baseDimension({ key: 'banking', status: 'missing', lastSuccessAt: null }),
        baseDimension({ key: 'investments', status: 'missing', lastSuccessAt: null }),
        baseDimension({
          key: 'market_data',
          status: 'ok',
          lastSuccessAt: '2026-05-09T11:55:00.000Z',
          staleAfterMinutes: 60,
        }),
      ],
    })
    expect(result.advisorReadiness.ready).toBe(false)
    expect(result.advisorReadiness.level).toBe('not_ready')
    expect(result.advisorReadiness.missingInputs).toContain('banking')
    expect(result.advisorReadiness.missingInputs).toContain('investments')
  })

  it('returns `limited` when one required dimension is missing', () => {
    const result = computeDataQuality({
      mode: 'admin',
      generatedAt: NOW,
      dimensions: [
        baseDimension({ key: 'banking', status: 'missing', lastSuccessAt: null }),
        baseDimension({
          key: 'investments',
          status: 'ok',
          lastSuccessAt: '2026-05-09T11:30:00.000Z',
        }),
        baseDimension({
          key: 'market_data',
          status: 'ok',
          lastSuccessAt: '2026-05-09T11:55:00.000Z',
          staleAfterMinutes: 60,
        }),
      ],
    })
    expect(result.advisorReadiness.level).toBe('limited')
    expect(result.advisorReadiness.ready).toBe(false)
  })

  it('returns `usable_with_caveats` when investments are stale but everything else is fresh', () => {
    const result = computeDataQuality({
      mode: 'admin',
      generatedAt: NOW,
      dimensions: [
        baseDimension({
          key: 'banking',
          status: 'ok',
          lastSuccessAt: '2026-05-09T11:30:00.000Z',
        }),
        baseDimension({
          key: 'investments',
          status: 'ok',
          // 2 days old with 1d staleness threshold
          lastSuccessAt: '2026-05-07T11:30:00.000Z',
          staleAfterMinutes: 1440,
        }),
        baseDimension({
          key: 'market_data',
          status: 'ok',
          lastSuccessAt: '2026-05-09T11:55:00.000Z',
          staleAfterMinutes: 60,
        }),
      ],
    })
    expect(result.advisorReadiness.level).toBe('usable_with_caveats')
    expect(result.advisorReadiness.ready).toBe(true)
    expect(result.advisorReadiness.staleInputs).toContain('investments')
  })

  it('returns `ready` when all required dimensions are fresh and ok', () => {
    const fixture = buildDataQualityDemoFixtureInput()
    const result = computeDataQuality({
      mode: 'demo',
      generatedAt: fixture.generatedAt,
      dimensions: fixture.dimensions,
    })
    expect(result.advisorReadiness.level).toBe('ready')
    expect(result.advisorReadiness.ready).toBe(true)
    expect(result.advisorReadiness.reasons).toEqual([])
  })

  it('does not include raw notes/payloads in any advisor readiness field', () => {
    const result = computeDataQuality({
      mode: 'admin',
      generatedAt: NOW,
      dimensions: [baseDimension({ key: 'banking', status: 'down', lastSuccessAt: null })],
    })
    expectNoSensitiveLeakage(result)
  })
})
