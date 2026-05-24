import { schema } from '@finance-os/db'
import { and, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm'
import type { ApiDb } from '../types'

export const createInvestmentStrategyRepository = ({ db }: { db: ApiDb }) => {
  const getActiveStrategy = async () => {
    const [strategy] = await db
      .select()
      .from(schema.investmentStrategyProfile)
      .where(eq(schema.investmentStrategyProfile.status, 'active'))
      .orderBy(desc(schema.investmentStrategyProfile.updatedAt))
      .limit(1)
    return strategy ?? null
  }

  const getStrategyBundle = async (strategyId: number) => {
    const [strategy, buckets, accountPolicies, candidates] = await Promise.all([
      db
        .select()
        .from(schema.investmentStrategyProfile)
        .where(eq(schema.investmentStrategyProfile.id, strategyId))
        .limit(1),
      db
        .select()
        .from(schema.investmentStrategyBucket)
        .where(eq(schema.investmentStrategyBucket.strategyId, strategyId))
        .orderBy(schema.investmentStrategyBucket.bucketKey),
      db
        .select()
        .from(schema.accountStrategyPolicy)
        .where(eq(schema.accountStrategyPolicy.strategyId, strategyId))
        .orderBy(schema.accountStrategyPolicy.id),
      db
        .select()
        .from(schema.assetUniverseCandidate)
        .orderBy(schema.assetUniverseCandidate.bucket, schema.assetUniverseCandidate.symbol),
    ])
    return {
      strategy: strategy[0] ?? null,
      buckets,
      accountPolicies,
      candidates,
    }
  }

  const createStrategy = async (input: typeof schema.investmentStrategyProfile.$inferInsert) => {
    const [row] = await db.insert(schema.investmentStrategyProfile).values(input).returning()
    if (!row) throw new Error('INVESTMENT_STRATEGY_CREATE_FAILED')
    return row
  }

  const archiveOtherActiveStrategies = async (strategyId: number) => {
    await db
      .update(schema.investmentStrategyProfile)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(
        and(
          eq(schema.investmentStrategyProfile.status, 'active'),
          sql`${schema.investmentStrategyProfile.id} <> ${strategyId}`
        )
      )
  }

  const insertBuckets = async (
    inputs: Array<typeof schema.investmentStrategyBucket.$inferInsert>
  ) => {
    if (inputs.length === 0) return []
    return db.insert(schema.investmentStrategyBucket).values(inputs).returning()
  }

  const insertAccountPolicies = async (
    inputs: Array<typeof schema.accountStrategyPolicy.$inferInsert>
  ) => {
    if (inputs.length === 0) return []
    return db.insert(schema.accountStrategyPolicy).values(inputs).returning()
  }

  const upsertCandidates = async (
    inputs: Array<typeof schema.assetUniverseCandidate.$inferInsert>
  ) => {
    if (inputs.length === 0) return []
    const rows = []
    for (const input of inputs) {
      const [row] = await db
        .insert(schema.assetUniverseCandidate)
        .values(input)
        .onConflictDoNothing({
          target: [schema.assetUniverseCandidate.symbol, schema.assetUniverseCandidate.bucket],
        })
        .returning()
      if (row) rows.push(row)
    }
    return rows
  }

  const updateStrategyProfile = async (
    strategyId: number,
    input: Partial<typeof schema.investmentStrategyProfile.$inferInsert>
  ) => {
    const [row] = await db
      .update(schema.investmentStrategyProfile)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(schema.investmentStrategyProfile.id, strategyId))
      .returning()
    return row ?? null
  }

  const latestPricesForSymbols = async (symbols: string[]) => {
    const unique = [...new Set(symbols.filter(Boolean))]
    if (unique.length === 0) return []
    const rows = await db
      .select()
      .from(schema.assetPriceSnapshot)
      .where(inArray(schema.assetPriceSnapshot.symbol, unique))
      .orderBy(desc(schema.assetPriceSnapshot.createdAt))
    const bySymbol = new Map<string, (typeof rows)[number]>()
    for (const row of rows) {
      if (!bySymbol.has(row.symbol)) {
        bySymbol.set(row.symbol, row)
      }
    }
    return [...bySymbol.values()]
  }

  const latestProviderHealth = async (providers: string[]) => {
    const unique = [...new Set(providers.filter(Boolean))]
    if (unique.length === 0) return []
    const rows = await db
      .select()
      .from(schema.providerHealthSnapshot)
      .where(inArray(schema.providerHealthSnapshot.provider, unique))
      .orderBy(desc(schema.providerHealthSnapshot.createdAt))
    const byProvider = new Map<string, (typeof rows)[number]>()
    for (const row of rows) {
      if (!byProvider.has(row.provider)) {
        byProvider.set(row.provider, row)
      }
    }
    return [...byProvider.values()]
  }

  const insertAllocationSnapshot = async (
    input: typeof schema.portfolioAllocationSnapshot.$inferInsert
  ) => {
    const [row] = await db.insert(schema.portfolioAllocationSnapshot).values(input).returning()
    if (!row) throw new Error('ALLOCATION_SNAPSHOT_CREATE_FAILED')
    return row
  }

  const insertDriftSnapshots = async (
    inputs: Array<typeof schema.strategyDriftSnapshot.$inferInsert>
  ) => {
    if (inputs.length === 0) return []
    return db.insert(schema.strategyDriftSnapshot).values(inputs).returning()
  }

  const supersedeActivePlans = async (strategyId: number) => {
    await db
      .update(schema.advisorActionPlan)
      .set({ status: 'superseded' })
      .where(
        and(
          eq(schema.advisorActionPlan.strategyId, strategyId),
          eq(schema.advisorActionPlan.status, 'active')
        )
      )
  }

  const insertActionPlan = async (input: typeof schema.advisorActionPlan.$inferInsert) => {
    const [row] = await db.insert(schema.advisorActionPlan).values(input).returning()
    if (!row) throw new Error('ACTION_PLAN_CREATE_FAILED')
    return row
  }

  const insertActionPlanItems = async (
    inputs: Array<typeof schema.advisorActionPlanItem.$inferInsert>
  ) => {
    if (inputs.length === 0) return []
    return db.insert(schema.advisorActionPlanItem).values(inputs).returning()
  }

  const updateActionPlanTopAction = async (planId: number, topActionId: number | null) => {
    await db
      .update(schema.advisorActionPlan)
      .set({ topActionId })
      .where(eq(schema.advisorActionPlan.id, planId))
  }

  const latestActionPlan = async () => {
    const [plan] = await db
      .select()
      .from(schema.advisorActionPlan)
      .where(eq(schema.advisorActionPlan.status, 'active'))
      .orderBy(desc(schema.advisorActionPlan.generatedAt))
      .limit(1)
    if (!plan) return null
    const items = await db
      .select()
      .from(schema.advisorActionPlanItem)
      .where(eq(schema.advisorActionPlanItem.planId, plan.id))
      .orderBy(schema.advisorActionPlanItem.id)
    return { plan, items }
  }

  const latestAllocationSnapshot = async (strategyId: number) => {
    const [snapshot] = await db
      .select()
      .from(schema.portfolioAllocationSnapshot)
      .where(eq(schema.portfolioAllocationSnapshot.strategyId, strategyId))
      .orderBy(desc(schema.portfolioAllocationSnapshot.snapshotAt))
      .limit(1)
    if (!snapshot) return null
    const drift = await db
      .select()
      .from(schema.strategyDriftSnapshot)
      .where(eq(schema.strategyDriftSnapshot.snapshotId, snapshot.id))
      .orderBy(schema.strategyDriftSnapshot.bucket)
    return { snapshot, drift }
  }

  const insertInvestmentRecommendation = async (
    input: typeof schema.advisorInvestmentRecommendation.$inferInsert
  ) => {
    const [row] = await db.insert(schema.advisorInvestmentRecommendation).values(input).returning()
    return row ?? null
  }

  const insertHypothesis = async (input: typeof schema.advisorMarketHypothesis.$inferInsert) => {
    const [row] = await db.insert(schema.advisorMarketHypothesis).values(input).returning()
    return row ?? null
  }

  const updateActionPlanItemHypothesis = async (itemId: number, hypothesisId: number) => {
    await db
      .update(schema.advisorActionPlanItem)
      .set({ createdHypothesisId: hypothesisId })
      .where(eq(schema.advisorActionPlanItem.id, itemId))
  }

  const insertPredictionOutcomes = async (
    inputs: Array<typeof schema.advisorPredictionOutcome.$inferInsert>
  ) => {
    if (inputs.length === 0) return []
    return db.insert(schema.advisorPredictionOutcome).values(inputs).returning()
  }

  const duePredictionOutcomes = async (now: Date, limit = 50) => {
    return db
      .select({
        outcome: schema.advisorPredictionOutcome,
        hypothesis: schema.advisorMarketHypothesis,
      })
      .from(schema.advisorPredictionOutcome)
      .innerJoin(
        schema.advisorMarketHypothesis,
        eq(schema.advisorPredictionOutcome.hypothesisId, schema.advisorMarketHypothesis.id)
      )
      .where(
        and(
          isNull(schema.advisorPredictionOutcome.reviewedAt),
          lte(schema.advisorPredictionOutcome.reviewDueAt, now),
          eq(schema.advisorMarketHypothesis.status, 'open')
        )
      )
      .orderBy(schema.advisorPredictionOutcome.reviewDueAt)
      .limit(limit)
  }

  const updatePredictionOutcome = async (
    outcomeId: number,
    input: Partial<typeof schema.advisorPredictionOutcome.$inferInsert>
  ) => {
    const [row] = await db
      .update(schema.advisorPredictionOutcome)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(schema.advisorPredictionOutcome.id, outcomeId))
      .returning()
    return row ?? null
  }

  const closeHypothesisIfComplete = async (hypothesisId: number) => {
    const remaining = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.advisorPredictionOutcome)
      .where(
        and(
          eq(schema.advisorPredictionOutcome.hypothesisId, hypothesisId),
          isNull(schema.advisorPredictionOutcome.reviewedAt)
        )
      )
    if ((remaining[0]?.count ?? 0) === 0) {
      await db
        .update(schema.advisorMarketHypothesis)
        .set({ status: 'closed', updatedAt: new Date() })
        .where(eq(schema.advisorMarketHypothesis.id, hypothesisId))
    } else {
      await db
        .update(schema.advisorMarketHypothesis)
        .set({ status: 'partially_reviewed', updatedAt: new Date() })
        .where(eq(schema.advisorMarketHypothesis.id, hypothesisId))
    }
  }

  const recentOutcomesWithHypotheses = async (limit = 200) => {
    return db
      .select({
        outcome: schema.advisorPredictionOutcome,
        hypothesis: schema.advisorMarketHypothesis,
      })
      .from(schema.advisorPredictionOutcome)
      .innerJoin(
        schema.advisorMarketHypothesis,
        eq(schema.advisorPredictionOutcome.hypothesisId, schema.advisorMarketHypothesis.id)
      )
      .where(sql`${schema.advisorPredictionOutcome.reviewedAt} is not null`)
      .orderBy(desc(schema.advisorPredictionOutcome.reviewedAt))
      .limit(limit)
  }

  const insertPostMortem = async (input: typeof schema.advisorMarketPostMortem.$inferInsert) => {
    const [row] = await db.insert(schema.advisorMarketPostMortem).values(input).returning()
    return row ?? null
  }

  const insertStrategyLesson = async (input: typeof schema.strategyLesson.$inferInsert) => {
    const [row] = await db.insert(schema.strategyLesson).values(input).returning()
    return row ?? null
  }

  const listLessons = async (strategyId: number, limit = 50) => {
    return db
      .select()
      .from(schema.strategyLesson)
      .where(eq(schema.strategyLesson.strategyId, strategyId))
      .orderBy(desc(schema.strategyLesson.createdAt))
      .limit(limit)
  }

  const updateLessonStatus = async (
    lessonId: number,
    status: 'approved' | 'rejected' | 'archived'
  ) => {
    const [row] = await db
      .update(schema.strategyLesson)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.strategyLesson.id, lessonId))
      .returning()
    return row ?? null
  }

  const insertCalibrationSnapshot = async (
    input: typeof schema.advisorCalibrationSnapshot.$inferInsert
  ) => {
    const [row] = await db.insert(schema.advisorCalibrationSnapshot).values(input).returning()
    return row ?? null
  }

  const latestCalibrationSnapshot = async (strategyId: number) => {
    const [row] = await db
      .select()
      .from(schema.advisorCalibrationSnapshot)
      .where(eq(schema.advisorCalibrationSnapshot.strategyId, strategyId))
      .orderBy(desc(schema.advisorCalibrationSnapshot.generatedAt))
      .limit(1)
    return row ?? null
  }

  const insertMemoryEvent = async (input: typeof schema.advisorMemoryEvent.$inferInsert) => {
    const [row] = await db.insert(schema.advisorMemoryEvent).values(input).returning()
    return row ?? null
  }

  const updateMemoryEventGraphStatus = async (
    eventId: number,
    input: {
      graphWriteStatus: 'pending' | 'sent' | 'skipped' | 'failed'
      graphWriteError?: string | null
      nodesWritten?: number
      edgesWritten?: number
      vectorsWritten?: number
    }
  ) => {
    await db
      .update(schema.advisorMemoryEvent)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(schema.advisorMemoryEvent.id, eventId))
  }

  const memoryEventStats = async () => {
    const rows = await db
      .select({
        status: schema.advisorMemoryEvent.graphWriteStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.advisorMemoryEvent)
      .groupBy(schema.advisorMemoryEvent.graphWriteStatus)
    const [latestFailure] = await db
      .select()
      .from(schema.advisorMemoryEvent)
      .where(eq(schema.advisorMemoryEvent.graphWriteStatus, 'failed'))
      .orderBy(desc(schema.advisorMemoryEvent.updatedAt))
      .limit(1)
    return { rows, latestFailure: latestFailure ?? null }
  }

  const memoryEventStatsForPlan = async (planId: number) => {
    const planIdText = String(planId)
    const planFilter = sql`${schema.advisorMemoryEvent.payload}->>'planId' = ${planIdText}`
    const rows = await db
      .select({
        status: schema.advisorMemoryEvent.graphWriteStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.advisorMemoryEvent)
      .where(planFilter)
      .groupBy(schema.advisorMemoryEvent.graphWriteStatus)
    const [latestFailure] = await db
      .select()
      .from(schema.advisorMemoryEvent)
      .where(and(eq(schema.advisorMemoryEvent.graphWriteStatus, 'failed'), planFilter))
      .orderBy(desc(schema.advisorMemoryEvent.updatedAt))
      .limit(1)
    return { rows, latestFailure: latestFailure ?? null }
  }

  const getLatestContextBundleRow = async () => {
    const [row] = await db
      .select()
      .from(schema.advisorInvestmentContextBundle)
      .where(eq(schema.advisorInvestmentContextBundle.singleton, true))
      .limit(1)
    return row ?? null
  }

  const upsertContextBundle = async (input: {
    requestId: string
    generatedAt: Date
    bundle: Record<string, unknown>
    staleAfterMinutes: number
    providerCoverage: Array<Record<string, unknown>>
  }) => {
    await db
      .insert(schema.advisorInvestmentContextBundle)
      .values({
        singleton: true,
        schemaVersion: '2026-05-23-investment-strategy',
        generatedAt: input.generatedAt,
        requestId: input.requestId,
        bundle: input.bundle,
        staleAfterMinutes: input.staleAfterMinutes,
        providerCoverage: input.providerCoverage,
        updatedAt: input.generatedAt,
      })
      .onConflictDoUpdate({
        target: schema.advisorInvestmentContextBundle.singleton,
        set: {
          schemaVersion: '2026-05-23-investment-strategy',
          generatedAt: input.generatedAt,
          requestId: input.requestId,
          bundle: input.bundle,
          staleAfterMinutes: input.staleAfterMinutes,
          providerCoverage: input.providerCoverage,
          updatedAt: input.generatedAt,
        },
      })
  }

  return {
    getActiveStrategy,
    getStrategyBundle,
    createStrategy,
    archiveOtherActiveStrategies,
    insertBuckets,
    insertAccountPolicies,
    upsertCandidates,
    updateStrategyProfile,
    latestPricesForSymbols,
    latestProviderHealth,
    insertAllocationSnapshot,
    insertDriftSnapshots,
    supersedeActivePlans,
    insertActionPlan,
    insertActionPlanItems,
    updateActionPlanTopAction,
    latestActionPlan,
    latestAllocationSnapshot,
    insertInvestmentRecommendation,
    insertHypothesis,
    updateActionPlanItemHypothesis,
    insertPredictionOutcomes,
    duePredictionOutcomes,
    updatePredictionOutcome,
    closeHypothesisIfComplete,
    recentOutcomesWithHypotheses,
    insertPostMortem,
    insertStrategyLesson,
    listLessons,
    updateLessonStatus,
    insertCalibrationSnapshot,
    latestCalibrationSnapshot,
    insertMemoryEvent,
    updateMemoryEventGraphStatus,
    memoryEventStats,
    memoryEventStatsForPlan,
    getLatestContextBundleRow,
    upsertContextBundle,
  }
}

export type InvestmentStrategyRepository = ReturnType<typeof createInvestmentStrategyRepository>
