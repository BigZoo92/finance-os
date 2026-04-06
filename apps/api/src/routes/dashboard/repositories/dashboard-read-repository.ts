import { schema } from '@finance-os/db'
import { and, asc, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm'
import type { ApiDb, DashboardReadRepository, DashboardTransactionCursor } from '../types'

const toCursorPredicate = (cursor: DashboardTransactionCursor | null) => {
  if (!cursor) {
    return null
  }

  return or(
    lt(schema.transaction.bookingDate, cursor.bookingDate),
    and(
      eq(schema.transaction.bookingDate, cursor.bookingDate),
      lt(schema.transaction.id, cursor.id)
    )
  )
}

const normalizeMerchantOverride = (merchant: string | null | undefined) => {
  if (merchant === null || merchant === undefined) {
    return null
  }

  const trimmed = merchant.trim()
  return trimmed.length > 0 ? trimmed : null
}

const goalSelection = {
  id: schema.personalGoal.id,
  name: schema.personalGoal.name,
  goalType: schema.personalGoal.goalType,
  currency: schema.personalGoal.currency,
  targetAmount: schema.personalGoal.targetAmount,
  currentAmount: schema.personalGoal.currentAmount,
  targetDate: schema.personalGoal.targetDate,
  note: schema.personalGoal.note,
  progressSnapshots: schema.personalGoal.progressSnapshots,
  archivedAt: schema.personalGoal.archivedAt,
  createdAt: schema.personalGoal.createdAt,
  updatedAt: schema.personalGoal.updatedAt,
} as const

const getGoalRowById = async ({ db, goalId }: { db: ApiDb; goalId: number }) => {
  const [row] = await db
    .select(goalSelection)
    .from(schema.personalGoal)
    .where(eq(schema.personalGoal.id, goalId))
    .limit(1)

  return row ?? null
}

export const createDashboardReadRepository = ({ db }: { db: ApiDb }): DashboardReadRepository => {
  return {
    async listAccountsWithConnections() {
      return db
        .select({
          powensAccountId: schema.financialAccount.powensAccountId,
          powensConnectionId: schema.financialAccount.powensConnectionId,
          source: schema.powensConnection.source,
          provider: schema.powensConnection.provider,
          providerConnectionId: schema.powensConnection.providerConnectionId,
          providerInstitutionId: schema.powensConnection.providerInstitutionId,
          providerInstitutionName: schema.powensConnection.providerInstitutionName,
          accountName: schema.financialAccount.name,
          accountCurrency: schema.financialAccount.currency,
          accountType: schema.financialAccount.type,
          accountMetadata: schema.financialAccount.metadata,
          enabled: schema.financialAccount.enabled,
          accountBalance: schema.financialAccount.balance,
          connectionStatus: schema.powensConnection.status,
          lastSyncAttemptAt: schema.powensConnection.lastSyncAttemptAt,
          lastSyncAt: schema.powensConnection.lastSyncAt,
          lastSuccessAt: schema.powensConnection.lastSuccessAt,
          lastFailedAt: schema.powensConnection.lastFailedAt,
          lastError: schema.powensConnection.lastError,
          syncMetadata: schema.powensConnection.syncMetadata,
        })
        .from(schema.financialAccount)
        .leftJoin(
          schema.powensConnection,
          eq(schema.financialAccount.powensConnectionId, schema.powensConnection.powensConnectionId)
        )
        .orderBy(desc(schema.financialAccount.updatedAt), desc(schema.financialAccount.id))
    },

    async listAssets() {
      return db
        .select({
          assetId: schema.asset.id,
          assetType: schema.asset.assetType,
          origin: schema.asset.origin,
          source: schema.asset.source,
          provider: schema.asset.provider,
          providerConnectionId: schema.asset.providerConnectionId,
          providerInstitutionName: schema.powensConnection.providerInstitutionName,
          powensConnectionId: schema.asset.powensConnectionId,
          powensAccountId: schema.asset.powensAccountId,
          name: schema.asset.name,
          currency: schema.asset.currency,
          valuation: schema.asset.valuation,
          valuationAsOf: schema.asset.valuationAsOf,
          enabled: schema.asset.enabled,
          metadata: schema.asset.metadata,
        })
        .from(schema.asset)
        .leftJoin(
          schema.powensConnection,
          eq(schema.asset.powensConnectionId, schema.powensConnection.powensConnectionId)
        )
        .orderBy(desc(schema.asset.updatedAt), desc(schema.asset.id))
    },

    async listInvestmentPositions() {
      return db
        .select({
          positionId: schema.investmentPosition.id,
          positionKey: schema.investmentPosition.positionKey,
          assetId: schema.investmentPosition.assetId,
          powensAccountId: schema.investmentPosition.powensAccountId,
          powensConnectionId: schema.investmentPosition.powensConnectionId,
          source: schema.investmentPosition.source,
          provider: schema.investmentPosition.provider,
          providerConnectionId: schema.investmentPosition.providerConnectionId,
          providerPositionId: schema.investmentPosition.providerPositionId,
          assetName: schema.asset.name,
          accountName: schema.financialAccount.name,
          name: schema.investmentPosition.name,
          currency: schema.investmentPosition.currency,
          quantity: schema.investmentPosition.quantity,
          costBasis: schema.investmentPosition.costBasis,
          costBasisSource: schema.investmentPosition.costBasisSource,
          currentValue: schema.investmentPosition.currentValue,
          lastKnownValue: schema.investmentPosition.lastKnownValue,
          openedAt: schema.investmentPosition.openedAt,
          closedAt: schema.investmentPosition.closedAt,
          valuedAt: schema.investmentPosition.valuedAt,
          lastSyncedAt: schema.investmentPosition.lastSyncedAt,
          metadata: schema.investmentPosition.metadata,
        })
        .from(schema.investmentPosition)
        .leftJoin(schema.asset, eq(schema.investmentPosition.assetId, schema.asset.id))
        .leftJoin(
          schema.financialAccount,
          eq(schema.investmentPosition.powensAccountId, schema.financialAccount.powensAccountId)
        )
        .orderBy(desc(schema.investmentPosition.valuedAt), desc(schema.investmentPosition.id))
    },

    async getFlowTotals(fromDate) {
      const [row] = await db
        .select({
          income: sql<string>`coalesce(sum(case when ${schema.transaction.amount} > 0 then ${schema.transaction.amount} else 0 end), 0)::text`,
          expenses: sql<string>`coalesce(sum(case when ${schema.transaction.amount} < 0 then abs(${schema.transaction.amount}) else 0 end), 0)::text`,
        })
        .from(schema.transaction)
        .where(gte(schema.transaction.bookingDate, fromDate))

      return {
        income: row?.income ?? '0',
        expenses: row?.expenses ?? '0',
      }
    },

    async listDailyNetFlows(fromDate) {
      const netAmountExpr = sql<string>`coalesce(sum(${schema.transaction.amount}), 0)::text`

      return db
        .select({
          bookingDate: schema.transaction.bookingDate,
          netAmount: netAmountExpr,
        })
        .from(schema.transaction)
        .where(gte(schema.transaction.bookingDate, fromDate))
        .groupBy(schema.transaction.bookingDate)
        .orderBy(desc(schema.transaction.bookingDate))
    },

    async listTopExpenseGroups(fromDate, limit) {
      const categoryExpr = sql<string>`coalesce(nullif(${schema.transaction.category}, ''), 'Unknown')`
      const merchantExpr = sql<string>`coalesce(nullif(${schema.transaction.customMerchant}, ''), nullif(${schema.transaction.merchant}, ''), ${schema.transaction.label})`
      const totalExpr = sql<string>`sum(abs(${schema.transaction.amount}))::text`
      const countExpr = sql<number>`count(*)::int`

      return db
        .select({
          category: categoryExpr,
          merchant: merchantExpr,
          total: totalExpr,
          count: countExpr,
        })
        .from(schema.transaction)
        .where(
          and(gte(schema.transaction.bookingDate, fromDate), lt(schema.transaction.amount, '0'))
        )
        .groupBy(categoryExpr, merchantExpr)
        .orderBy(desc(totalExpr))
        .limit(limit)
    },

    async listTransactions({ fromDate, limit, cursor }) {
      const cursorPredicate = toCursorPredicate(cursor)
      const whereClause = cursorPredicate
        ? and(gte(schema.transaction.bookingDate, fromDate), cursorPredicate)
        : gte(schema.transaction.bookingDate, fromDate)

      return db
        .select({
          id: schema.transaction.id,
          bookingDate: schema.transaction.bookingDate,
          amount: schema.transaction.amount,
          currency: schema.transaction.currency,
          label: schema.transaction.label,
          merchant: sql<string>`coalesce(nullif(${schema.transaction.customMerchant}, ''), nullif(${schema.transaction.merchant}, ''), ${schema.transaction.label})`,
          providerCategory: schema.transaction.category,
          customCategory: schema.transaction.customCategory,
          customSubcategory: schema.transaction.customSubcategory,
          category: sql<string | null>`coalesce(nullif(${schema.transaction.customCategory}, ''), nullif(${schema.transaction.category}, ''))`,
          subcategory: schema.transaction.customSubcategory,
          incomeType: sql<'salary' | 'recurring' | 'exceptional' | null>`case
            when ${schema.transaction.amount} <= 0 then null
            else coalesce(nullif(${schema.transaction.customIncomeType}, ''), 'exceptional')
          end`,
          tags: sql<string[]>`coalesce(${schema.transaction.customTags}, '[]'::jsonb)`,
          powensConnectionId: schema.transaction.powensConnectionId,
          powensAccountId: schema.transaction.powensAccountId,
          accountName: schema.financialAccount.name,
        })
        .from(schema.transaction)
        .leftJoin(
          schema.financialAccount,
          eq(schema.transaction.powensAccountId, schema.financialAccount.powensAccountId)
        )
        .where(whereClause)
        .orderBy(desc(schema.transaction.bookingDate), desc(schema.transaction.id))
        .limit(limit)
    },

    async listTransactionSyncMetadata(connectionIds) {
      if (connectionIds.length === 0) {
        return []
      }

      return db
        .select({
          powensConnectionId: schema.powensConnection.powensConnectionId,
          connectionStatus: schema.powensConnection.status,
          lastSyncStatus: schema.powensConnection.lastSyncStatus,
          lastSyncReasonCode: schema.powensConnection.lastSyncReasonCode,
          lastSyncAt: schema.powensConnection.lastSyncAt,
          lastSyncAttemptAt: schema.powensConnection.lastSyncAttemptAt,
          lastFailedAt: schema.powensConnection.lastFailedAt,
        })
        .from(schema.powensConnection)
        .where(inArray(schema.powensConnection.powensConnectionId, connectionIds))
    },

    async updateTransactionClassification(transactionId, input) {
      const [existing] = await db
        .select({
          customMerchant: schema.transaction.customMerchant,
          customMerchantHistory: schema.transaction.customMerchantHistory,
        })
        .from(schema.transaction)
        .where(eq(schema.transaction.id, transactionId))
        .limit(1)

      if (!existing) {
        return null
      }

      const updateSet: {
        customCategory: string | null
        customSubcategory: string | null
        customIncomeType: 'salary' | 'recurring' | 'exceptional' | null
        customTags: string[]
        customMerchant?: string | null
        customMerchantHistory?: Array<{
          changedAt: string
          previousMerchant: string | null
          nextMerchant: string | null
        }>
      } = {
        customCategory: input.category,
        customSubcategory: input.subcategory,
        customIncomeType: input.incomeType,
        customTags: input.tags,
      }

      if (input.merchant !== undefined) {
        const previousMerchant = normalizeMerchantOverride(existing.customMerchant)
        const nextMerchant = normalizeMerchantOverride(input.merchant)
        updateSet.customMerchant = nextMerchant

        if (previousMerchant !== nextMerchant) {
          const currentHistory = Array.isArray(existing.customMerchantHistory)
            ? existing.customMerchantHistory
            : []
          updateSet.customMerchantHistory = [
            ...currentHistory.slice(-19),
            {
              changedAt: new Date().toISOString(),
              previousMerchant,
              nextMerchant,
            },
          ]
        }
      }

      const [updated] = await db
        .update(schema.transaction)
        .set(updateSet)
        .where(eq(schema.transaction.id, transactionId))
        .returning({ id: schema.transaction.id })

      if (!updated) {
        return null
      }

      const [row] = await db
        .select({
          id: schema.transaction.id,
          bookingDate: schema.transaction.bookingDate,
          amount: schema.transaction.amount,
          currency: schema.transaction.currency,
          label: schema.transaction.label,
          merchant: sql<string>`coalesce(nullif(${schema.transaction.customMerchant}, ''), nullif(${schema.transaction.merchant}, ''), ${schema.transaction.label})`,
          providerCategory: schema.transaction.category,
          customCategory: schema.transaction.customCategory,
          customSubcategory: schema.transaction.customSubcategory,
          category: sql<string | null>`coalesce(nullif(${schema.transaction.customCategory}, ''), nullif(${schema.transaction.category}, ''))`,
          subcategory: schema.transaction.customSubcategory,
          incomeType: sql<'salary' | 'recurring' | 'exceptional' | null>`case
            when ${schema.transaction.amount} <= 0 then null
            else coalesce(nullif(${schema.transaction.customIncomeType}, ''), 'exceptional')
          end`,
          tags: sql<string[]>`coalesce(${schema.transaction.customTags}, '[]'::jsonb)`,
          powensConnectionId: schema.transaction.powensConnectionId,
          powensAccountId: schema.transaction.powensAccountId,
          accountName: schema.financialAccount.name,
        })
        .from(schema.transaction)
        .leftJoin(
          schema.financialAccount,
          eq(schema.transaction.powensAccountId, schema.financialAccount.powensAccountId)
        )
        .where(eq(schema.transaction.id, transactionId))
        .limit(1)

      return row ?? null
    },

    async listGoals() {
      return db
        .select(goalSelection)
        .from(schema.personalGoal)
        .orderBy(
          asc(schema.personalGoal.archivedAt),
          asc(schema.personalGoal.targetDate),
          asc(schema.personalGoal.id)
        )
    },

    async getGoalById(goalId) {
      return getGoalRowById({
        db,
        goalId,
      })
    },

    async createGoal(input) {
      const [created] = await db
        .insert(schema.personalGoal)
        .values({
          name: input.name,
          goalType: input.goalType,
          currency: input.currency,
          targetAmount: input.targetAmount,
          currentAmount: input.currentAmount,
          targetDate: input.targetDate,
          note: input.note,
          progressSnapshots: input.progressSnapshots,
          createdAt: input.updatedAt,
          updatedAt: input.updatedAt,
        })
        .returning({ id: schema.personalGoal.id })

      if (!created) {
        throw new Error('Failed to create personal goal')
      }

      const row = await getGoalRowById({
        db,
        goalId: created.id,
      })

      if (!row) {
        throw new Error('Failed to reload created personal goal')
      }

      return row
    },

    async updateGoal(goalId, input) {
      const [updated] = await db
        .update(schema.personalGoal)
        .set({
          name: input.name,
          goalType: input.goalType,
          currency: input.currency,
          targetAmount: input.targetAmount,
          currentAmount: input.currentAmount,
          targetDate: input.targetDate,
          note: input.note,
          progressSnapshots: input.progressSnapshots,
          updatedAt: input.updatedAt,
        })
        .where(eq(schema.personalGoal.id, goalId))
        .returning({ id: schema.personalGoal.id })

      if (!updated) {
        return null
      }

      return getGoalRowById({
        db,
        goalId,
      })
    },

    async archiveGoal(goalId, archivedAt) {
      const [updated] = await db
        .update(schema.personalGoal)
        .set({
          archivedAt,
          updatedAt: archivedAt,
        })
        .where(eq(schema.personalGoal.id, goalId))
        .returning({ id: schema.personalGoal.id })

      if (!updated) {
        return null
      }

      return getGoalRowById({
        db,
        goalId,
      })
    },

    async listNewsArticles({ topic, sourceName, limit }) {
      const predicates = []
      if (topic) {
        predicates.push(eq(schema.newsArticle.topic, topic))
      }
      if (sourceName) {
        predicates.push(eq(schema.newsArticle.sourceName, sourceName))
      }

      return db
        .select({
          id: schema.newsArticle.id,
          title: schema.newsArticle.title,
          summary: schema.newsArticle.summary,
          url: schema.newsArticle.url,
          sourceName: schema.newsArticle.sourceName,
          topic: schema.newsArticle.topic,
          language: schema.newsArticle.language,
          publishedAt: schema.newsArticle.publishedAt,
        })
        .from(schema.newsArticle)
        .where(predicates.length > 0 ? and(...predicates) : undefined)
        .orderBy(desc(schema.newsArticle.publishedAt), desc(schema.newsArticle.id))
        .limit(limit)
    },

    async upsertNewsArticles(rows) {
      if (rows.length === 0) {
        return { insertedCount: 0, dedupeDropCount: 0 }
      }

      const dedupeKeys = Array.from(new Set(rows.map(row => row.dedupeKey)))
      const existing = await db
        .select({ dedupeKey: schema.newsArticle.dedupeKey })
        .from(schema.newsArticle)
        .where(inArray(schema.newsArticle.dedupeKey, dedupeKeys))
      const existingSet = new Set(existing.map(row => row.dedupeKey))
      const toInsert = rows.filter(row => !existingSet.has(row.dedupeKey))

      if (toInsert.length > 0) {
        await db.insert(schema.newsArticle).values(
          toInsert.map(row => ({
            provider: 'hn_algolia',
            providerArticleId: row.providerArticleId,
            dedupeKey: row.dedupeKey,
            title: row.title,
            summary: row.summary,
            url: row.url,
            sourceName: row.sourceName,
            topic: row.topic,
            language: row.language,
            publishedAt: row.publishedAt,
            metadata: row.metadata,
            ingestedAt: new Date(),
            updatedAt: new Date(),
          }))
        )
      }

      return {
        insertedCount: toInsert.length,
        dedupeDropCount: rows.length - toInsert.length,
      }
    },

    async getNewsCacheState() {
      const [row] = await db
        .select({
          lastSuccessAt: schema.newsCacheState.lastSuccessAt,
          lastAttemptAt: schema.newsCacheState.lastAttemptAt,
          lastFailureAt: schema.newsCacheState.lastFailureAt,
          lastErrorCode: schema.newsCacheState.lastErrorCode,
          lastErrorMessage: schema.newsCacheState.lastErrorMessage,
          ingestionCount: schema.newsCacheState.ingestionCount,
          dedupeDropCount: schema.newsCacheState.dedupeDropCount,
          providerFailureCount: schema.newsCacheState.providerFailureCount,
        })
        .from(schema.newsCacheState)
        .where(eq(schema.newsCacheState.singleton, true))
        .limit(1)

      return row ?? null
    },

    async upsertNewsCacheState(input) {
      await db
        .insert(schema.newsCacheState)
        .values({
          singleton: true,
          ...(input.lastSuccessAt !== undefined ? { lastSuccessAt: input.lastSuccessAt } : {}),
          ...(input.lastAttemptAt !== undefined ? { lastAttemptAt: input.lastAttemptAt } : {}),
          ...(input.lastFailureAt !== undefined ? { lastFailureAt: input.lastFailureAt } : {}),
          ...(input.lastErrorCode !== undefined ? { lastErrorCode: input.lastErrorCode } : {}),
          ...(input.lastErrorMessage !== undefined ? { lastErrorMessage: input.lastErrorMessage } : {}),
          ...(input.lastRequestId !== undefined ? { lastRequestId: input.lastRequestId } : {}),
          ...(input.lastIngestDurationMs !== undefined
            ? { lastIngestDurationMs: input.lastIngestDurationMs }
            : {}),
          ...(input.ingestionCountIncrement !== undefined
            ? { ingestionCount: input.ingestionCountIncrement }
            : {}),
          ...(input.dedupeDropCountIncrement !== undefined
            ? { dedupeDropCount: input.dedupeDropCountIncrement }
            : {}),
          ...(input.providerFailureCountIncrement !== undefined
            ? { providerFailureCount: input.providerFailureCountIncrement }
            : {}),
        })
        .onConflictDoUpdate({
          target: schema.newsCacheState.singleton,
          set: {
            ...(input.lastSuccessAt !== undefined ? { lastSuccessAt: input.lastSuccessAt } : {}),
            ...(input.lastAttemptAt !== undefined ? { lastAttemptAt: input.lastAttemptAt } : {}),
            ...(input.lastFailureAt !== undefined ? { lastFailureAt: input.lastFailureAt } : {}),
            ...(input.lastErrorCode !== undefined ? { lastErrorCode: input.lastErrorCode } : {}),
            ...(input.lastErrorMessage !== undefined ? { lastErrorMessage: input.lastErrorMessage } : {}),
            ...(input.lastRequestId !== undefined ? { lastRequestId: input.lastRequestId } : {}),
            ...(input.lastIngestDurationMs !== undefined
              ? { lastIngestDurationMs: input.lastIngestDurationMs }
              : {}),
            ...(input.ingestionCountIncrement !== undefined
              ? { ingestionCount: sql`${schema.newsCacheState.ingestionCount} + ${input.ingestionCountIncrement}` }
              : {}),
            ...(input.dedupeDropCountIncrement !== undefined
              ? { dedupeDropCount: sql`${schema.newsCacheState.dedupeDropCount} + ${input.dedupeDropCountIncrement}` }
              : {}),
            ...(input.providerFailureCountIncrement !== undefined
              ? {
                  providerFailureCount: sql`${schema.newsCacheState.providerFailureCount} + ${input.providerFailureCountIncrement}`,
                }
              : {}),
            updatedAt: new Date(),
          },
        })
    },
  }
}
