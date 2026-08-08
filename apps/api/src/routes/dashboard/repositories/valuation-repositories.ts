import { schema } from '@finance-os/db'
import { and, desc, eq, gte, lt } from 'drizzle-orm'
import type { ApiDb } from '../types'

export const createPriceSnapshotRepository = ({ db }: { db: ApiDb }) => ({
  insert: async (input: typeof schema.assetPriceSnapshot.$inferInsert) => {
    const [row] = await db.insert(schema.assetPriceSnapshot).values(input).returning()
    return row ?? null
  },
  latestForSymbol: async (symbol: string) => {
    const [row] = await db
      .select()
      .from(schema.assetPriceSnapshot)
      .where(eq(schema.assetPriceSnapshot.symbol, symbol))
      .orderBy(desc(schema.assetPriceSnapshot.createdAt))
      .limit(1)
    return row ?? null
  },
})

export const createAssetValuationRepository = ({ db }: { db: ApiDb }) => ({
  insert: async (input: typeof schema.assetValuationSnapshot.$inferInsert) => {
    const [row] = await db.insert(schema.assetValuationSnapshot).values(input).returning()
    return row ?? null
  },
  insertMany: async (inputs: Array<typeof schema.assetValuationSnapshot.$inferInsert>) => {
    if (inputs.length === 0) {
      return 0
    }
    const rows = await db
      .insert(schema.assetValuationSnapshot)
      .values(inputs)
      .onConflictDoNothing()
      .returning({ id: schema.assetValuationSnapshot.id })
    return rows.length
  },
})

export const createProviderHealthRepository = ({ db }: { db: ApiDb }) => ({
  insert: async (input: typeof schema.providerHealthSnapshot.$inferInsert) => {
    const [row] = await db.insert(schema.providerHealthSnapshot).values(input).returning()
    return row ?? null
  },
  latestForProvider: async (provider: string) => {
    const [row] = await db
      .select()
      .from(schema.providerHealthSnapshot)
      .where(eq(schema.providerHealthSnapshot.provider, provider))
      .orderBy(desc(schema.providerHealthSnapshot.createdAt))
      .limit(1)
    return row ?? null
  },
})

export const createFxRateRepository = ({ db }: { db: ApiDb }) => ({
  insert: async (input: typeof schema.fxRateSnapshot.$inferInsert) => {
    const [row] = await db.insert(schema.fxRateSnapshot).values(input).returning()
    return row ?? null
  },
  /** Idempotent batch write — duplicates on (pair, provider, rateTimestamp) are ignored. */
  upsertMany: async (inputs: Array<typeof schema.fxRateSnapshot.$inferInsert>) => {
    if (inputs.length === 0) {
      return 0
    }
    const rows = await db
      .insert(schema.fxRateSnapshot)
      .values(inputs)
      .onConflictDoNothing()
      .returning({ id: schema.fxRateSnapshot.id })
    return rows.length
  },
  latestPair: async (baseCurrency: string, quoteCurrency: string) => {
    const [row] = await db
      .select()
      .from(schema.fxRateSnapshot)
      .where(
        and(
          eq(schema.fxRateSnapshot.baseCurrency, baseCurrency),
          eq(schema.fxRateSnapshot.quoteCurrency, quoteCurrency)
        )
      )
      .orderBy(desc(schema.fxRateSnapshot.rateTimestamp))
      .limit(1)
    return row ?? null
  },
  /** Latest stored rate per quote currency for a base, looking back `lookbackDays`. */
  latestRatesForBase: async (baseCurrency: string, lookbackDays = 30) => {
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
    const rows = await db
      .select()
      .from(schema.fxRateSnapshot)
      .where(
        and(
          eq(schema.fxRateSnapshot.baseCurrency, baseCurrency),
          gte(schema.fxRateSnapshot.rateTimestamp, since)
        )
      )
      .orderBy(desc(schema.fxRateSnapshot.rateTimestamp))
      .limit(2000)

    const byQuote = new Map<string, (typeof rows)[number]>()
    for (const row of rows) {
      if (!byQuote.has(row.quoteCurrency)) {
        byQuote.set(row.quoteCurrency, row)
      }
    }
    return [...byQuote.values()]
  },
})

export const createAssetValuationRunRepository = ({ db }: { db: ApiDb }) => ({
  /**
   * Auto-fail 'running' rows older than the threshold so a crashed process
   * never blocks future runs (the single-running unique index is the lock).
   */
  async failStaleRunningRuns({ olderThanMs }: { olderThanMs: number }) {
    const threshold = new Date(Date.now() - olderThanMs)
    const rows = await db
      .update(schema.assetValuationRun)
      .set({
        status: 'failed',
        safeErrorCode: 'ASSET_VALUATION_STALE_TIMED_OUT',
        safeErrorMessage: 'Run recovered automatically after exceeding the stale threshold.',
        finishedAt: new Date(),
      })
      .where(
        and(
          eq(schema.assetValuationRun.status, 'running'),
          lt(schema.assetValuationRun.startedAt, threshold)
        )
      )
      .returning({ id: schema.assetValuationRun.id })
    return rows.length
  },

  /**
   * Atomic run claim: the partial unique index
   * `asset_valuation_run_single_running` allows at most one 'running' row.
   * Returns null when another run currently holds it.
   */
  async createRun(input: {
    triggerSource: 'admin' | 'internal'
    requestId: string
    dryRun: boolean
    startedAt: Date
  }) {
    try {
      const [row] = await db
        .insert(schema.assetValuationRun)
        .values({
          status: 'running',
          triggerSource: input.triggerSource,
          requestId: input.requestId,
          dryRun: input.dryRun,
          startedAt: input.startedAt,
        })
        .returning()
      return row ?? null
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === '23505'
      ) {
        return null
      }
      throw error
    }
  },

  async completeRun(input: {
    runId: number
    coverage: Record<string, unknown>
    totals: Record<string, unknown>
    itemCount: number
    snapshotCount: number
    providerFailures: Array<Record<string, unknown>>
    finishedAt: Date
    durationMs: number
  }) {
    await db
      .update(schema.assetValuationRun)
      .set({
        status: 'completed',
        coverage: input.coverage,
        totals: input.totals,
        itemCount: input.itemCount,
        snapshotCount: input.snapshotCount,
        providerFailures: input.providerFailures,
        finishedAt: input.finishedAt,
        durationMs: input.durationMs,
      })
      .where(eq(schema.assetValuationRun.id, input.runId))
  },

  async markRunFailed(input: {
    runId: number
    safeErrorCode: string
    safeErrorMessage: string
    finishedAt: Date
    durationMs: number
  }) {
    await db
      .update(schema.assetValuationRun)
      .set({
        status: 'failed',
        safeErrorCode: input.safeErrorCode,
        safeErrorMessage: input.safeErrorMessage,
        finishedAt: input.finishedAt,
        durationMs: input.durationMs,
      })
      .where(eq(schema.assetValuationRun.id, input.runId))
  },

  async getLatestRun({ includeDryRuns = true }: { includeDryRuns?: boolean } = {}) {
    const [row] = await db
      .select()
      .from(schema.assetValuationRun)
      .where(includeDryRuns ? undefined : eq(schema.assetValuationRun.dryRun, false))
      .orderBy(desc(schema.assetValuationRun.startedAt), desc(schema.assetValuationRun.id))
      .limit(1)
    return row ?? null
  },

  async listRuns(limit = 10) {
    return db
      .select()
      .from(schema.assetValuationRun)
      .orderBy(desc(schema.assetValuationRun.startedAt), desc(schema.assetValuationRun.id))
      .limit(limit)
  },
})

/** Identity attributes of external instruments, keyed by instrumentKey. */
export const createExternalInstrumentIdentityRepository = ({ db }: { db: ApiDb }) => ({
  listIdentity: async () => {
    return db
      .select({
        instrumentKey: schema.externalInvestmentInstrument.instrumentKey,
        symbol: schema.externalInvestmentInstrument.symbol,
        isin: schema.externalInvestmentInstrument.isin,
        conid: schema.externalInvestmentInstrument.conid,
        binanceAsset: schema.externalInvestmentInstrument.binanceAsset,
        currency: schema.externalInvestmentInstrument.currency,
      })
      .from(schema.externalInvestmentInstrument)
  },
})
