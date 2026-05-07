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

export const dashboardExternalInvestmentsListQuerySchema = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })),
})

export const dashboardTransactionClassificationParamsSchema = t.Object({
  transactionId: t.Numeric({ minimum: 1 }),
})

export const dashboardTransactionClassificationBodySchema = t.Object({
  merchant: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 128 }), t.Null()])),
  category: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 64 }), t.Null()])),
  subcategory: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 64 }), t.Null()])),
  incomeType: t.Optional(
    t.Union([t.Literal('salary'), t.Literal('recurring'), t.Literal('exceptional'), t.Null()])
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

export const dashboardAdvisorKnowledgeAnswerQuerySchema = t.Object({
  question: t.String({
    minLength: 1,
    maxLength: 240,
    pattern: '^(?=.*\\S).+$',
  }),
})

const dashboardAdvisorKnowledgeRetrievalModeSchema = t.Union([
  t.Literal('hybrid'),
  t.Literal('graph'),
  t.Literal('vector'),
  t.Literal('fulltext'),
])

const dashboardAdvisorKnowledgeModeSchema = t.Union([
  t.Literal('demo'),
  t.Literal('admin'),
  t.Literal('internal'),
])

export const dashboardAdvisorKnowledgeQueryBodySchema = t.Object({
  query: t.String({
    minLength: 1,
    maxLength: 1000,
    pattern: '^(?=.*\\S).+$',
  }),
  mode: t.Optional(dashboardAdvisorKnowledgeModeSchema),
  filters: t.Optional(t.Record(t.String({ minLength: 1, maxLength: 80 }), t.Any())),
  maxResults: t.Optional(t.Numeric({ minimum: 1, maximum: 64 })),
  maxPathDepth: t.Optional(t.Numeric({ minimum: 0, maximum: 5 })),
  retrievalMode: t.Optional(dashboardAdvisorKnowledgeRetrievalModeSchema),
  includeContradictions: t.Optional(t.Boolean()),
  includeEvidence: t.Optional(t.Boolean()),
})

export const dashboardAdvisorKnowledgeContextBundleBodySchema = t.Object({
  query: t.String({
    minLength: 1,
    maxLength: 1000,
    pattern: '^(?=.*\\S).+$',
  }),
  mode: t.Optional(dashboardAdvisorKnowledgeModeSchema),
  filters: t.Optional(t.Record(t.String({ minLength: 1, maxLength: 80 }), t.Any())),
  maxResults: t.Optional(t.Numeric({ minimum: 1, maximum: 64 })),
  maxPathDepth: t.Optional(t.Numeric({ minimum: 0, maximum: 5 })),
  retrievalMode: t.Optional(dashboardAdvisorKnowledgeRetrievalModeSchema),
  includeContradictions: t.Optional(t.Boolean()),
  includeEvidence: t.Optional(t.Boolean()),
  maxTokens: t.Optional(t.Numeric({ minimum: 128, maximum: 12000 })),
  advisorTask: t.Optional(t.String({ minLength: 1, maxLength: 240 })),
})

export const dashboardAdvisorKnowledgeExplainBodySchema = t.Object({
  id: t.String({
    minLength: 1,
    maxLength: 240,
    pattern: '^(?=.*\\S).+$',
  }),
  query: t.Optional(t.String({ minLength: 1, maxLength: 1000 })),
  mode: t.Optional(dashboardAdvisorKnowledgeModeSchema),
})

export const dashboardAdvisorKnowledgeRebuildBodySchema = t.Object({
  mode: t.Optional(dashboardAdvisorKnowledgeModeSchema),
  includeSeed: t.Optional(t.Boolean()),
  sources: t.Optional(t.Array(t.String({ minLength: 1, maxLength: 120 }), { maxItems: 20 })),
  dryRun: t.Optional(t.Boolean()),
})

const dashboardAdvisorKnowledgeGraphScopeSchema = t.Union([
  t.Literal('overview'),
  t.Literal('advisor'),
  t.Literal('recommendations'),
  t.Literal('sources'),
  t.Literal('risk'),
  t.Literal('personal'),
])

export type DashboardAdvisorKnowledgeGraphScope =
  | 'overview'
  | 'advisor'
  | 'recommendations'
  | 'sources'
  | 'risk'
  | 'personal'

export const dashboardAdvisorKnowledgeGraphQuerySchema = t.Object({
  scope: t.Optional(dashboardAdvisorKnowledgeGraphScopeSchema),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 1000 })),
  includeExamples: t.Optional(t.Boolean()),
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

export const dashboardAdvisorPostMortemParamsSchema = t.Object({
  postMortemId: t.Numeric({ minimum: 1 }),
})

export const dashboardAdvisorDecisionKindSchema = t.Union([
  t.Literal('accepted'),
  t.Literal('rejected'),
  t.Literal('deferred'),
  t.Literal('ignored'),
])

export const dashboardAdvisorDecisionReasonCodeSchema = t.Union([
  t.Literal('accepted'),
  t.Literal('rejected_low_confidence'),
  t.Literal('rejected_disagree_thesis'),
  t.Literal('rejected_risk_mismatch'),
  t.Literal('deferred_need_more_data'),
  t.Literal('ignored_no_action'),
  t.Literal('other'),
])

export const dashboardAdvisorDecisionOutcomeKindSchema = t.Union([
  t.Literal('positive'),
  t.Literal('negative'),
  t.Literal('neutral'),
  t.Literal('mixed'),
  t.Literal('unknown'),
])

const isoTimestampPattern =
  '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,3})?)?(Z|[+-]\\d{2}:?\\d{2})?$'

export const dashboardAdvisorJournalListQuerySchema = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })),
  recommendationId: t.Optional(t.Numeric({ minimum: 1 })),
  runId: t.Optional(t.Numeric({ minimum: 1 })),
  decision: t.Optional(dashboardAdvisorDecisionKindSchema),
})

export const dashboardAdvisorJournalParamsSchema = t.Object({
  decisionId: t.Numeric({ minimum: 1 }),
})

export const dashboardAdvisorJournalCreateBodySchema = t.Object({
  recommendationId: t.Optional(t.Union([t.Integer({ minimum: 1 }), t.Null()])),
  runId: t.Optional(t.Union([t.Integer({ minimum: 1 }), t.Null()])),
  recommendationKey: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 200 }), t.Null()])),
  decision: dashboardAdvisorDecisionKindSchema,
  reasonCode: dashboardAdvisorDecisionReasonCodeSchema,
  freeNote: t.Optional(t.Union([t.String({ maxLength: 2000 }), t.Null()])),
  decidedBy: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 80 }), t.Null()])),
  expectedOutcomeAt: t.Optional(
    t.Union([t.String({ pattern: isoTimestampPattern, maxLength: 40 }), t.Null()])
  ),
  metadata: t.Optional(
    t.Union([t.Record(t.String({ minLength: 1, maxLength: 80 }), t.Any()), t.Null()])
  ),
})

export const dashboardAdvisorDecisionOutcomeCreateBodySchema = t.Object({
  outcomeKind: dashboardAdvisorDecisionOutcomeKindSchema,
  deltaMetrics: t.Optional(
    t.Union([t.Record(t.String({ minLength: 1, maxLength: 80 }), t.Any()), t.Null()])
  ),
  learningTags: t.Optional(
    t.Array(t.String({ minLength: 1, maxLength: 80 }), { maxItems: 32 })
  ),
  freeNote: t.Optional(t.Union([t.String({ maxLength: 2000 }), t.Null()])),
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
