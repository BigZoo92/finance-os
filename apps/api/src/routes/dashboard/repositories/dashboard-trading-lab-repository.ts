import { and, desc, eq, sql } from 'drizzle-orm'
import { schema } from '@finance-os/db'
import type { ApiDb } from '../types'

const {
  attentionItem,
  tradingLabBacktestRun,
  tradingLabPaperScenario,
  tradingLabSignalLink,
  tradingLabStrategy,
} = schema

export const createDashboardTradingLabRepository = ({ db }: { db: ApiDb }) => {
  // ---------------------------------------------------------------------------
  // Strategies
  // ---------------------------------------------------------------------------

  const listStrategies = async (opts?: { status?: string; limit?: number }) => {
    const conditions = []
    if (opts?.status) conditions.push(sql`${tradingLabStrategy.status} = ${opts.status}`)

    const query = db
      .select()
      .from(tradingLabStrategy)
      .orderBy(desc(tradingLabStrategy.updatedAt))
      .limit(opts?.limit ?? 50)

    if (conditions.length > 0) {
      return query.where(and(...conditions))
    }
    return query
  }

  const getStrategy = async (id: number) => {
    const rows = await db
      .select()
      .from(tradingLabStrategy)
      .where(eq(tradingLabStrategy.id, id))
      .limit(1)
    return rows[0] ?? null
  }

  const createStrategy = async (input: {
    name: string
    slug: string
    description?: string
    strategyType?: string
    status?: string
    enabled?: boolean
    tags?: string[]
    parameters?: Record<string, unknown>
    indicators?: Array<{ name: string; params: Record<string, unknown> }>
    entryRules?: Array<{ id: string; description: string; condition: string }>
    exitRules?: Array<{ id: string; description: string; condition: string }>
    riskRules?: Array<{ id: string; description: string; condition: string }>
    assumptions?: string[]
    caveats?: string[]
  }) => {
    const rows = await db
      .insert(tradingLabStrategy)
      .values({
        name: input.name,
        slug: input.slug,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.strategyType !== undefined ? { strategyType: input.strategyType as 'technical' } : {}),
        ...(input.status !== undefined ? { status: input.status as 'draft' } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.tags ? { tags: input.tags } : {}),
        ...(input.parameters ? { parameters: input.parameters } : {}),
        ...(input.indicators ? { indicators: input.indicators } : {}),
        ...(input.entryRules ? { entryRules: input.entryRules } : {}),
        ...(input.exitRules ? { exitRules: input.exitRules } : {}),
        ...(input.riskRules ? { riskRules: input.riskRules } : {}),
        ...(input.assumptions ? { assumptions: input.assumptions } : {}),
        ...(input.caveats ? { caveats: input.caveats } : {}),
      })
      .returning()
    return rows[0]!
  }

  const updateStrategy = async (
    id: number,
    input: Record<string, unknown>
  ) => {
    const rows = await db
      .update(tradingLabStrategy)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(tradingLabStrategy.id, id))
      .returning()
    return rows[0] ?? null
  }

  const archiveStrategy = async (id: number) =>
    updateStrategy(id, { status: 'archived' })

  // ---------------------------------------------------------------------------
  // Backtest runs
  // ---------------------------------------------------------------------------

  const listBacktestRuns = async (opts?: { strategyId?: number; limit?: number }) => {
    const conditions = []
    if (opts?.strategyId) conditions.push(eq(tradingLabBacktestRun.strategyId, opts.strategyId))

    const query = db
      .select()
      .from(tradingLabBacktestRun)
      .orderBy(desc(tradingLabBacktestRun.createdAt))
      .limit(opts?.limit ?? 20)

    if (conditions.length > 0) {
      return query.where(and(...conditions))
    }
    return query
  }

  const getBacktestRun = async (id: number) => {
    const rows = await db
      .select()
      .from(tradingLabBacktestRun)
      .where(eq(tradingLabBacktestRun.id, id))
      .limit(1)
    return rows[0] ?? null
  }

  const createBacktestRun = async (input: {
    strategyId: number
    name: string
    symbol: string
    timeframe?: string
    startDate: Date
    endDate: Date
    initialCash?: number
    feesBps?: number
    slippageBps?: number
    spreadBps?: number
    marketDataSource?: string
  }) => {
    const rows = await db
      .insert(tradingLabBacktestRun)
      .values({
        strategyId: input.strategyId,
        name: input.name,
        symbol: input.symbol,
        startDate: input.startDate,
        endDate: input.endDate,
        ...(input.timeframe !== undefined ? { timeframe: input.timeframe } : {}),
        ...(input.initialCash !== undefined ? { initialCash: input.initialCash } : {}),
        ...(input.feesBps !== undefined ? { feesBps: input.feesBps } : {}),
        ...(input.slippageBps !== undefined ? { slippageBps: input.slippageBps } : {}),
        ...(input.spreadBps !== undefined ? { spreadBps: input.spreadBps } : {}),
        ...(input.marketDataSource !== undefined ? { marketDataSource: input.marketDataSource } : {}),
        runStatus: 'pending',
      })
      .returning()
    return rows[0]!
  }

  const updateBacktestRunResult = async (
    id: number,
    result: Record<string, unknown>
  ) => {
    const rows = await db
      .update(tradingLabBacktestRun)
      .set({ ...result, updatedAt: new Date() })
      .where(eq(tradingLabBacktestRun.id, id))
      .returning()
    return rows[0] ?? null
  }

  // ---------------------------------------------------------------------------
  // Paper scenarios
  // ---------------------------------------------------------------------------

  const listScenarios = async (opts?: { status?: string; limit?: number }) => {
    const conditions = []
    if (opts?.status) conditions.push(sql`${tradingLabPaperScenario.status} = ${opts.status}`)

    const query = db
      .select()
      .from(tradingLabPaperScenario)
      .orderBy(desc(tradingLabPaperScenario.updatedAt))
      .limit(opts?.limit ?? 50)

    if (conditions.length > 0) {
      return query.where(and(...conditions))
    }
    return query
  }

  const createScenario = async (input: {
    name: string
    description?: string
    linkedSignalItemId?: number
    linkedNewsArticleId?: number
    linkedStrategyId?: number
    thesis?: string
    expectedOutcome?: string
    invalidationCriteria?: string
    riskNotes?: string
  }) => {
    const rows = await db
      .insert(tradingLabPaperScenario)
      .values(input)
      .returning()
    return rows[0]!
  }

  const updateScenario = async (
    id: number,
    input: Record<string, unknown>
  ) => {
    const rows = await db
      .update(tradingLabPaperScenario)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(tradingLabPaperScenario.id, id))
      .returning()
    return rows[0] ?? null
  }

  // ---------------------------------------------------------------------------
  // Attention items
  // ---------------------------------------------------------------------------

  const listAttentionItems = async (opts?: {
    status?: string
    sourceType?: string
    severity?: string
    limit?: number
  }) => {
    const conditions = [
      sql`(${attentionItem.expiresAt} IS NULL OR ${attentionItem.expiresAt} > NOW())`,
    ]
    if (opts?.status) conditions.push(sql`${attentionItem.status} = ${opts.status}`)
    if (opts?.sourceType) conditions.push(sql`${attentionItem.sourceType} = ${opts.sourceType}`)
    if (opts?.severity) conditions.push(sql`${attentionItem.severity} = ${opts.severity}`)

    return db
      .select()
      .from(attentionItem)
      .where(and(...conditions))
      .orderBy(desc(attentionItem.createdAt))
      .limit(opts?.limit ?? 50)
  }

  const upsertAttentionItem = async (input: {
    sourceType: 'signal' | 'provider-health' | 'advisor' | 'budget' | 'portfolio' | 'trading-lab' | 'system'
    sourceId?: string
    severity: 'info' | 'watch' | 'important' | 'critical'
    title: string
    summary?: string
    reason?: string
    actionHref?: string
    dedupeKey: string
    expiresAt?: Date
  }) => {
    const rows = await db
      .insert(attentionItem)
      .values({
        sourceType: input.sourceType,
        title: input.title,
        dedupeKey: input.dedupeKey,
        severity: input.severity,
        ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
        ...(input.actionHref !== undefined ? { actionHref: input.actionHref } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      })
      .onConflictDoUpdate({
        target: [attentionItem.dedupeKey],
        set: {
          title: input.title,
          ...(input.summary !== undefined ? { summary: input.summary } : {}),
          severity: input.severity,
          updatedAt: new Date(),
        },
      })
      .returning()
    return rows[0]!
  }

  const updateAttentionItemStatus = async (
    id: number,
    status: 'open' | 'acknowledged' | 'dismissed' | 'resolved'
  ) => {
    const now = new Date()
    const rows = await db
      .update(attentionItem)
      .set({
        status,
        updatedAt: now,
        ...(status === 'acknowledged' ? { acknowledgedAt: now } : {}),
        ...(status === 'resolved' ? { resolvedAt: now } : {}),
      })
      .where(eq(attentionItem.id, id))
      .returning()
    return rows[0] ?? null
  }

  const countOpenAttentionItems = async () => {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(attentionItem)
      .where(
        and(
          eq(attentionItem.status, 'open'),
          sql`(${attentionItem.expiresAt} IS NULL OR ${attentionItem.expiresAt} > NOW())`
        )
      )
    return result[0]?.count ?? 0
  }

  return {
    listStrategies,
    getStrategy,
    createStrategy,
    updateStrategy,
    archiveStrategy,
    listBacktestRuns,
    getBacktestRun,
    createBacktestRun,
    updateBacktestRunResult,
    listScenarios,
    createScenario,
    updateScenario,
    listAttentionItems,
    upsertAttentionItem,
    updateAttentionItemStatus,
    countOpenAttentionItems,
  }
}
