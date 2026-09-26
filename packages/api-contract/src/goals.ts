import { z } from 'zod'

export const dashboardGoalTypeSchema = z.enum([
  'emergency_fund',
  'travel',
  'home',
  'education',
  'retirement',
  'custom',
])
export type DashboardGoalType = z.infer<typeof dashboardGoalTypeSchema>

export const dashboardGoalProgressSnapshotSchema = z.object({
  recordedAt: z.string(),
  amount: z.number(),
  note: z.string().nullable(),
})
export type DashboardGoalProgressSnapshot = z.infer<typeof dashboardGoalProgressSnapshotSchema>

export const dashboardGoalResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  goalType: dashboardGoalTypeSchema,
  currency: z.string(),
  targetAmount: z.number(),
  currentAmount: z.number(),
  targetDate: z.string().nullable(),
  note: z.string().nullable(),
  progressSnapshots: z.array(dashboardGoalProgressSnapshotSchema),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type DashboardGoalResponse = z.infer<typeof dashboardGoalResponseSchema>

export const dashboardGoalsResponseSchema = z.object({
  items: z.array(dashboardGoalResponseSchema),
})
export type DashboardGoalsResponse = z.infer<typeof dashboardGoalsResponseSchema>

export const dashboardGoalWriteInputSchema = z.object({
  name: z.string(),
  goalType: dashboardGoalTypeSchema,
  currency: z.string(),
  targetAmount: z.number(),
  currentAmount: z.number(),
  targetDate: z.string().nullable(),
  note: z.string().nullable(),
})
export type DashboardGoalWriteInput = z.infer<typeof dashboardGoalWriteInputSchema>
