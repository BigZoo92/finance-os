import { describe, expect, it } from 'bun:test'
import type { schema } from '@finance-os/db'
import type { EcbFxRate } from '../../services/fetch-ecb-fx-rates'
import {
  AssetValuationAlreadyRunningError,
  AssetValuationDisabledError,
  createAssetValuationUseCases,
} from './create-asset-valuation-use-cases'
import type { ValuationAssetRow, ValuationExternalPositionRow } from './collect-valuation-items'

const NOW = new Date('2026-08-07T12:00:00.000Z')

type FxRow = typeof schema.fxRateSnapshot.$inferSelect
type RunRow = typeof schema.assetValuationRun.$inferSelect
type SnapshotInsert = typeof schema.assetValuationSnapshot.$inferInsert

const usdFxRow = (): FxRow =>
  ({
    id: 1,
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    provider: 'ecb',
    sourceType: 'daily',
    rate: '1.08',
    rateTimestamp: new Date('2026-08-07T00:00:00.000Z'),
    fetchedAt: NOW,
    staleAfterSeconds: 96 * 3600,
    isStale: false,
    confidence: 0.95,
    metadata: null,
    createdAt: NOW,
  }) as FxRow

const demoAssets: ValuationAssetRow[] = [
  {
    assetId: 1,
    assetType: 'cash',
    origin: 'provider',
    source: 'banking',
    provider: 'powens',
    name: 'Compte courant',
    currency: 'EUR',
    valuation: '1000.00',
    valuationAsOf: new Date('2026-08-07T06:00:00.000Z'),
    enabled: true,
  },
  {
    assetId: 2,
    assetType: 'manual',
    origin: 'manual',
    source: 'manual',
    provider: null,
    name: 'Or familial',
    currency: 'EUR',
    valuation: '500.00',
    valuationAsOf: null,
    enabled: true,
  },
]

const demoExternalPositions: ValuationExternalPositionRow[] = [
  {
    positionKey: 'ibkr-msft',
    provider: 'ibkr',
    instrumentKey: 'ibkr:265598',
    name: 'MSFT',
    symbol: 'MSFT',
    assetClass: 'stock',
    currency: 'USD',
    valueCurrency: 'USD',
    quantity: 10,
    normalizedValue: 1080,
    providerValue: 1080,
    valueAsOf: '2026-08-07T05:00:00.000Z',
    valueSource: 'provider_reported',
    costBasis: 540,
    costBasisCurrency: 'USD',
    degradedReasons: [],
  },
]

const createFakes = ({
  fxRows = [usdFxRow()],
  fetchFxRates = async () => [] as EcbFxRate[],
  lockAcquired = true,
}: {
  fxRows?: FxRow[]
  fetchFxRates?: (input: { requestId: string }) => Promise<EcbFxRate[]>
  lockAcquired?: boolean
} = {}) => {
  const inserted: SnapshotInsert[] = []
  const fxUpserts: Array<typeof schema.fxRateSnapshot.$inferInsert> = []
  const runs: RunRow[] = []
  let nextRunId = 1

  const useCases = createAssetValuationUseCases({
    featureEnabled: true,
    fxEnabled: true,
    fxStaleAfterSeconds: 96 * 3600,
    fetchFxRates,
    fxRates: {
      upsertMany: async rows => {
        fxUpserts.push(...rows)
        return rows.length
      },
      latestRatesForBase: async () => fxRows,
    },
    valuationSnapshots: {
      insertMany: async rows => {
        inserted.push(...rows)
        return rows.length
      },
    },
    valuationRuns: {
      failStaleRunningRuns: async () => 0,
      createRun: async input => {
        if (!lockAcquired) {
          return null
        }
        const run = {
          id: nextRunId++,
          status: 'running',
          triggerSource: input.triggerSource,
          requestId: input.requestId,
          dryRun: input.dryRun,
          coverage: null,
          totals: null,
          itemCount: null,
          snapshotCount: null,
          providerFailures: null,
          safeErrorCode: null,
          safeErrorMessage: null,
          startedAt: input.startedAt,
          finishedAt: null,
          durationMs: null,
          createdAt: input.startedAt,
        } as RunRow
        runs.push(run)
        return run
      },
      completeRun: async input => {
        const run = runs.find(item => item.id === input.runId)
        if (run) {
          Object.assign(run, {
            status: 'completed',
            coverage: input.coverage,
            totals: input.totals,
            itemCount: input.itemCount,
            snapshotCount: input.snapshotCount,
            providerFailures: input.providerFailures,
            finishedAt: input.finishedAt,
            durationMs: input.durationMs,
          })
        }
      },
      markRunFailed: async input => {
        const run = runs.find(item => item.id === input.runId)
        if (run) {
          Object.assign(run, {
            status: 'failed',
            safeErrorCode: input.safeErrorCode,
            safeErrorMessage: input.safeErrorMessage,
            finishedAt: input.finishedAt,
            durationMs: input.durationMs,
          })
        }
      },
      getLatestRun: async () => runs.at(-1) ?? null,
    },
    listAssets: async () => demoAssets,
    listExternalPositions: async () => demoExternalPositions,
    listInternalPositions: async () => [],
    listInstrumentIdentities: async () => [
      {
        instrumentKey: 'ibkr:265598',
        symbol: 'MSFT',
        isin: null,
        conid: '265598',
        binanceAsset: null,
        currency: 'USD',
      },
    ],
    now: () => NOW,
  })

  return { useCases, inserted, fxUpserts, runs }
}

describe('createAssetValuationUseCases — refresh', () => {
  it('runs a real refresh: writes snapshots and a coverage report', async () => {
    const { useCases, inserted, runs } = createFakes()
    const status = await useCases.runValuationRefresh({
      requestId: 'req-1',
      triggerSource: 'admin',
      dryRun: false,
    })

    expect(status.state).toBe('completed')
    expect(runs).toHaveLength(1)
    expect(inserted).toHaveLength(3)

    const coverage = status.latestRun?.coverage
    expect(coverage?.totalItems).toBe(3)
    expect(coverage?.coveragePercent).toBe(100)
    // 1000 EUR cash + 500 EUR manual + 1080 USD / 1.08 = 1000 EUR
    expect(coverage?.totalValueBase).toBe(2500)

    const external = inserted.find(row => row.itemKey === 'external:ibkr-msft')
    expect(external?.status).toBe('priced')
    expect(external?.valueBase).toBe('1000')
    expect(external?.costBasisBase).toBe('500')
    expect(external?.unrealizedPnlBase).toBe('500')
  })

  it('dry-run computes everything but writes no snapshots', async () => {
    const { useCases, inserted, fxUpserts } = createFakes()
    const status = await useCases.runValuationRefresh({
      requestId: 'req-dry',
      triggerSource: 'admin',
      dryRun: true,
    })

    expect(inserted).toHaveLength(0)
    expect(fxUpserts).toHaveLength(0)
    expect(status.latestRun?.dryRun).toBe(true)
    expect(status.latestRun?.wouldCreateSnapshots).toBe(3)
    expect(status.latestRun?.coverage?.totalValueBase).toBe(2500)
  })

  it('is fail-soft on FX fetch failure: uses stored rates and reports the failure', async () => {
    const { useCases } = createFakes({
      fetchFxRates: async () => {
        throw new Error('ECB unreachable')
      },
    })
    const status = await useCases.runValuationRefresh({
      requestId: 'req-fx-fail',
      triggerSource: 'admin',
      dryRun: false,
    })

    expect(status.state).toBe('completed')
    expect(status.latestRun?.providerFailures).toEqual([
      {
        provider: 'ecb',
        errorCode: 'FX_REFRESH_FAILED',
        safeErrorMessage:
          'Rafraichissement des taux FX indisponible; derniers taux connus utilises.',
      },
    ])
    // Stored USD rate is still applied.
    expect(status.latestRun?.coverage?.totalValueBase).toBe(2500)
  })

  it('rejects a concurrent run with a typed error', async () => {
    const { useCases } = createFakes({ lockAcquired: false })
    await expect(
      useCases.runValuationRefresh({ requestId: 'req-lock', triggerSource: 'admin', dryRun: false })
    ).rejects.toBeInstanceOf(AssetValuationAlreadyRunningError)
  })

  it('throws a typed error when disabled', async () => {
    const noopRuns = {
      failStaleRunningRuns: async () => 0,
      createRun: async () => {
        throw new Error('should not be called')
      },
      completeRun: async () => {},
      markRunFailed: async () => {},
      getLatestRun: async () => null,
    }
    const disabled = createAssetValuationUseCases({
      featureEnabled: false,
      fxEnabled: false,
      fxStaleAfterSeconds: 1,
      fetchFxRates: async () => [],
      fxRates: { upsertMany: async () => 0, latestRatesForBase: async () => [] },
      valuationSnapshots: { insertMany: async () => 0 },
      valuationRuns: noopRuns as never,
      listAssets: async () => [],
      listExternalPositions: async () => [],
      listInternalPositions: async () => [],
      listInstrumentIdentities: async () => [],
      now: () => NOW,
    })
    await expect(
      disabled.runValuationRefresh({ requestId: 'req-off', triggerSource: 'admin', dryRun: false })
    ).rejects.toBeInstanceOf(AssetValuationDisabledError)
  })

  it('keeps other providers when one input source fails (fail-soft per provider)', async () => {
    const noopRuns = {
      failStaleRunningRuns: async () => 0,
      createRun: async () => {
        throw new Error('unused in computeValuations')
      },
      completeRun: async () => {},
      markRunFailed: async () => {},
      getLatestRun: async () => null,
    }
    const broken = createAssetValuationUseCases({
      featureEnabled: true,
      fxEnabled: false,
      fxStaleAfterSeconds: 96 * 3600,
      fetchFxRates: async () => [],
      fxRates: { upsertMany: async () => 0, latestRatesForBase: async () => [usdFxRow()] },
      valuationSnapshots: { insertMany: async rows => rows.length },
      valuationRuns: noopRuns as never,
      listAssets: async () => demoAssets,
      listExternalPositions: async () => {
        throw new Error('binance down')
      },
      listInternalPositions: async () => [],
      listInstrumentIdentities: async () => [],
      now: () => NOW,
    })

    const { valuations, coverage, providerFailures } = await broken.computeValuations({
      requestId: 'req-partial',
    })
    expect(valuations).toHaveLength(2)
    expect(coverage.totalValueBase).toBe(1500)
    expect(providerFailures.map(failure => failure.provider)).toContain('external-investments')
  })
})

describe('createAssetValuationUseCases — upstream FX provenance', () => {
  it('classifies a Binance value bridged with stale FX as estimated, not priced', async () => {
    const estimatedPosition: ValuationExternalPositionRow = {
      ...(demoExternalPositions[0] as ValuationExternalPositionRow),
      positionKey: 'binance-btc',
      provider: 'binance',
      instrumentKey: null,
      name: 'BTC',
      symbol: 'BTC',
      assetClass: 'crypto',
      currency: 'EUR',
      valueCurrency: 'EUR',
      normalizedValue: 90000,
      providerValue: 90000,
      valueAsOf: '2026-08-07T11:00:00.000Z',
      valueSource: 'market_resolved_estimated',
      costBasis: null,
    }
    const withEstimated = createAssetValuationUseCases({
      featureEnabled: true,
      fxEnabled: false,
      fxStaleAfterSeconds: 96 * 3600,
      fetchFxRates: async () => [],
      fxRates: { upsertMany: async () => 0, latestRatesForBase: async () => [usdFxRow()] },
      valuationSnapshots: { insertMany: async rows => rows.length },
      valuationRuns: {
        failStaleRunningRuns: async () => 0,
        createRun: async () => {
          throw new Error('unused in computeValuations')
        },
        completeRun: async () => {},
        markRunFailed: async () => {},
        getLatestRun: async () => null,
      } as never,
      listAssets: async () => [],
      listExternalPositions: async () => [estimatedPosition],
      listInternalPositions: async () => [],
      listInstrumentIdentities: async () => [],
      now: () => NOW,
    })

    const { valuations } = await withEstimated.computeValuations({ requestId: 'req-est' })
    expect(valuations[0]?.status).toBe('estimated')
    expect(valuations[0]?.valueBase).toBe(90000)
  })
})

describe('createAssetValuationUseCases — unresolved listing', () => {
  it('lists stale/unresolved/unavailable items only', async () => {
    const { useCases } = createFakes({ fxRows: [] })
    // Without FX rows the USD position becomes unavailable.
    const result = await useCases.listUnresolvedAssets({ requestId: 'req-unres' })
    expect(result.totalItems).toBe(3)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.itemKey).toBe('external:ibkr-msft')
    expect(result.items[0]?.status).toBe('unavailable')
    expect(result.items[0]?.errorCode).toBe('FX_RATE_UNAVAILABLE')
  })
})
