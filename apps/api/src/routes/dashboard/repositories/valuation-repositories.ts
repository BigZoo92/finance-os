import { schema } from '@finance-os/db'
import { and, desc, eq } from 'drizzle-orm'
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
})
