import { describe, expect, it } from 'bun:test'
import { createDiagnosticsService } from './diagnostics'

describe('createDiagnosticsService', () => {
  it('returns disabled payload from kill-switch deterministically', async () => {
    const service = createDiagnosticsService({
      diagnosticsEnabled: false,
      mockProvider: {
        run: async () => ({
          provider: 'mock',
          outcome: 'ok',
          guidance: 'unused',
          retryable: true,
        }),
      },
      powensProvider: {
        run: async () => ({
          provider: 'powens',
          outcome: 'ok',
          guidance: 'unused',
          retryable: true,
        }),
      },
      incrementOutcome: async () => {},
    })

    const snapshot = await service.run({
      requestId: 'req-1',
      mode: 'admin',
    })

    expect(snapshot.enabled).toBe(false)
    expect(snapshot.outcome).toBe('degraded')
    expect(snapshot.guidance).toContain('temporarily disabled')
  })

  it('maps provider timeout errors via shared taxonomy once', async () => {
    const service = createDiagnosticsService({
      diagnosticsEnabled: true,
      mockProvider: {
        run: async () => ({
          provider: 'mock',
          outcome: 'ok',
          guidance: 'unused',
          retryable: true,
        }),
      },
      powensProvider: {
        run: async () => {
          throw new Error('request timed out while calling provider')
        },
      },
      incrementOutcome: async () => {},
    })

    const snapshot = await service.run({
      requestId: 'req-2',
      mode: 'admin',
    })

    expect(snapshot.outcome).toBe('timeout')
    expect(snapshot.issueType).toBe('timeout')
    expect(snapshot.retryable).toBe(true)
  })
})
