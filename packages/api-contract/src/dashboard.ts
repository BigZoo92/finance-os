import { z } from 'zod'

/*
 * Dashboard summary / transactions / manual assets transport contract.
 *
 * Every monetary or valuation field typed `.nullable()` means "unknown" when
 * null; it is never a 0 in disguise. The API (apps/api) is the source of
 * truth for these shapes; the web app consumes them unchanged.
 */

export const dashboardRangeSchema = z.enum(['7d', '30d', '90d'])
export type DashboardRange = z.infer<typeof dashboardRangeSchema>

export const dashboardValuationStatusSchema = z.enum([
  'priced',
  'derived',
  'estimated',
  'manual',
  'stale',
  'unresolved',
  'unavailable',
])
export type DashboardValuationStatus = z.infer<typeof dashboardValuationStatusSchema>

export const dashboardAssetTypeSchema = z.enum(['cash', 'investment', 'manual'])
export type DashboardAssetType = z.infer<typeof dashboardAssetTypeSchema>

export const dashboardAssetOriginSchema = z.enum(['provider', 'manual'])
export type DashboardAssetOrigin = z.infer<typeof dashboardAssetOriginSchema>

export const dashboardConnectionStatusSchema = z.enum([
  'connected',
  'syncing',
  'error',
  'reconnect_required',
])
export type DashboardConnectionStatus = z.infer<typeof dashboardConnectionStatusSchema>

export const dashboardIncomeTypeSchema = z.enum(['salary', 'recurring', 'exceptional'])
export type DashboardIncomeType = z.infer<typeof dashboardIncomeTypeSchema>

export const dashboardCostBasisSourceSchema = z.enum(['minimal', 'provider', 'manual', 'unknown'])
export type DashboardCostBasisSource = z.infer<typeof dashboardCostBasisSourceSchema>

const metadataSchema = z.record(z.string(), z.unknown()).nullable()

// --- Summary -----------------------------------------------------------------

export const dashboardSummaryTotalsSchema = z.object({
  /**
   * Legacy naive sum of enabled asset valuations in their native currencies
   * (no FX). Null when at least one enabled asset has no valuation: a partial
   * sum is unknown, never a smaller number. Prefer `valuation.totalValueBase`.
   */
  balance: z.number().nullable(),
  /** Enabled assets without a persisted valuation (explains a null balance). */
  unknownValuationAssetCount: z.number(),
  incomes: z.number(),
  expenses: z.number(),
})
export type DashboardSummaryTotals = z.infer<typeof dashboardSummaryTotalsSchema>

export const dashboardSummaryValuationSchema = z.object({
  baseCurrency: z.literal('EUR'),
  totalValueBase: z.number().nullable(),
  coveragePercent: z.number().nullable(),
  statusCounts: z.record(dashboardValuationStatusSchema, z.number()),
  unknownValueCount: z.number(),
  totalUnrealizedPnlBase: z.number().nullable(),
  pnlCoverageCount: z.number(),
  asOf: z.string(),
})
export type DashboardSummaryValuation = z.infer<typeof dashboardSummaryValuationSchema>

export const dashboardSummaryConnectionSchema = z.object({
  powensConnectionId: z.string(),
  source: z.string(),
  provider: z.string(),
  providerConnectionId: z.string(),
  providerInstitutionId: z.string().nullable(),
  providerInstitutionName: z.string().nullable(),
  status: dashboardConnectionStatusSchema,
  lastSyncAttemptAt: z.string().nullable(),
  lastSyncAt: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
  lastFailedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  syncMetadata: metadataSchema,
  /** Native-currency sum of the connection's account balances; null when any balance is unknown. */
  balance: z.number().nullable(),
  accountCount: z.number(),
})
export type DashboardSummaryConnection = z.infer<typeof dashboardSummaryConnectionSchema>

export const dashboardSummaryAccountSchema = z.object({
  powensAccountId: z.string(),
  powensConnectionId: z.string(),
  name: z.string(),
  currency: z.string(),
  type: z.string().nullable(),
  metadata: metadataSchema,
  enabled: z.boolean(),
  /** Provider-reported balance; null when the provider did not report one. */
  balance: z.number().nullable(),
})
export type DashboardSummaryAccount = z.infer<typeof dashboardSummaryAccountSchema>

export const dashboardSummaryAssetSchema = z.object({
  assetId: z.number(),
  type: dashboardAssetTypeSchema,
  origin: dashboardAssetOriginSchema,
  source: z.string(),
  provider: z.string().nullable(),
  providerConnectionId: z.string().nullable(),
  providerInstitutionName: z.string().nullable(),
  powensConnectionId: z.string().nullable(),
  powensAccountId: z.string().nullable(),
  name: z.string(),
  currency: z.string(),
  /** Native-currency valuation; null when no valuation is persisted (never 0). */
  valuation: z.number().nullable(),
  valuationAsOf: z.string().nullable(),
  /** Canonical EUR value; null when unknown/unconvertible (never 0). */
  valueBase: z.number().nullable(),
  valuationStatus: dashboardValuationStatusSchema.nullable(),
  enabled: z.boolean(),
  metadata: metadataSchema,
})
export type DashboardSummaryAsset = z.infer<typeof dashboardSummaryAssetSchema>

export const dashboardSummaryPositionSchema = z.object({
  positionId: z.number(),
  positionKey: z.string(),
  assetId: z.number().nullable(),
  powensAccountId: z.string().nullable(),
  powensConnectionId: z.string().nullable(),
  source: z.string(),
  provider: z.string().nullable(),
  providerConnectionId: z.string().nullable(),
  providerPositionId: z.string().nullable(),
  assetName: z.string().nullable(),
  accountName: z.string().nullable(),
  name: z.string(),
  currency: z.string(),
  quantity: z.number().nullable(),
  costBasis: z.number().nullable(),
  costBasisSource: dashboardCostBasisSourceSchema,
  currentValue: z.number().nullable(),
  lastKnownValue: z.number().nullable(),
  openedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  valuedAt: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  /** Canonical EUR value for unbridged positions; null when unknown. */
  valueBase: z.number().nullable(),
  valuationStatus: dashboardValuationStatusSchema.nullable(),
  enabled: z.boolean(),
  metadata: metadataSchema,
})
export type DashboardSummaryPosition = z.infer<typeof dashboardSummaryPositionSchema>

export const dashboardDailyWealthSnapshotSchema = z.object({
  date: z.string(),
  balance: z.number(),
})
export type DashboardDailyWealthSnapshot = z.infer<typeof dashboardDailyWealthSnapshotSchema>

export const dashboardTopExpenseGroupSchema = z.object({
  label: z.string(),
  category: z.string(),
  merchant: z.string(),
  total: z.number(),
  count: z.number(),
})
export type DashboardTopExpenseGroup = z.infer<typeof dashboardTopExpenseGroupSchema>

export const dashboardSummaryResponseSchema = z.object({
  range: dashboardRangeSchema,
  totals: dashboardSummaryTotalsSchema,
  /**
   * Canonical valuation summary (Financial Data Core). Null when the
   * valuation overlay is unavailable: a missing block means "unknown",
   * never "zero".
   */
  valuation: dashboardSummaryValuationSchema.nullable(),
  connections: z.array(dashboardSummaryConnectionSchema),
  accounts: z.array(dashboardSummaryAccountSchema),
  assets: z.array(dashboardSummaryAssetSchema),
  positions: z.array(dashboardSummaryPositionSchema),
  dailyWealthSnapshots: z.array(dashboardDailyWealthSnapshotSchema),
  topExpenseGroups: z.array(dashboardTopExpenseGroupSchema),
})
export type DashboardSummaryResponse = z.infer<typeof dashboardSummaryResponseSchema>

// --- Transactions ------------------------------------------------------------

export const dashboardTransactionsSchemaVersionSchema = z.enum(['2026-04-04', '2026-04-05'])
export type DashboardTransactionsSchemaVersion = z.infer<
  typeof dashboardTransactionsSchemaVersionSchema
>

export const dashboardTransactionsDemoFixtureSchema = z.object({
  mode: z.enum(['demo', 'admin']),
  datasetVersion: z.string().nullable(),
  fixtureSeed: z.string().nullable(),
  scenario: z.string().nullable(),
  degradedFallback: z.boolean(),
  degradedReason: z.string().nullable(),
  personaProfile: z.string().nullable(),
  personaId: z.enum(['student', 'freelancer', 'family', 'retiree']).nullable(),
  personaVariation: z.literal([0, 1, 2]).nullable(),
  overrideReason: z
    .enum(['manual_scenario_override', 'persona_match', 'kill_switch_disabled'])
    .nullable(),
  fallbackCause: z.string().nullable(),
})
export type DashboardTransactionsDemoFixture = z.infer<
  typeof dashboardTransactionsDemoFixtureSchema
>

export const dashboardTransactionsSyncStatusSchema = z.enum([
  'fresh',
  'stale-but-usable',
  'syncing',
  'sync-failed-with-safe-data',
  'no-data-first-connect',
])
export type DashboardTransactionsSyncStatus = z.infer<typeof dashboardTransactionsSyncStatusSchema>

export const dashboardTransactionsFreshnessSchema = z.object({
  strategy: z.literal('snapshot-first'),
  lastSyncedAt: z.string().nullable(),
  syncStatus: dashboardTransactionsSyncStatusSchema,
  degradedReason: z.string().nullable(),
  snapshotAgeSeconds: z.number().nullable(),
  refreshRequested: z.boolean(),
})
export type DashboardTransactionsFreshness = z.infer<typeof dashboardTransactionsFreshnessSchema>

export const dashboardTransactionResolutionSourceSchema = z.enum([
  'manual_override',
  'user_rule',
  'merchant_rules',
  'mcc',
  'counterparty',
  'fallback',
])
export type DashboardTransactionResolutionSource = z.infer<
  typeof dashboardTransactionResolutionSourceSchema
>

export const dashboardTransactionResolutionTraceEntrySchema = z.object({
  source: dashboardTransactionResolutionSourceSchema,
  rank: z.number(),
  matched: z.boolean(),
  reason: z.string(),
  category: z.string().nullable(),
  subcategory: z.string().nullable(),
  ruleId: z.string().nullable(),
})
export type DashboardTransactionResolutionTraceEntry = z.infer<
  typeof dashboardTransactionResolutionTraceEntrySchema
>

export const dashboardTransactionItemSchema = z.object({
  id: z.number(),
  bookingDate: z.string(),
  amount: z.number(),
  currency: z.string(),
  direction: z.enum(['income', 'expense']),
  label: z.string(),
  merchant: z.string(),
  category: z.string().nullable(),
  subcategory: z.string().nullable(),
  resolvedCategory: z.string().nullable(),
  resolutionSource: dashboardTransactionResolutionSourceSchema,
  resolutionRuleId: z.string().nullable(),
  resolutionTrace: z.array(dashboardTransactionResolutionTraceEntrySchema),
  incomeType: dashboardIncomeTypeSchema.nullable(),
  tags: z.array(z.string()),
  powensConnectionId: z.string(),
  powensAccountId: z.string(),
  accountName: z.string().nullable(),
})
export type DashboardTransactionItem = z.infer<typeof dashboardTransactionItemSchema>

export const dashboardTransactionsResponseSchema = z.object({
  schemaVersion: dashboardTransactionsSchemaVersionSchema,
  range: dashboardRangeSchema,
  limit: z.number(),
  nextCursor: z.string().nullable(),
  demoFixture: dashboardTransactionsDemoFixtureSchema.optional(),
  freshness: dashboardTransactionsFreshnessSchema,
  items: z.array(dashboardTransactionItemSchema),
})
export type DashboardTransactionsResponse = z.infer<typeof dashboardTransactionsResponseSchema>

// --- Manual assets -----------------------------------------------------------

export const dashboardManualAssetResponseSchema = z.object({
  assetId: z.number(),
  type: dashboardAssetTypeSchema,
  origin: dashboardAssetOriginSchema,
  source: z.string(),
  name: z.string(),
  currency: z.string(),
  /** Null when no valuation is persisted; never 0. */
  valuation: z.number().nullable(),
  valuationAsOf: z.string().nullable(),
  enabled: z.boolean(),
  note: z.string().nullable(),
  category: z.string().nullable(),
  metadata: metadataSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type DashboardManualAssetResponse = z.infer<typeof dashboardManualAssetResponseSchema>

export const dashboardManualAssetsResponseSchema = z.object({
  items: z.array(dashboardManualAssetResponseSchema),
})
export type DashboardManualAssetsResponse = z.infer<typeof dashboardManualAssetsResponseSchema>
