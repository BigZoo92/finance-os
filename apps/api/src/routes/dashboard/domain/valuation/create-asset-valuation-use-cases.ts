import type {
  ValuationProviderFailure,
  ValuationRunSummary,
  ValuationStatusResponse,
  ValuationUnresolvedItem,
} from '@finance-os/api-contract/valuation'
import type { schema } from '@finance-os/db'
import {
  buildValuationCoverageReport,
  type FxRateInput,
  type ItemValuation,
  type ValuationCoverageReport,
  valuateItems,
} from '@finance-os/finance-engine'
import { logApiEvent, toErrorLogFields } from '../../../../observability/logger'
import type { EcbFxRate } from '../../services/fetch-ecb-fx-rates'
import {
  collectValuationItems,
  type ExternalInstrumentIdentityRow,
  type ValuationAssetRow,
  type ValuationExternalPositionRow,
  type ValuationInternalPositionRow,
} from './collect-valuation-items'

export class AssetValuationDisabledError extends Error {
  readonly code = 'ASSET_VALUATION_DISABLED' as const
  readonly requestId: string

  constructor(requestId: string) {
    super('Asset valuation is disabled by runtime flag')
    this.name = 'AssetValuationDisabledError'
    this.requestId = requestId
  }
}

export class AssetValuationAlreadyRunningError extends Error {
  readonly code = 'ASSET_VALUATION_RUNNING' as const
  readonly requestId: string

  constructor(requestId: string) {
    super('Asset valuation refresh already in progress')
    this.name = 'AssetValuationAlreadyRunningError'
    this.requestId = requestId
  }
}

export class AssetValuationFailedError extends Error {
  readonly code = 'ASSET_VALUATION_FAILED' as const
  readonly requestId: string

  constructor(requestId: string) {
    super('Asset valuation refresh failed. Snapshots remain unchanged.')
    this.name = 'AssetValuationFailedError'
    this.requestId = requestId
  }
}

export type AssetValuationProviderFailure = ValuationProviderFailure
export type AssetValuationRunSummary = ValuationRunSummary
export type AssetValuationStatusResponse = ValuationStatusResponse
export type AssetValuationUnresolvedItem = ValuationUnresolvedItem

interface FxRateRepositoryLike {
  upsertMany: (rows: Array<typeof schema.fxRateSnapshot.$inferInsert>) => Promise<number>
  latestRatesForBase: (
    baseCurrency: string,
    lookbackDays?: number
  ) => Promise<Array<typeof schema.fxRateSnapshot.$inferSelect>>
}

interface ValuationSnapshotRepositoryLike {
  insertMany: (rows: Array<typeof schema.assetValuationSnapshot.$inferInsert>) => Promise<number>
}

interface ValuationRunRepositoryLike {
  failStaleRunningRuns: (input: { olderThanMs: number }) => Promise<number>
  /** Atomic claim: returns null when another run is already running. */
  createRun: (input: {
    triggerSource: 'admin' | 'internal'
    requestId: string
    dryRun: boolean
    startedAt: Date
  }) => Promise<typeof schema.assetValuationRun.$inferSelect | null>
  completeRun: (input: {
    runId: number
    coverage: Record<string, unknown>
    totals: Record<string, unknown>
    itemCount: number
    snapshotCount: number
    providerFailures: Array<Record<string, unknown>>
    finishedAt: Date
    durationMs: number
  }) => Promise<void>
  markRunFailed: (input: {
    runId: number
    safeErrorCode: string
    safeErrorMessage: string
    finishedAt: Date
    durationMs: number
  }) => Promise<void>
  getLatestRun: (options?: {
    includeDryRuns?: boolean
  }) => Promise<typeof schema.assetValuationRun.$inferSelect | null>
}

const STALE_RUN_AFTER_MS = 30 * 60 * 1000

export interface CreateAssetValuationUseCasesDependencies {
  featureEnabled: boolean
  fxEnabled: boolean
  fxStaleAfterSeconds: number
  fetchFxRates: (input: { requestId: string }) => Promise<EcbFxRate[]>
  fxRates: FxRateRepositoryLike
  valuationSnapshots: ValuationSnapshotRepositoryLike
  valuationRuns: ValuationRunRepositoryLike
  listAssets: () => Promise<ValuationAssetRow[]>
  listExternalPositions: () => Promise<ValuationExternalPositionRow[]>
  listInternalPositions: () => Promise<ValuationInternalPositionRow[]>
  listInstrumentIdentities: () => Promise<ExternalInstrumentIdentityRow[]>
  now?: () => Date
}

const toDecimalString = (value: number | null) => (value === null ? null : value.toString())

const mapFxRowToInput = (row: typeof schema.fxRateSnapshot.$inferSelect): FxRateInput => ({
  baseCurrency: row.baseCurrency,
  quoteCurrency: row.quoteCurrency,
  rate: Number(row.rate),
  provider: row.provider,
  sourceType: row.sourceType,
  rateTimestamp: row.rateTimestamp.toISOString(),
  staleAfterSeconds: row.staleAfterSeconds,
})

const mapRunRow = (
  row: typeof schema.assetValuationRun.$inferSelect
): AssetValuationRunSummary => ({
  runId: row.id,
  dryRun: row.dryRun,
  status: row.status,
  triggerSource: row.triggerSource,
  startedAt: row.startedAt.toISOString(),
  finishedAt: row.finishedAt?.toISOString() ?? null,
  durationMs: row.durationMs,
  coverage: (row.coverage as ValuationCoverageReport | null) ?? null,
  itemCount: row.itemCount,
  snapshotCount: row.dryRun ? 0 : row.snapshotCount,
  wouldCreateSnapshots: row.dryRun ? row.snapshotCount : null,
  providerFailures: (row.providerFailures as AssetValuationProviderFailure[] | null) ?? [],
  safeErrorCode: row.safeErrorCode,
  safeErrorMessage: row.safeErrorMessage,
})

const toSnapshotRow = ({
  valuation,
  runId,
  now,
}: {
  valuation: ItemValuation
  runId: number
  now: Date
}): typeof schema.assetValuationSnapshot.$inferInsert => {
  // DATA-01: an item whose value could not be established is persisted with a
  // NULL value and price, its status and error code explaining why. It is never
  // dropped from the run (that would hide the gap) and never written as 0.
  const quantity = valuation.quantity ?? 1
  const unitPrice =
    valuation.valueBase === null
      ? null
      : valuation.quantity !== null && valuation.quantity !== 0 && valuation.valueOriginal !== null
        ? valuation.valueOriginal / valuation.quantity
        : (valuation.valueOriginal ?? valuation.valueBase)

  return {
    assetId: valuation.itemKey,
    itemKey: valuation.itemKey,
    kind: valuation.kind,
    quantity: quantity.toString(),
    price: toDecimalString(unitPrice),
    priceCurrency: valuation.currency ?? valuation.baseCurrency,
    baseCurrency: valuation.baseCurrency,
    fxRate: toDecimalString(valuation.fxRate),
    fxRateSource: valuation.fxProvider,
    fxRateTimestamp: valuation.fxTimestamp ? new Date(valuation.fxTimestamp) : null,
    valueBase: toDecimalString(valuation.valueBase),
    valuationTimestamp: now,
    confidence: valuation.confidence,
    staleReason: valuation.status === 'stale' ? 'value_age_exceeds_policy' : null,
    runId,
    status: valuation.status,
    valuationSource: valuation.source,
    provider: valuation.provider,
    valueOriginal: toDecimalString(valuation.valueOriginal),
    costBasisBase: toDecimalString(valuation.costBasisBase),
    unrealizedPnlBase: toDecimalString(valuation.unrealizedPnlBase),
    unrealizedPnlPct: toDecimalString(valuation.unrealizedPnlPercent),
    asOf: valuation.asOf ? new Date(valuation.asOf) : null,
    errorCode: valuation.errorCode,
    safeErrorMessage: valuation.safeErrorMessage,
  }
}

export const createAssetValuationUseCases = ({
  featureEnabled,
  fxEnabled,
  fxStaleAfterSeconds,
  fetchFxRates,
  fxRates,
  valuationSnapshots,
  valuationRuns,
  listAssets,
  listExternalPositions,
  listInternalPositions,
  listInstrumentIdentities,
  now = () => new Date(),
}: CreateAssetValuationUseCasesDependencies) => {
  /**
   * Refresh FX rates fail-soft: a fetch failure never aborts the valuation —
   * the latest persisted rates are used instead (and flagged stale by age).
   */
  const refreshFxRates = async ({
    requestId,
    dryRun,
  }: {
    requestId: string
    dryRun: boolean
  }): Promise<AssetValuationProviderFailure | null> => {
    if (!fxEnabled) {
      return null
    }

    try {
      const fetched = await fetchFxRates({ requestId })
      if (!dryRun) {
        await fxRates.upsertMany(
          fetched.map(rate => ({
            baseCurrency: rate.baseCurrency,
            quoteCurrency: rate.quoteCurrency,
            provider: rate.provider,
            sourceType: rate.sourceType,
            rate: rate.rate.toString(),
            rateTimestamp: rate.rateTimestamp,
            fetchedAt: now(),
            staleAfterSeconds: fxStaleAfterSeconds,
            isStale: false,
            confidence: 0.95,
          }))
        )
      }
      return null
    } catch (error) {
      logApiEvent({
        level: 'warn',
        msg: 'asset valuation fx refresh failed',
        requestId,
        ...toErrorLogFields({ error, includeStack: false }),
      })
      return {
        provider: 'ecb',
        errorCode: 'FX_REFRESH_FAILED',
        safeErrorMessage:
          'Rafraichissement des taux FX indisponible; derniers taux connus utilises.',
      }
    }
  }

  const loadInputsFailSoft = async ({ requestId }: { requestId: string }) => {
    const providerFailures: AssetValuationProviderFailure[] = []

    const guard = async <T>(provider: string, fallback: T, load: () => Promise<T>): Promise<T> => {
      try {
        return await load()
      } catch (error) {
        logApiEvent({
          level: 'warn',
          msg: 'asset valuation input load failed',
          requestId,
          provider,
          ...toErrorLogFields({ error, includeStack: false }),
        })
        providerFailures.push({
          provider,
          errorCode: 'INPUT_LOAD_FAILED',
          safeErrorMessage: `Lecture ${provider} indisponible; source ignoree pour ce run.`,
        })
        return fallback
      }
    }

    const [assets, externalPositions, internalPositions, instrumentIdentities, fxRows] =
      await Promise.all([
        guard('assets', [] as ValuationAssetRow[], listAssets),
        guard('external-investments', [] as ValuationExternalPositionRow[], listExternalPositions),
        guard('positions', [] as ValuationInternalPositionRow[], listInternalPositions),
        guard(
          'external-instruments',
          [] as ExternalInstrumentIdentityRow[],
          listInstrumentIdentities
        ),
        guard('fx-rates', [] as Array<typeof schema.fxRateSnapshot.$inferSelect>, () =>
          fxRates.latestRatesForBase('EUR')
        ),
      ])

    return {
      assets,
      externalPositions,
      internalPositions,
      instrumentIdentities,
      fxRows,
      providerFailures,
    }
  }

  const computeValuations = async ({ requestId }: { requestId: string }) => {
    const inputs = await loadInputsFailSoft({ requestId })
    const items = collectValuationItems({
      assets: inputs.assets,
      externalPositions: inputs.externalPositions,
      internalPositions: inputs.internalPositions,
      instrumentIdentities: inputs.instrumentIdentities,
    })
    const valuations = valuateItems({
      items,
      fxRates: inputs.fxRows.map(mapFxRowToInput),
      now: now(),
    })
    return {
      valuations,
      coverage: buildValuationCoverageReport(valuations),
      providerFailures: inputs.providerFailures,
      fxRows: inputs.fxRows,
    }
  }

  const runValuationRefresh = async (input: {
    requestId: string
    triggerSource: 'admin' | 'internal'
    dryRun: boolean
  }): Promise<AssetValuationStatusResponse> => {
    if (!featureEnabled) {
      throw new AssetValuationDisabledError(input.requestId)
    }

    // Recover crashed runs, then claim the single 'running' slot atomically.
    await valuationRuns.failStaleRunningRuns({ olderThanMs: STALE_RUN_AFTER_MS })
    const startedAt = now()
    const run = await valuationRuns.createRun({
      triggerSource: input.triggerSource,
      requestId: input.requestId,
      dryRun: input.dryRun,
      startedAt,
    })
    if (run === null) {
      throw new AssetValuationAlreadyRunningError(input.requestId)
    }

    const runId: number = run.id

    try {
      logApiEvent({
        level: 'info',
        msg: 'asset valuation refresh started',
        requestId: input.requestId,
        runId,
        dryRun: input.dryRun,
        triggerSource: input.triggerSource,
      })

      const fxFailure = await refreshFxRates({ requestId: input.requestId, dryRun: input.dryRun })
      const { valuations, coverage, providerFailures } = await computeValuations({
        requestId: input.requestId,
      })
      if (fxFailure) {
        providerFailures.push(fxFailure)
      }

      const valuationTimestamp = now()
      const snapshotRows = valuations.map(valuation =>
        toSnapshotRow({ valuation, runId: run.id, now: valuationTimestamp })
      )

      let snapshotCount = snapshotRows.length
      if (!input.dryRun) {
        snapshotCount = await valuationSnapshots.insertMany(snapshotRows)
      }

      const finishedAt = now()
      await valuationRuns.completeRun({
        runId: run.id,
        coverage: coverage as unknown as Record<string, unknown>,
        totals: {
          totalValueBase: coverage.totalValueBase,
          baseCurrency: coverage.baseCurrency,
          unknownValueCount: coverage.unknownValueCount,
        },
        itemCount: valuations.length,
        snapshotCount: input.dryRun ? snapshotRows.length : snapshotCount,
        providerFailures: providerFailures as unknown as Array<Record<string, unknown>>,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      })

      logApiEvent({
        level: 'info',
        msg: 'asset valuation refresh completed',
        requestId: input.requestId,
        runId,
        dryRun: input.dryRun,
        itemCount: valuations.length,
        snapshotCount,
        coveragePercent: coverage.coveragePercent,
        unresolved: coverage.statusCounts.unresolved,
        unavailable: coverage.statusCounts.unavailable,
        stale: coverage.statusCounts.stale,
        providerFailureCount: providerFailures.length,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      })

      return getValuationStatus()
    } catch (error) {
      const finishedAt = now()
      // Marking the run failed also frees the single-running slot.
      await valuationRuns.markRunFailed({
        runId,
        safeErrorCode: 'ASSET_VALUATION_FAILED',
        safeErrorMessage: 'Asset valuation refresh failed. Snapshots remain unchanged.',
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      })

      logApiEvent({
        level: 'error',
        msg: 'asset valuation refresh failed',
        requestId: input.requestId,
        runId,
        dryRun: input.dryRun,
        ...toErrorLogFields({ error, includeStack: true }),
      })

      throw new AssetValuationFailedError(input.requestId)
    }
  }

  const getValuationStatus = async (): Promise<AssetValuationStatusResponse> => {
    const [latestRun, fxRows] = await Promise.all([
      valuationRuns.getLatestRun(),
      fxRates.latestRatesForBase('EUR').catch(() => []),
    ])

    const nowMs = now().getTime()
    const staleRates = fxRows.filter(
      row => nowMs - row.rateTimestamp.getTime() > row.staleAfterSeconds * 1000
    ).length
    const latestRateTimestamp = fxRows.reduce<string | null>((latest, row) => {
      const iso = row.rateTimestamp.toISOString()
      return latest === null || iso > latest ? iso : latest
    }, null)

    let state: AssetValuationStatusResponse['state'] = 'idle'
    if (latestRun?.status === 'running') {
      state = 'running'
    } else if (latestRun?.status === 'failed') {
      state = 'failed'
    } else if (latestRun) {
      state = 'completed'
    }

    return {
      featureEnabled,
      fxEnabled,
      state,
      latestRun: latestRun ? mapRunRow(latestRun) : null,
      fx: {
        baseCurrency: 'EUR',
        ratesAvailable: fxRows.length,
        staleRates,
        latestRateTimestamp,
      },
    }
  }

  const listUnresolvedAssets = async ({
    requestId,
  }: {
    requestId: string
  }): Promise<{ items: AssetValuationUnresolvedItem[]; totalItems: number }> => {
    const { valuations } = await computeValuations({ requestId })
    const problematic = valuations.filter(
      valuation =>
        valuation.status === 'unresolved' ||
        valuation.status === 'unavailable' ||
        valuation.status === 'stale'
    )

    return {
      totalItems: valuations.length,
      items: problematic.map(valuation => ({
        itemKey: valuation.itemKey,
        name: valuation.name,
        provider: valuation.provider,
        assetClass: valuation.assetClass,
        status: valuation.status,
        identityStatus: valuation.identityStatus,
        errorCode: valuation.errorCode,
        safeErrorMessage: valuation.safeErrorMessage,
        asOf: valuation.asOf,
      })),
    }
  }

  return {
    runValuationRefresh,
    getValuationStatus,
    listUnresolvedAssets,
    computeValuations,
  }
}

export type AssetValuationUseCases = ReturnType<typeof createAssetValuationUseCases>
