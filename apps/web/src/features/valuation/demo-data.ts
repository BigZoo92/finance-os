import type { ValuationStatusResponse, ValuationUnresolvedResponse } from './types'

/**
 * Deterministic demo fixtures — mirror apps/api/src/mocks/dashboardValuation.mock.ts
 * and stay arithmetically consistent with getDemoDashboardSummary (67 070,44 EUR).
 */
export const getDemoValuationStatus = (): ValuationStatusResponse => ({
  featureEnabled: true,
  fxEnabled: true,
  state: 'completed',
  latestRun: {
    runId: 42,
    dryRun: false,
    status: 'completed',
    triggerSource: 'internal',
    startedAt: '2026-02-22T19:25:00.000Z',
    finishedAt: '2026-02-22T19:25:04.000Z',
    durationMs: 4000,
    coverage: {
      baseCurrency: 'EUR',
      totalItems: 6,
      statusCounts: {
        priced: 0,
        derived: 3,
        estimated: 0,
        manual: 2,
        stale: 0,
        unresolved: 1,
        unavailable: 0,
      },
      coveragePercent: 83.33,
      totalValueBase: 67070.44,
      unknownValueCount: 1,
      providerBreakdown: {
        powens: { itemCount: 3, valueBase: 48320.44, unknownValueCount: 0 },
        manual: { itemCount: 2, valueBase: 18750, unknownValueCount: 0 },
        'manual-import': { itemCount: 1, valueBase: null, unknownValueCount: 1 },
      },
      assetClassBreakdown: {
        cash: { itemCount: 3, valueBase: 48320.44, unknownValueCount: 0 },
        fund: { itemCount: 1, valueBase: 12450, unknownValueCount: 0 },
        other: { itemCount: 2, valueBase: 6300, unknownValueCount: 1 },
      },
    },
    itemCount: 6,
    snapshotCount: 5,
    wouldCreateSnapshots: null,
    providerFailures: [],
    safeErrorCode: null,
    safeErrorMessage: null,
  },
  fx: {
    baseCurrency: 'EUR',
    ratesAvailable: 30,
    staleRates: 0,
    latestRateTimestamp: '2026-02-20T15:00:00.000Z',
  },
})

export const getDemoValuationUnresolved = (): ValuationUnresolvedResponse => ({
  totalItems: 6,
  items: [
    {
      itemKey: 'position:demo-unlisted-shares',
      name: 'Actions non cotees - import manuel',
      provider: 'manual-import',
      assetClass: 'other',
      status: 'unresolved',
      identityStatus: 'unresolved',
      errorCode: 'IDENTITY_UNRESOLVED',
      safeErrorMessage: 'Actif non identifiable: aucune valorisation possible.',
      asOf: null,
    },
  ],
})
