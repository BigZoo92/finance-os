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
