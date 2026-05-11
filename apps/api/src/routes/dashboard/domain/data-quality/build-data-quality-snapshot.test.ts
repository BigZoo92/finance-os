import { describe, expect, it } from 'bun:test'
import type { ProviderDiagnosticsResponse } from '@finance-os/provider-runtime'
import {
  type BuildDataQualitySnapshotInput,
  buildDataQualityDimensions,
} from './build-data-quality-snapshot'

const baseDiagnostics = (
  overrides?: Partial<ProviderDiagnosticsResponse>
): ProviderDiagnosticsResponse => ({
  generatedAt: '2026-05-09T12:00:00.000Z',
  mode: 'admin',
  providers: [],
  summary: {
    total: 0,
    healthy: 0,
    degraded: 0,
    down: 0,
    unknown: 0,
    disabled: 0,
  },
  caveats: [],
  ...overrides,
})

const baseInput = (
  overrides?: Partial<BuildDataQualitySnapshotInput>
): BuildDataQualitySnapshotInput => ({
  providerDiagnostics: baseDiagnostics(),
  banking: { powensConfigured: false, connections: [] },
  externalInvestments: {
    enabled: false,
    safeMode: false,
    ibkrEnabledByFlag: false,
    binanceEnabledByFlag: false,
    health: [],
    connections: [],
  },
  marketData: { featureEnabled: false, cacheState: null },
  news: { liveIngestionEnabled: false, cacheState: null },
  advisorMemory: { knowledgeServiceEnabled: false },
  evals: { latestRun: null },
  postMortems: { enabled: false, latest: null },
  ...overrides,
})

describe('buildDataQualityDimensions', () => {
  it('returns 8 canonical dimensions in canonical order', () => {
    const dims = buildDataQualityDimensions(baseInput())
    expect(dims.map(d => d.key)).toEqual([
      'banking',
      'investments',
      'crypto',
      'market_data',
      'news',
      'advisor_memory',
      'evals',
      'post_mortems',
    ])
  })

  it('marks banking unconfigured when powens is not configured', () => {
    const dims = buildDataQualityDimensions(baseInput())
    const banking = dims.find(d => d.key === 'banking')
    expect(banking?.status).toBe('unconfigured')
    expect(banking?.providers).toEqual(['powens'])
  })

  it('marks banking ok when at least one connection has a recent success', () => {
    const dims = buildDataQualityDimensions(
      baseInput({
        banking: {
          powensConfigured: true,
          connections: [
            {
              status: 'connected',
              lastSyncStatus: 'OK',
              lastSuccessAt: new Date('2026-05-09T11:30:00.000Z'),
              lastFailedAt: null,
            },
          ],
        },
      })
    )
    const banking = dims.find(d => d.key === 'banking')
    expect(banking?.status).toBe('ok')
    expect(banking?.lastSuccessAt).toBe('2026-05-09T11:30:00.000Z')
  })

  it('marks banking down only when ALL connections are in error state with no recorded success', () => {
    const dims = buildDataQualityDimensions(
      baseInput({
        banking: {
          powensConfigured: true,
          connections: [
            {
              status: 'error',
              lastSyncStatus: 'KO',
              lastSuccessAt: null,
              lastFailedAt: new Date('2026-05-09T10:00:00.000Z'),
            },
          ],
        },
      })
    )
    const banking = dims.find(d => d.key === 'banking')
    expect(banking?.status).toBe('down')
  })

  it('maps disabled IBKR/Binance flags to disabled_by_flag (NOT down)', () => {
    const dims = buildDataQualityDimensions(
      baseInput({
        externalInvestments: {
          enabled: true,
          safeMode: false,
          ibkrEnabledByFlag: false,
          binanceEnabledByFlag: false,
          health: [],
          connections: [],
        },
      })
    )
    const investments = dims.find(d => d.key === 'investments')
    const crypto = dims.find(d => d.key === 'crypto')
    expect(investments?.status).toBe('disabled_by_flag')
    expect(crypto?.status).toBe('disabled_by_flag')
  })

  it('maps unconfigured external-investments credentials to unconfigured (NOT down)', () => {
    const dims = buildDataQualityDimensions(
      baseInput({
        externalInvestments: {
          enabled: true,
          safeMode: false,
          ibkrEnabledByFlag: true,
          binanceEnabledByFlag: true,
          health: [],
          connections: [
            {
              provider: 'ibkr',
              credentialStatus: 'disabled',
              lastSuccessAt: null,
              lastFailedAt: null,
            },
          ],
        },
      })
    )
    const investments = dims.find(d => d.key === 'investments')
    expect(investments?.status).toBe('unconfigured')
  })

  it('maps configured + healthy external-investments to ok', () => {
    const dims = buildDataQualityDimensions(
      baseInput({
        externalInvestments: {
          enabled: true,
          safeMode: false,
          ibkrEnabledByFlag: true,
          binanceEnabledByFlag: false,
          health: [
            {
              provider: 'ibkr',
              enabled: true,
              status: 'healthy',
              lastSuccessAt: '2026-05-09T11:30:00.000Z',
              lastFailureAt: null,
            },
          ],
          connections: [
            {
              provider: 'ibkr',
              credentialStatus: 'configured',
              lastSuccessAt: '2026-05-09T11:30:00.000Z',
              lastFailedAt: null,
            },
          ],
        },
      })
    )
    const investments = dims.find(d => d.key === 'investments')
    expect(investments?.status).toBe('ok')
    expect(investments?.lastSuccessAt).toBe('2026-05-09T11:30:00.000Z')
  })

  it('maps market-data + news cache states to missing when flag enabled but no row', () => {
    const dims = buildDataQualityDimensions(
      baseInput({
        marketData: { featureEnabled: true, cacheState: null },
        news: { liveIngestionEnabled: true, cacheState: null },
      })
    )
    expect(dims.find(d => d.key === 'market_data')?.status).toBe('missing')
    expect(dims.find(d => d.key === 'news')?.status).toBe('missing')
  })

  it('maps market-data degraded when last failure is more recent than last success', () => {
    const dims = buildDataQualityDimensions(
      baseInput({
        marketData: {
          featureEnabled: true,
          cacheState: {
            lastSuccessAt: new Date('2026-05-09T10:00:00.000Z'),
            lastFailureAt: new Date('2026-05-09T11:30:00.000Z'),
          },
        },
      })
    )
    const md = dims.find(d => d.key === 'market_data')
    expect(md?.status).toBe('degraded')
  })

  it('maps advisor_memory to disabled_by_flag when knowledge-service is disabled', () => {
    const dims = buildDataQualityDimensions(baseInput())
    const memory = dims.find(d => d.key === 'advisor_memory')
    expect(memory?.status).toBe('disabled_by_flag')
  })

  it('maps advisor_memory ok when knowledge-service is healthy in diagnostics', () => {
    const dims = buildDataQualityDimensions(
      baseInput({
        advisorMemory: { knowledgeServiceEnabled: true },
        providerDiagnostics: baseDiagnostics({
          providers: [
            {
              providerId: 'knowledge-service' as never,
              status: 'ok',
              capabilities: ['knowledge.context_bundle.read' as never],
              lastCheckedAt: '2026-05-09T11:30:00.000Z',
              degraded: false,
              freshnessMinutes: null,
              errorCode: null,
              caveats: [],
            },
          ],
        }),
      })
    )
    const memory = dims.find(d => d.key === 'advisor_memory')
    expect(memory?.status).toBe('ok')
  })

  it('maps evals to ok when latest run completed and no failed cases', () => {
    const dims = buildDataQualityDimensions(
      baseInput({
        evals: {
          latestRun: {
            status: 'completed',
            createdAt: '2026-05-09T07:00:00.000Z',
            totalCases: 10,
            passedCases: 10,
            failedCases: 0,
          },
        },
      })
    )
    expect(dims.find(d => d.key === 'evals')?.status).toBe('ok')
  })

  it('maps post_mortems to disabled_by_flag when feature is off', () => {
    const dims = buildDataQualityDimensions(baseInput())
    expect(dims.find(d => d.key === 'post_mortems')?.status).toBe('disabled_by_flag')
  })

  it('does not include any sensitive sentinel in output JSON', () => {
    const dims = buildDataQualityDimensions(
      baseInput({
        banking: {
          powensConfigured: true,
          connections: [
            {
              status: 'connected',
              lastSyncStatus: 'OK',
              lastSuccessAt: new Date('2026-05-09T11:30:00.000Z'),
              lastFailedAt: null,
            },
          ],
        },
        externalInvestments: {
          enabled: true,
          safeMode: false,
          ibkrEnabledByFlag: true,
          binanceEnabledByFlag: true,
          health: [
            {
              provider: 'ibkr',
              enabled: true,
              status: 'healthy',
              lastSuccessAt: '2026-05-09T11:30:00.000Z',
              lastFailureAt: null,
            },
          ],
          connections: [
            {
              provider: 'ibkr',
              credentialStatus: 'configured',
              lastSuccessAt: '2026-05-09T11:30:00.000Z',
              lastFailedAt: null,
            },
          ],
        },
      })
    )
    const stringified = JSON.stringify(dims).toLowerCase()
    for (const sentinel of [
      'token',
      'secret',
      'apikey',
      'api_key',
      'signature',
      'access_token',
      'refresh_token',
      'client_secret',
      'authorization',
      'bearer',
    ]) {
      expect(stringified).not.toContain(sentinel)
    }
  })
})
