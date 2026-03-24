import { t } from 'elysia'

export const dashboardRangeSchema = t.Union([t.Literal('7d'), t.Literal('30d'), t.Literal('90d')])

export const dashboardSummaryQuerySchema = t.Object({
  range: t.Optional(dashboardRangeSchema),
})

export const dashboardTransactionsQuerySchema = t.Object({
  range: t.Optional(dashboardRangeSchema),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  cursor: t.Optional(t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}\\|\\d+$', maxLength: 64 })),
})

export const dashboardTransactionClassificationParamsSchema = t.Object({
  transactionId: t.Numeric({ minimum: 1 }),
})

export const dashboardTransactionClassificationBodySchema = t.Object({
  category: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 64 }), t.Null()])),
  subcategory: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 64 }), t.Null()])),
  tags: t.Optional(t.Array(t.String({ minLength: 1, maxLength: 32 }), { maxItems: 10 })),
})
