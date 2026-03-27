import { describe, expect, it } from 'vitest'
import { buildDashboardHealthModel } from './dashboard-health'

describe('buildDashboardHealthModel', () => {
  it('returns the deterministic demo fixture matrix', () => {
    const health = buildDashboardHealthModel({
      mode: 'demo',
    })

    expect(health.isDemoFixture).toBe(true)
    expect(health.global.status).toBe('attention_required')
    expect(health.global.reasons).toEqual(['STALE_SYNC', 'PARTIAL_IMPORT'])
    expect(health.widgets.connections_state.reasons).toEqual(['STALE_SYNC'])
    expect(health.widgets.wealth_overview.reasons).toEqual(['PARTIAL_IMPORT'])
    expect(health.widgets.investment_positions.status).toBe('healthy')
  })

  it('marks all dashboard domains healthy when admin data is fresh and aligned', () => {
    const health = buildDashboardHealthModel({
      mode: 'admin',
      nowMs: new Date('2026-03-27T12:00:00.000Z').getTime(),
      summary: {
        range: '30d',
        totals: {
          balance: 12000,
          incomes: 3200,
          expenses: 1400,
        },
        connections: [
          {
            powensConnectionId: 'conn-a',
            source: 'banking',
            provider: 'powens',
            providerConnectionId: 'conn-a',
            providerInstitutionId: 'bank-a',
            providerInstitutionName: 'Bank A',
            status: 'connected',
            lastSyncAttemptAt: '2026-03-27T08:00:00.000Z',
            lastSyncAt: '2026-03-27T08:02:00.000Z',
            lastSuccessAt: '2026-03-27T08:02:00.000Z',
            lastFailedAt: null,
            lastError: null,
            syncMetadata: null,
            balance: 12000,
            accountCount: 1,
          },
        ],
        accounts: [],
        assets: [
          {
            assetId: 1,
            type: 'cash',
            origin: 'provider',
            source: 'banking',
            provider: 'powens',
            providerConnectionId: 'conn-a',
            providerInstitutionName: 'Bank A',
            powensConnectionId: 'conn-a',
            powensAccountId: 'acc-a',
            name: 'Checking',
            currency: 'EUR',
            valuation: 12000,
            valuationAsOf: '2026-03-27T08:02:00.000Z',
            enabled: true,
            metadata: null,
          },
        ],
        positions: [
          {
            positionId: 1,
            positionKey: 'position-a',
            assetId: 1,
            powensAccountId: 'acc-a',
            powensConnectionId: 'conn-a',
            source: 'banking',
            provider: 'powens',
            providerConnectionId: 'conn-a',
            providerPositionId: 'position-a',
            assetName: 'Checking',
            accountName: 'Main',
            name: 'Checking',
            currency: 'EUR',
            quantity: null,
            costBasis: null,
            costBasisSource: 'unknown',
            currentValue: 12000,
            lastKnownValue: 12000,
            openedAt: null,
            closedAt: null,
            valuedAt: '2026-03-27T08:02:00.000Z',
            lastSyncedAt: '2026-03-27T08:02:00.000Z',
            enabled: true,
            metadata: null,
          },
        ],
        dailyWealthSnapshots: [],
        topExpenseGroups: [],
      },
      status: {
        safeModeActive: false,
        syncStatusPersistenceEnabled: true,
        lastCallback: null,
        connections: [
          {
            id: 1,
            source: 'banking',
            provider: 'powens',
            powensConnectionId: 'conn-a',
            providerConnectionId: 'conn-a',
            providerInstitutionId: 'bank-a',
            providerInstitutionName: 'Bank A',
            status: 'connected',
            lastSyncStatus: 'OK',
            lastSyncReasonCode: 'SUCCESS',
            lastSyncAttemptAt: '2026-03-27T08:00:00.000Z',
            lastSyncAt: '2026-03-27T08:02:00.000Z',
            lastSuccessAt: '2026-03-27T08:02:00.000Z',
            lastFailedAt: null,
            lastError: null,
            syncMetadata: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-03-27T08:02:00.000Z',
          },
        ],
      },
      syncRuns: [
        {
          id: 'run-a',
          requestId: 'req-a',
          connectionId: 'conn-a',
          startedAt: '2026-03-27T08:00:00.000Z',
          endedAt: '2026-03-27T08:02:00.000Z',
          result: 'success',
        },
      ],
      derivedStatus: {
        featureEnabled: true,
        state: 'completed',
        latestRun: {
          snapshotVersion: 'snapshot-a',
          status: 'completed',
          triggerSource: 'admin',
          requestId: 'req-derived-a',
          stage: 'completed',
          rowCounts: null,
          safeErrorCode: null,
          safeErrorMessage: null,
          startedAt: '2026-03-27T08:02:00.000Z',
          finishedAt: '2026-03-27T08:05:00.000Z',
          durationMs: 180000,
        },
        currentSnapshot: {
          snapshotVersion: 'snapshot-a',
          finishedAt: '2026-03-27T08:05:00.000Z',
          rowCounts: null,
        },
      },
    })

    expect(health.global.status).toBe('healthy')
    expect(health.domains.sync.status).toBe('healthy')
    expect(health.domains.portfolio.status).toBe('healthy')
    expect(health.domains.derived.status).toBe('healthy')
    expect(health.widgets.wealth_overview.badgeLabel).toBeNull()
  })

  it('surfaces admin attention reasons from aggregate and domain-specific health', () => {
    const health = buildDashboardHealthModel({
      mode: 'admin',
      nowMs: new Date('2026-03-27T12:00:00.000Z').getTime(),
      summary: {
        range: '30d',
        totals: {
          balance: 9500,
          incomes: 3200,
          expenses: 1800,
        },
        connections: [
          {
            powensConnectionId: 'conn-a',
            source: 'banking',
            provider: 'powens',
            providerConnectionId: 'conn-a',
            providerInstitutionId: 'bank-a',
            providerInstitutionName: 'Bank A',
            status: 'connected',
            lastSyncAttemptAt: '2026-03-24T06:00:00.000Z',
            lastSyncAt: '2026-03-24T06:05:00.000Z',
            lastSuccessAt: '2026-03-24T06:05:00.000Z',
            lastFailedAt: null,
            lastError: null,
            syncMetadata: null,
            balance: 9500,
            accountCount: 1,
          },
        ],
        accounts: [],
        assets: [
          {
            assetId: 1,
            type: 'cash',
            origin: 'provider',
            source: 'banking',
            provider: 'powens',
            providerConnectionId: 'conn-a',
            providerInstitutionName: 'Bank A',
            powensConnectionId: 'conn-a',
            powensAccountId: 'acc-a',
            name: 'Checking',
            currency: 'EUR',
            valuation: 9500,
            valuationAsOf: '2026-03-24T06:05:00.000Z',
            enabled: true,
            metadata: null,
          },
        ],
        positions: [],
        dailyWealthSnapshots: [],
        topExpenseGroups: [],
      },
      status: {
        safeModeActive: true,
        syncStatusPersistenceEnabled: true,
        lastCallback: null,
        connections: [
          {
            id: 1,
            source: 'banking',
            provider: 'powens',
            powensConnectionId: 'conn-a',
            providerConnectionId: 'conn-a',
            providerInstitutionId: 'bank-a',
            providerInstitutionName: 'Bank A',
            status: 'connected',
            lastSyncStatus: 'OK',
            lastSyncReasonCode: 'SUCCESS',
            lastSyncAttemptAt: '2026-03-24T06:00:00.000Z',
            lastSyncAt: '2026-03-24T06:05:00.000Z',
            lastSuccessAt: '2026-03-24T06:05:00.000Z',
            lastFailedAt: null,
            lastError: null,
            syncMetadata: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-03-24T06:05:00.000Z',
          },
          {
            id: 2,
            source: 'banking',
            provider: 'powens',
            powensConnectionId: 'conn-b',
            providerConnectionId: 'conn-b',
            providerInstitutionId: 'bank-b',
            providerInstitutionName: 'Bank B',
            status: 'reconnect_required',
            lastSyncStatus: 'KO',
            lastSyncReasonCode: 'RECONNECT_REQUIRED',
            lastSyncAttemptAt: '2026-03-24T05:00:00.000Z',
            lastSyncAt: null,
            lastSuccessAt: null,
            lastFailedAt: '2026-03-24T05:01:00.000Z',
            lastError: 'Reconnect required',
            syncMetadata: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-03-24T05:01:00.000Z',
          },
        ],
      },
      syncRuns: [
        {
          id: 'run-b',
          requestId: 'req-b',
          connectionId: 'conn-b',
          startedAt: '2026-03-24T05:00:00.000Z',
          endedAt: '2026-03-24T05:01:00.000Z',
          result: 'error',
          errorMessage: 'Reconnect required',
        },
      ],
      derivedStatus: {
        featureEnabled: true,
        state: 'failed',
        latestRun: {
          snapshotVersion: 'snapshot-b',
          status: 'failed',
          triggerSource: 'admin',
          requestId: 'req-derived-b',
          stage: 'failed',
          rowCounts: null,
          safeErrorCode: 'DERIVED_FAILED',
          safeErrorMessage: 'Derived recompute failed.',
          startedAt: '2026-03-24T06:05:00.000Z',
          finishedAt: '2026-03-24T06:06:00.000Z',
          durationMs: 60000,
        },
        currentSnapshot: {
          snapshotVersion: 'snapshot-b',
          finishedAt: '2026-03-24T05:45:00.000Z',
          rowCounts: null,
        },
      },
    })

    expect(health.global.status).toBe('attention_required')
    expect(health.domains.sync.reasons).toEqual([
      'SAFE_MODE_ACTIVE',
      'STALE_SYNC',
      'PARTIAL_IMPORT',
    ])
    expect(health.domains.portfolio.reasons).toEqual([
      'MISSING_SOURCE',
      'PARTIAL_IMPORT',
      'STALE_SYNC',
    ])
    expect(health.domains.derived.reasons).toEqual([
      'DERIVED_FAILURE',
      'PARTIAL_IMPORT',
      'STALE_SYNC',
    ])
    expect(health.widgets.connections_state.badgeLabel).toBe('Safe mode')
    expect(health.widgets.wealth_overview.badgeLabel).toBe('Source missing')
    expect(health.widgets.investment_positions.badgeLabel).toBe('Derived failure')
  })
})
