import { schema } from '@finance-os/db'
import { and, desc, eq, gte, isNull, or } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { requireAdmin } from '../../../auth/guard'
import type { ApiDb } from '../types'
import {
  applyTransactionAutoCategorization,
  type UserCategorizationRule,
} from '../domain/transaction-auto-categorization'
import { createUserCategorizationRuleRepository } from '../repositories/user-categorization-rule-repository'

const backfillBodySchema = t.Object({
  dryRun: t.Optional(t.Boolean()),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 5000 })),
  sinceBookingDate: t.Optional(t.String()),
  rulesetVersion: t.Optional(t.String()),
})

type BackfillBody = {
  dryRun?: boolean
  limit?: number
  sinceBookingDate?: string
  rulesetVersion?: string
}

type BackfillCounts = {
  scanned: number
  withCustomOverride: number
  unchanged: number
  changed: number
  byCategory: Record<string, number>
}

const emptyCounts = (): BackfillCounts => ({
  scanned: 0,
  withCustomOverride: 0,
  unchanged: 0,
  changed: 0,
  byCategory: {},
})

const isUnknownCategory = (value: string | null) => !value || value === 'Unknown'

const runBackfill = async ({
  db,
  body,
  userRules = [],
}: {
  db: ApiDb
  body: BackfillBody
  userRules?: UserCategorizationRule[]
}): Promise<{
  dryRun: boolean
  limit: number
  counts: BackfillCounts
  sampleChanges: Array<{
    id: number
    from: string | null
    to: string
    subcategory: string | null
    ruleId: string | null
  }>
}> => {
  const dryRun = body.dryRun !== false
  const limit = body.limit ?? 5000

  const filters = [
    or(isNull(schema.transaction.customCategory), eq(schema.transaction.customCategory, '')),
  ]
  if (body.sinceBookingDate) {
    filters.push(gte(schema.transaction.bookingDate, body.sinceBookingDate))
  }

  const rows = await db
    .select({
      id: schema.transaction.id,
      powensAccountId: schema.transaction.powensAccountId,
      bookingDate: schema.transaction.bookingDate,
      amount: schema.transaction.amount,
      label: schema.transaction.label,
      category: schema.transaction.category,
      customCategory: schema.transaction.customCategory,
      customSubcategory: schema.transaction.customSubcategory,
      customIncomeType: schema.transaction.customIncomeType,
      merchant: schema.transaction.merchant,
      customMerchant: schema.transaction.customMerchant,
    })
    .from(schema.transaction)
    .where(and(...filters))
    .orderBy(desc(schema.transaction.bookingDate), desc(schema.transaction.id))
    .limit(limit)

  const counts = emptyCounts()
  const sampleChanges: Array<{
    id: number
    from: string | null
    to: string
    subcategory: string | null
    ruleId: string | null
  }> = []

  for (const row of rows) {
    counts.scanned += 1

    if (!isUnknownCategory(row.customCategory)) {
      counts.withCustomOverride += 1
      continue
    }

    const result = applyTransactionAutoCategorization({
      ...(row.bookingDate ? { bookingDate: row.bookingDate } : {}),
      label: row.label,
      amount: Number(row.amount),
      powensAccountId: row.powensAccountId,
      accountName: null,
      merchant: row.customMerchant ?? row.merchant ?? '',
      providerCategory: row.category,
      customCategory: null,
      customSubcategory: null,
      category: row.category,
      subcategory: null,
      incomeType: null,
      userRules,
    })

    const next = result.category
    if (!next || next === row.category) {
      counts.unchanged += 1
      continue
    }

    counts.changed += 1
    counts.byCategory[next] = (counts.byCategory[next] ?? 0) + 1
    if (sampleChanges.length < 25) {
      sampleChanges.push({
        id: row.id,
        from: row.category,
        to: next,
        subcategory: result.subcategory,
        ruleId: result.resolutionRuleId,
      })
    }

    if (!dryRun) {
      await db
        .update(schema.transaction)
        .set({ category: next })
        .where(eq(schema.transaction.id, row.id))
    }
  }

  return { dryRun, limit, counts, sampleChanges }
}

export const createTransactionCategorizationBackfillRoute = ({ db }: { db: ApiDb }) =>
  new Elysia().post(
    '/transactions/categorize/backfill',
    async context => {
      const requestId = getRequestMeta(context).requestId
      context.set.headers['cache-control'] = 'no-store'

      return demoOrReal({
        context,
        demo: () => {
          context.set.status = 403
          return {
            ok: false,
            code: 'DEMO_MODE_FORBIDDEN' as const,
            message: 'Admin session required',
            requestId,
          }
        },
        real: async () => {
          requireAdmin(context)
          const startedAt = Date.now()
          const body = context.body as BackfillBody
          // Respect persisted user categorization rules in backfill too, so it
          // stays consistent with the live transaction list (which already
          // applies enabled user rules by priority).
          const userRules = await createUserCategorizationRuleRepository({ db }).listEnabledRules()
          const result = await runBackfill({ db, body, userRules })
          return {
            ok: true,
            requestId,
            startedAt: new Date(startedAt).toISOString(),
            durationMs: Date.now() - startedAt,
            rulesetVersion: body.rulesetVersion ?? 'v1',
            ...result,
          }
        },
      })
    },
    {
      body: backfillBodySchema,
    }
  )

// Exported for testing the pure logic without the HTTP layer.
export const __testing = { runBackfill }
