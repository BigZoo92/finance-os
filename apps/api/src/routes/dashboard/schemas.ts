import { t } from 'elysia'

export const dashboardRangeSchema = t.Union([t.Literal('7d'), t.Literal('30d'), t.Literal('90d')])

export const dashboardGoalTypeSchema = t.Union([
  t.Literal('emergency_fund'),
  t.Literal('travel'),
  t.Literal('home'),
  t.Literal('education'),
  t.Literal('retirement'),
  t.Literal('custom'),
])

export const dashboardSummaryQuerySchema = t.Object({
  range: t.Optional(dashboardRangeSchema),
})

export const dashboardTransactionsQuerySchema = t.Object({
  range: t.Optional(dashboardRangeSchema),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  cursor: t.Optional(t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}\\|\\d+$', maxLength: 64 })),
  demoScenario: t.Optional(
    t.Union([
      t.Literal('default'),
      t.Literal('empty'),
      t.Literal('subscriptions'),
      t.Literal('parse_error'),
      t.Literal('student_budget'),
      t.Literal('freelancer_cashflow'),
      t.Literal('family_planning'),
      t.Literal('retiree_stability'),
    ])
  ),
  demoProfile: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
})

export const dashboardNewsQuerySchema = t.Object({
  topic: t.Optional(t.String({ minLength: 1, maxLength: 32 })),
  source: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
})

export const dashboardNewsIngestBodySchema = t.Object({
  trigger: t.Optional(t.Union([t.Literal('manual'), t.Literal('scheduled')])),
})

export const dashboardTransactionClassificationParamsSchema = t.Object({
  transactionId: t.Numeric({ minimum: 1 }),
})

export const dashboardTransactionClassificationBodySchema = t.Object({
  merchant: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 128 }), t.Null()])),
  category: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 64 }), t.Null()])),
  subcategory: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 64 }), t.Null()])),
  incomeType: t.Optional(
    t.Union([
      t.Literal('salary'),
      t.Literal('recurring'),
      t.Literal('exceptional'),
      t.Null(),
    ])
  ),
  tags: t.Optional(t.Array(t.String({ minLength: 1, maxLength: 32 }), { maxItems: 10 })),
})

export const dashboardGoalParamsSchema = t.Object({
  goalId: t.Numeric({ minimum: 1 }),
})

export const dashboardGoalBodySchema = t.Object({
  name: t.String({
    minLength: 1,
    maxLength: 96,
    pattern: '^(?=.*\\S).+$',
  }),
  goalType: dashboardGoalTypeSchema,
  currency: t.String({
    minLength: 3,
    maxLength: 8,
    pattern: '^[A-Za-z]{3,8}$',
  }),
  targetAmount: t.Numeric({ minimum: 0, maximum: 999999999999.99 }),
  currentAmount: t.Numeric({ minimum: 0, maximum: 999999999999.99 }),
  targetDate: t.Union([t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }), t.Null()]),
  note: t.Union([t.String({ maxLength: 280 }), t.Null()]),
})
