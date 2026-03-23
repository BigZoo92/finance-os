import { schema } from '@finance-os/db'
import { and, desc, eq, gte, lt, or, sql } from 'drizzle-orm'
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

export const createDashboardReadRepository = ({ db }: { db: ApiDb }): DashboardReadRepository => {
  return {
    async listAccountsWithConnections() {
      return db
        .select({
          powensAccountId: schema.bankAccount.powensAccountId,
          powensConnectionId: schema.bankAccount.powensConnectionId,
          source: schema.powensConnection.source,
          provider: schema.powensConnection.provider,
          providerConnectionId: schema.powensConnection.providerConnectionId,
          providerInstitutionId: schema.powensConnection.providerInstitutionId,
          providerInstitutionName: schema.powensConnection.providerInstitutionName,
          accountName: schema.bankAccount.name,
          accountCurrency: schema.bankAccount.currency,
          accountType: schema.bankAccount.type,
          enabled: schema.bankAccount.enabled,
          accountRaw: schema.bankAccount.raw,
          connectionStatus: schema.powensConnection.status,
          lastSyncAttemptAt: schema.powensConnection.lastSyncAttemptAt,
          lastSyncAt: schema.powensConnection.lastSyncAt,
          lastSuccessAt: schema.powensConnection.lastSuccessAt,
          lastFailedAt: schema.powensConnection.lastFailedAt,
          lastError: schema.powensConnection.lastError,
          syncMetadata: schema.powensConnection.syncMetadata,
        })
        .from(schema.bankAccount)
        .leftJoin(
          schema.powensConnection,
          eq(schema.bankAccount.powensConnectionId, schema.powensConnection.powensConnectionId)
        )
        .orderBy(desc(schema.bankAccount.updatedAt), desc(schema.bankAccount.id))
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

    async listTopExpenseGroups(fromDate, limit) {
      const categoryExpr = sql<string>`coalesce(
        nullif(${schema.transaction.raw} ->> 'category', ''),
        nullif(${schema.transaction.raw} ->> 'category_name', ''),
        'Unknown'
      )`
      const merchantExpr = sql<string>`coalesce(
        nullif(${schema.transaction.raw} ->> 'original_wording', ''),
        nullif(${schema.transaction.raw} ->> 'wording', ''),
        ${schema.transaction.label}
      )`
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
          powensConnectionId: schema.transaction.powensConnectionId,
          powensAccountId: schema.transaction.powensAccountId,
          accountName: schema.bankAccount.name,
        })
        .from(schema.transaction)
        .leftJoin(
          schema.bankAccount,
          eq(schema.transaction.powensAccountId, schema.bankAccount.powensAccountId)
        )
        .where(whereClause)
        .orderBy(desc(schema.transaction.bookingDate), desc(schema.transaction.id))
        .limit(limit)
    },
  }
}
