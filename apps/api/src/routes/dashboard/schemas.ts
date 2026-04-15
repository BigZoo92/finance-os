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
  sourceType: t.Optional(t.String({ minLength: 1, maxLength: 32 })),
  domain: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
  eventType: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
  minSeverity: t.Optional(t.Numeric({ minimum: 0, maximum: 100 })),
  region: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
  ticker: t.Optional(t.String({ minLength: 1, maxLength: 16 })),
  sector: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
  direction: t.Optional(t.Union([t.Literal('risk'), t.Literal('opportunity'), t.Literal('mixed')])),
  from: t.Optional(t.String({ format: 'date-time' })),
  to: t.Optional(t.String({ format: 'date-time' })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
})

export const dashboardNewsIngestBodySchema = t.Object({
  trigger: t.Optional(t.Union([t.Literal('manual'), t.Literal('scheduled')])),
})

export const dashboardNewsContextQuerySchema = t.Object({
  range: t.Optional(t.Union([t.Literal('24h'), t.Literal('7d'), t.Literal('30d')])),
})

export const dashboardMarketsRefreshBodySchema = t.Object({
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

export const dashboardAdvisorListQuerySchema = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})

export const dashboardAdvisorChatQuerySchema = t.Object({
  threadKey: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
})

export const dashboardAdvisorChatBodySchema = t.Object({
  threadKey: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
  message: t.String({
    minLength: 1,
    maxLength: 4000,
    pattern: '^(?=.*\\S).+$',
  }),
})

export const dashboardAdvisorRunBodySchema = t.Object({
  trigger: t.Optional(
    t.Union([t.Literal('manual'), t.Literal('scheduled'), t.Literal('internal')])
  ),
})

export const dashboardAdvisorManualOperationParamsSchema = t.Object({
  operationId: t.String({
    minLength: 1,
    maxLength: 80,
    pattern: '^[A-Za-z0-9-]+$',
  }),
})

export const dashboardManualAssetParamsSchema = t.Object({
  assetId: t.Numeric({ minimum: 1 }),
})

export const dashboardManualAssetBodySchema = t.Object({
  assetType: t.Union([t.Literal('cash'), t.Literal('investment'), t.Literal('manual')]),
  name: t.String({
    minLength: 1,
    maxLength: 120,
    pattern: '^(?=.*\\S).+$',
  }),
  currency: t.String({
    minLength: 3,
    maxLength: 8,
    pattern: '^[A-Za-z]{3,8}$',
  }),
  valuation: t.Numeric({ minimum: 0, maximum: 999999999999.99 }),
  valuationAsOf: t.Union([t.String({ format: 'date-time' }), t.Null()]),
  note: t.Union([t.String({ maxLength: 280 }), t.Null()]),
  category: t.Union([t.String({ maxLength: 64 }), t.Null()]),
  enabled: t.Boolean(),
})
