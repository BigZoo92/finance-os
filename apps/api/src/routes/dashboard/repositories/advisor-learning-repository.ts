import { schema } from '@finance-os/db'
import { desc, eq } from 'drizzle-orm'
import type { ApiDb } from '../types'

export const createAdvisorInvestmentRecommendationRepository = ({ db }: { db: ApiDb }) => ({
  insert: async (input: typeof schema.advisorInvestmentRecommendation.$inferInsert) => {
    const [row] = await db.insert(schema.advisorInvestmentRecommendation).values(input).returning()
    return row ?? null
  },
})

export const createAdvisorPredictionJournalRepository = ({ db }: { db: ApiDb }) => ({
  insertHypothesis: async (input: typeof schema.advisorMarketHypothesis.$inferInsert) => {
    const [row] = await db.insert(schema.advisorMarketHypothesis).values(input).returning()
    return row ?? null
  },
  insertOutcome: async (input: typeof schema.advisorPredictionOutcome.$inferInsert) => {
    const [row] = await db.insert(schema.advisorPredictionOutcome).values(input).returning()
    return row ?? null
  },
  insertPostMortem: async (input: typeof schema.advisorMarketPostMortem.$inferInsert) => {
    const [row] = await db.insert(schema.advisorMarketPostMortem).values(input).returning()
    return row ?? null
  },
  insertMemoryEvent: async (input: typeof schema.advisorMemoryEvent.$inferInsert) => {
    const [row] = await db.insert(schema.advisorMemoryEvent).values(input).returning()
    return row ?? null
  },
  latestMemoryEventForHypothesis: async (hypothesisId: number) => {
    const [row] = await db
      .select()
      .from(schema.advisorMemoryEvent)
      .where(eq(schema.advisorMemoryEvent.hypothesisId, hypothesisId))
      .orderBy(desc(schema.advisorMemoryEvent.createdAt))
      .limit(1)
    return row ?? null
  },
})
