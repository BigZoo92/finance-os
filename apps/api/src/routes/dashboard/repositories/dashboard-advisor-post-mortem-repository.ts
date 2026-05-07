// Production adapter for the post-mortem use-cases (PR4).
//
// Reads expired recommendations and writes structured post-mortem rows. Uses only the existing
// schema — no migrations beyond the additive `advisor_post_mortem` table.

import { schema } from '@finance-os/db'
import { and, desc, eq, isNotNull, isNull, lte, sql } from 'drizzle-orm'
import type {
  ExpiredRecommendationContext,
  PersistedPostMortemRow,
  PostMortemListResponse,
  PostMortemRepositoryAdapter,
  PostMortemRunStatus,
} from '../domain/advisor/post-mortem/create-post-mortem-use-cases'
import type { ApiDb } from '../types'

const toIso = (value: Date | null | undefined): string | null => value?.toISOString() ?? null

const toRiskLevel = (
  raw: unknown
): 'low' | 'medium' | 'high' | null => {
  if (raw === 'low' || raw === 'medium' || raw === 'high') return raw
  return null
}

const toDecisionKind = (
  raw: unknown
): 'accepted' | 'rejected' | 'deferred' | 'ignored' | null => {
  if (raw === 'accepted' || raw === 'rejected' || raw === 'deferred' || raw === 'ignored') {
    return raw
  }
  return null
}

interface PostMortemRow {
  id: number
  runId: number | null
  recommendationId: number | null
  decisionId: number | null
  recommendationKey: string | null
  status: string
  horizonDays: number | null
  evaluatedAt: Date | null
  expectedOutcomeAt: Date | null
  inputSummary: Record<string, unknown> | null
  findings: Record<string, unknown> | null
  learningActions: Array<Record<string, unknown>> | null
  calibration: Record<string, unknown> | null
  riskNotes: Record<string, unknown> | null
  skippedReason: string | null
  errorCode: string | null
  createdAt: Date
  updatedAt: Date
}

const KNOWN_STATUSES: ReadonlySet<PostMortemRunStatus> = new Set([
  'pending',
  'completed',
  'skipped',
  'failed',
])

const normalizeStatus = (raw: string): PostMortemRunStatus =>
  KNOWN_STATUSES.has(raw as PostMortemRunStatus) ? (raw as PostMortemRunStatus) : 'pending'

const mapPostMortemRow = (row: PostMortemRow): PersistedPostMortemRow => ({
  id: row.id,
  runId: row.runId ?? null,
  recommendationId: row.recommendationId ?? null,
  decisionId: row.decisionId ?? null,
  recommendationKey: row.recommendationKey ?? null,
  status: normalizeStatus(row.status),
  horizonDays: row.horizonDays ?? null,
  evaluatedAt: toIso(row.evaluatedAt),
  expectedOutcomeAt: toIso(row.expectedOutcomeAt),
  inputSummary: row.inputSummary ?? null,
  findings: row.findings ?? null,
  learningActions: row.learningActions ?? null,
  calibration: row.calibration ?? null,
  riskNotes: row.riskNotes ?? null,
  skippedReason: row.skippedReason ?? null,
  errorCode: row.errorCode ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export const createDashboardAdvisorPostMortemRepository = ({
  db,
}: {
  db: ApiDb
}): PostMortemRepositoryAdapter => {
  return {
    async listExpiredContexts(input) {
      // Strategy: pull recommendations whose `expiresAt` has passed AND that don't yet have a
      // completed post-mortem row pointing at them. We read everything we need in one pass —
      // recommendation, decision (latest if any), outcomes, optionally hypothesis context via
      // the linked strategy.
      //
      // The query is intentionally narrow and bounded by `limit`. This is the read path of the
      // post-mortem batch — it must stay fast and predictable.
      const rows = await db
        .select({
          recommendation: schema.aiRecommendation,
          run: schema.aiRun,
        })
        .from(schema.aiRecommendation)
        .leftJoin(schema.aiRun, eq(schema.aiRun.id, schema.aiRecommendation.runId))
        .where(
          and(
            isNotNull(schema.aiRecommendation.expiresAt),
            lte(schema.aiRecommendation.expiresAt, input.now),
            sql`NOT EXISTS (
              SELECT 1 FROM ${schema.advisorPostMortem} pm
              WHERE pm.recommendation_id = ${schema.aiRecommendation.id}
                AND pm.status = 'completed'
            )`
          )
        )
        .orderBy(desc(schema.aiRecommendation.expiresAt))
        .limit(input.limit)

      if (rows.length === 0) return []

      const recommendationIds: number[] = rows.map((r: (typeof rows)[number]) => r.recommendation.id)
      const recommendationKeys: string[] = rows
        .map((r: (typeof rows)[number]) => r.recommendation.recommendationKey)
        .filter((v: string | null): v is string => typeof v === 'string')

      // Best decision per recommendation (newest first) by recommendationId or recommendationKey.
      const decisionRows =
        recommendationIds.length === 0 && recommendationKeys.length === 0
          ? []
          : await db
              .select()
              .from(schema.advisorDecisionJournal)
              .where(
                and(
                  sql`(${schema.advisorDecisionJournal.recommendationId} = ANY(${recommendationIds}::int[])
                       OR ${schema.advisorDecisionJournal.recommendationKey} = ANY(${recommendationKeys}::text[]))`
                )
              )
              .orderBy(desc(schema.advisorDecisionJournal.decidedAt))

      const decisionByRecommendationId = new Map<number, typeof decisionRows[number]>()
      const decisionByRecommendationKey = new Map<string, typeof decisionRows[number]>()
      for (const row of decisionRows) {
        if (row.recommendationId !== null && !decisionByRecommendationId.has(row.recommendationId)) {
          decisionByRecommendationId.set(row.recommendationId, row)
        }
        if (
          row.recommendationKey !== null &&
          !decisionByRecommendationKey.has(row.recommendationKey)
        ) {
          decisionByRecommendationKey.set(row.recommendationKey, row)
        }
      }

      const decisionIds: number[] = decisionRows.map((d: (typeof decisionRows)[number]) => d.id)
      const outcomeRows =
        decisionIds.length === 0
          ? []
          : await db
              .select()
              .from(schema.advisorDecisionOutcome)
              .where(sql`${schema.advisorDecisionOutcome.decisionId} = ANY(${decisionIds}::int[])`)
              .orderBy(schema.advisorDecisionOutcome.observedAt)
      type OutcomeRow = (typeof outcomeRows)[number]
      const outcomesByDecisionId = new Map<number, OutcomeRow[]>()
      for (const o of outcomeRows as OutcomeRow[]) {
        const list = outcomesByDecisionId.get(o.decisionId) ?? []
        list.push(o)
        outcomesByDecisionId.set(o.decisionId, list)
      }

      const out: ExpiredRecommendationContext[] = []
      for (const { recommendation, run } of rows) {
        const decision =
          (recommendation.id !== null && decisionByRecommendationId.get(recommendation.id)) ||
          (recommendation.recommendationKey !== null &&
            decisionByRecommendationKey.get(recommendation.recommendationKey)) ||
          null
        const decisionOutcomes =
          decision !== null ? outcomesByDecisionId.get(decision.id) ?? [] : []

        const expiresAt = recommendation.expiresAt
        const horizonDays =
          run?.startedAt && expiresAt
            ? Math.max(
                0,
                Math.round((expiresAt.getTime() - run.startedAt.getTime()) / (24 * 60 * 60 * 1000))
              )
            : input.horizonDays

        out.push({
          recommendationId: recommendation.id,
          recommendationKey: recommendation.recommendationKey,
          runId: recommendation.runId,
          decisionId: decision?.id ?? null,
          decisionKind:
            decision !== null && decision !== undefined ? toDecisionKind(decision.decision) : null,
          reasonCode: decision?.reasonCode ?? null,
          decidedAt: decision !== null ? toIso(decision.decidedAt) : null,
          expectedOutcomeAt: toIso(expiresAt),
          horizonDays,
          recommendationTitle: recommendation.title,
          recommendationCategory: recommendation.category,
          recommendationConfidence:
            typeof recommendation.confidence === 'string'
              ? Number.parseFloat(recommendation.confidence)
              : null,
          recommendationRiskLevel: toRiskLevel(recommendation.riskLevel),
          evidence: Array.isArray(recommendation.evidence)
            ? (recommendation.evidence as string[])
            : [],
          assumptions: Array.isArray(recommendation.assumptions)
            ? (recommendation.assumptions as string[])
            : [],
          outcomes: decisionOutcomes.map(o => ({
            outcomeKind: o.outcomeKind,
            observedAt: o.observedAt.toISOString(),
            learningTags: Array.isArray(o.learningTags) ? (o.learningTags as string[]) : [],
          })),
          // Hypothesis context: only attached when the recommendation links cleanly to a manual
          // hypothesis through its evidence/assumptions metadata. PR4 keeps this conservative —
          // we omit the key entirely when no clean link exists. A future PR can wire a
          // recommendation→hypothesis foreign relation and resurface this with structured data
          // from `parameters.hypothesis` (PR3-fix).
        })
      }
      return out
    },

    async insertPostMortem(input) {
      const [row] = await db
        .insert(schema.advisorPostMortem)
        .values({
          status: input.status,
          ...(input.runId !== undefined && input.runId !== null ? { runId: input.runId } : {}),
          ...(input.recommendationId !== undefined && input.recommendationId !== null
            ? { recommendationId: input.recommendationId }
            : {}),
          ...(input.decisionId !== undefined && input.decisionId !== null
            ? { decisionId: input.decisionId }
            : {}),
          ...(input.recommendationKey !== undefined && input.recommendationKey !== null
            ? { recommendationKey: input.recommendationKey }
            : {}),
          ...(typeof input.horizonDays === 'number' ? { horizonDays: input.horizonDays } : {}),
          evaluatedAt: input.evaluatedAt,
          ...(input.expectedOutcomeAt !== undefined && input.expectedOutcomeAt !== null
            ? { expectedOutcomeAt: input.expectedOutcomeAt }
            : {}),
          ...(input.inputSummary !== undefined && input.inputSummary !== null
            ? { inputSummary: input.inputSummary }
            : {}),
          ...(input.findings !== undefined && input.findings !== null
            ? { findings: input.findings }
            : {}),
          ...(input.learningActions !== undefined && input.learningActions !== null
            ? { learningActions: input.learningActions }
            : {}),
          ...(input.calibration !== undefined && input.calibration !== null
            ? { calibration: input.calibration }
            : {}),
          ...(input.riskNotes !== undefined && input.riskNotes !== null
            ? { riskNotes: input.riskNotes }
            : {}),
          ...(input.skippedReason !== undefined && input.skippedReason !== null
            ? { skippedReason: input.skippedReason }
            : {}),
          ...(input.errorCode !== undefined && input.errorCode !== null
            ? { errorCode: input.errorCode }
            : {}),
        })
        .returning()
      if (!row) throw new Error('Failed to insert advisor post-mortem row')
      return mapPostMortemRow(row as PostMortemRow)
    },

    async listPostMortems(input) {
      const rows = await db
        .select()
        .from(schema.advisorPostMortem)
        .orderBy(desc(schema.advisorPostMortem.createdAt))
        .limit(Math.max(1, Math.min(input.limit, 200)))
      return {
        items: rows.map((row: PostMortemRow) => mapPostMortemRow(row)),
      } satisfies PostMortemListResponse
    },

    async getPostMortemById(id) {
      const [row] = await db
        .select()
        .from(schema.advisorPostMortem)
        .where(eq(schema.advisorPostMortem.id, id))
        .limit(1)
      if (!row) return null
      return mapPostMortemRow(row as PostMortemRow)
    },
  }
}

// Used by the `or`-chained ANY() condition above to keep TypeScript happy when the array is
// empty. Drizzle's `inArray` with empty list would generate `IN ()` which Postgres rejects;
// using `ANY(ARRAY[])` works but TS needs the import path settled. We simply guard at the
// call-site so this branch is unreachable when both lists are empty (see the early return).
void isNull // keep import used; isNull may be needed in future read paths
