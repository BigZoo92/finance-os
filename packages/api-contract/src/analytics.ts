import { z } from 'zod'
import { dashboardAssetTypeSchema, dashboardRangeSchema } from './dashboard'

export const dashboardAnalyticsWidgetStateSchema = z.enum([
  'loading',
  'ready',
  'empty',
  'degraded',
  'error',
])
export type DashboardAnalyticsWidgetState = z.infer<typeof dashboardAnalyticsWidgetStateSchema>

export const dashboardAnalyticsSummaryCardsSchema = z.object({
  /** Net worth is null (not 0) when an enabled asset has no valuation. */
  netWorth: z.object({ value: z.number().nullable(), state: dashboardAnalyticsWidgetStateSchema }),
  incomes: z.object({ value: z.number(), state: dashboardAnalyticsWidgetStateSchema }),
  expenses: z.object({ value: z.number(), state: dashboardAnalyticsWidgetStateSchema }),
})
export type DashboardAnalyticsSummaryCards = z.infer<typeof dashboardAnalyticsSummaryCardsSchema>

export const dashboardAnalyticsTimeseriesSchema = z.object({
  points: z.array(z.object({ date: z.string(), balance: z.number() })),
  state: dashboardAnalyticsWidgetStateSchema,
})
export type DashboardAnalyticsTimeseries = z.infer<typeof dashboardAnalyticsTimeseriesSchema>

export const dashboardAnalyticsCategorySplitSchema = z.object({
  items: z.array(z.object({ label: z.string(), total: z.number(), ratio: z.number() })),
  state: dashboardAnalyticsWidgetStateSchema,
})
export type DashboardAnalyticsCategorySplit = z.infer<typeof dashboardAnalyticsCategorySplitSchema>

export const dashboardAnalyticsPortfolioAllocationSchema = z.object({
  items: z.array(
    z.object({ type: dashboardAssetTypeSchema, total: z.number(), ratio: z.number() })
  ),
  state: dashboardAnalyticsWidgetStateSchema,
})
export type DashboardAnalyticsPortfolioAllocation = z.infer<
  typeof dashboardAnalyticsPortfolioAllocationSchema
>

export const dashboardAnalyticsAllocationEvolutionSchema = z.object({
  points: z.array(
    z.object({
      date: z.string(),
      total: z.number(),
      cash: z.number(),
      investment: z.number(),
      manual: z.number(),
    })
  ),
  state: dashboardAnalyticsWidgetStateSchema,
})
export type DashboardAnalyticsAllocationEvolution = z.infer<
  typeof dashboardAnalyticsAllocationEvolutionSchema
>

export const dashboardAnalyticsRecurringSpendGroupSchema = z.object({
  items: z.array(
    z.object({ label: z.string(), monthlyAmount: z.number(), occurrences: z.number() })
  ),
  totalMonthly: z.number(),
  state: dashboardAnalyticsWidgetStateSchema,
})
export type DashboardAnalyticsRecurringSpendGroup = z.infer<
  typeof dashboardAnalyticsRecurringSpendGroupSchema
>

export const dashboardAnalyticsRecurringSpendSchema = z.object({
  fixedCharges: dashboardAnalyticsRecurringSpendGroupSchema,
  subscriptions: dashboardAnalyticsRecurringSpendGroupSchema,
})
export type DashboardAnalyticsRecurringSpend = z.infer<
  typeof dashboardAnalyticsRecurringSpendSchema
>

export const dashboardAnalyticsSpendConcentrationSchema = z.object({
  topMerchantShare: z.number(),
  top3Share: z.number(),
  hhi: z.number(),
  dominantMerchantLabel: z.string().nullable(),
  state: dashboardAnalyticsWidgetStateSchema,
})
export type DashboardAnalyticsSpendConcentration = z.infer<
  typeof dashboardAnalyticsSpendConcentrationSchema
>

export const dashboardAnalyticsAvailabilitySchema = z.object({
  summaryCards: z.boolean(),
  timeseries: z.boolean(),
  categorySplit: z.boolean(),
  portfolioAllocation: z.boolean(),
  allocationEvolution: z.boolean(),
  recurringSpend: z.boolean(),
  spendConcentration: z.boolean(),
})
export type DashboardAnalyticsAvailability = z.infer<typeof dashboardAnalyticsAvailabilitySchema>

export const dashboardAnalyticsResponseSchema = z.object({
  schemaVersion: z.literal('2026-04-06'),
  range: dashboardRangeSchema,
  source: z.enum(['demoAdapter', 'adminAdapter']),
  generatedAt: z.string(),
  summaryCards: dashboardAnalyticsSummaryCardsSchema,
  timeseries: dashboardAnalyticsTimeseriesSchema,
  categorySplit: dashboardAnalyticsCategorySplitSchema,
  portfolioAllocation: dashboardAnalyticsPortfolioAllocationSchema,
  allocationEvolution: dashboardAnalyticsAllocationEvolutionSchema,
  recurringSpend: dashboardAnalyticsRecurringSpendSchema,
  spendConcentration: dashboardAnalyticsSpendConcentrationSchema,
  availability: dashboardAnalyticsAvailabilitySchema,
})
export type DashboardAnalyticsResponse = z.infer<typeof dashboardAnalyticsResponseSchema>
