import { z } from 'zod'
import { dashboardValuationStatusSchema } from './dashboard'

/*
 * Asset valuation transport contract (Financial Data Core status routes).
 *
 * Every base value typed `.nullable()` means "unknown" when null; a missing
 * valuation is never reported as 0.
 */

export const valuationBaseCurrencySchema = z.literal('EUR')
export type ValuationBaseCurrency = z.infer<typeof valuationBaseCurrencySchema>

export const valuationStatusCountsSchema = z.record(dashboardValuationStatusSchema, z.number())
export type ValuationStatusCounts = z.infer<typeof valuationStatusCountsSchema>

export const valuationBreakdownEntrySchema = z.object({
  itemCount: z.number(),
  /** Sum of known base values. Null when no item in the group has a known value. */
  valueBase: z.number().nullable(),
  unknownValueCount: z.number(),
})
export type ValuationBreakdownEntry = z.infer<typeof valuationBreakdownEntrySchema>

export const valuationCoverageReportSchema = z.object({
  baseCurrency: valuationBaseCurrencySchema,
  totalItems: z.number(),
  statusCounts: valuationStatusCountsSchema,
  /** Usable items over all items needing valuation. Null when there are no items. */
  coveragePercent: z.number().nullable(),
  /** Sum of known base values. Null when no item has a known value. */
  totalValueBase: z.number().nullable(),
  unknownValueCount: z.number(),
  providerBreakdown: z.record(z.string(), valuationBreakdownEntrySchema),
  assetClassBreakdown: z.record(z.string(), valuationBreakdownEntrySchema),
})
export type ValuationCoverageReport = z.infer<typeof valuationCoverageReportSchema>

export const valuationProviderFailureSchema = z.object({
  provider: z.string(),
  errorCode: z.string(),
  safeErrorMessage: z.string(),
})
export type ValuationProviderFailure = z.infer<typeof valuationProviderFailureSchema>

export const valuationRunStatusSchema = z.enum(['completed', 'failed', 'running'])
export type ValuationRunStatus = z.infer<typeof valuationRunStatusSchema>

export const valuationTriggerSourceSchema = z.enum(['admin', 'internal'])
export type ValuationTriggerSource = z.infer<typeof valuationTriggerSourceSchema>

export const valuationRunSummarySchema = z.object({
  runId: z.number(),
  dryRun: z.boolean(),
  status: valuationRunStatusSchema,
  triggerSource: valuationTriggerSourceSchema,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  durationMs: z.number().nullable(),
  coverage: valuationCoverageReportSchema.nullable(),
  itemCount: z.number().nullable(),
  snapshotCount: z.number().nullable(),
  wouldCreateSnapshots: z.number().nullable(),
  providerFailures: z.array(valuationProviderFailureSchema),
  safeErrorCode: z.string().nullable(),
  safeErrorMessage: z.string().nullable(),
})
export type ValuationRunSummary = z.infer<typeof valuationRunSummarySchema>

export const valuationFxStatusSchema = z.object({
  baseCurrency: valuationBaseCurrencySchema,
  ratesAvailable: z.number(),
  staleRates: z.number(),
  latestRateTimestamp: z.string().nullable(),
})
export type ValuationFxStatus = z.infer<typeof valuationFxStatusSchema>

export const valuationStateSchema = z.enum(['idle', 'running', 'completed', 'failed'])
export type ValuationState = z.infer<typeof valuationStateSchema>

export const valuationStatusResponseSchema = z.object({
  featureEnabled: z.boolean(),
  fxEnabled: z.boolean(),
  state: valuationStateSchema,
  latestRun: valuationRunSummarySchema.nullable(),
  fx: valuationFxStatusSchema,
})
export type ValuationStatusResponse = z.infer<typeof valuationStatusResponseSchema>

export const valuationUnresolvedItemSchema = z.object({
  itemKey: z.string(),
  name: z.string(),
  provider: z.string().nullable(),
  assetClass: z.string(),
  status: z.string(),
  identityStatus: z.string(),
  errorCode: z.string().nullable(),
  safeErrorMessage: z.string().nullable(),
  asOf: z.string().nullable(),
})
export type ValuationUnresolvedItem = z.infer<typeof valuationUnresolvedItemSchema>

export const valuationUnresolvedResponseSchema = z.object({
  items: z.array(valuationUnresolvedItemSchema),
  totalItems: z.number(),
})
export type ValuationUnresolvedResponse = z.infer<typeof valuationUnresolvedResponseSchema>
