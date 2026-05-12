/**
 * Admin route: POST /api/dashboard/signals/x-twitter/daily-previous-day-sync
 *
 * Drives the previous-day timeline pull for the X-followed signal sources.
 * Strict budget control: never spends without an explicit `manualConfirm` once
 * the estimate exceeds `X_REQUIRE_MANUAL_CONFIRMATION_OVER_ESTIMATE_USD`, and
 * never exceeds the daily / monthly cap unless `allowBudgetOverride=true`
 * (admin-only escape hatch, loudly logged).
 *
 * Outputs:
 *   1. Run record in `signal_ingestion_run` (runType=manual_import or scheduled)
 *   2. Tweets written to `signal_item` with provenance + score (only if
 *      runMode != dry_run)
 *   3. One ledger row per X HTTP call in `x_twitter_usage_ledger`
 */

import { schema } from '@finance-os/db'
import { and, eq, sql } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { randomUUID } from 'node:crypto'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { rejectInvalidCredentials, requireAdmin } from '../../../auth/guard'
import type { ApiDb } from '../types'
import {
  computePreviousDayWindow,
  type PreviousDayRunMode,
  type PreviousDaySyncOutcome,
  runPreviousDaySync,
  type XTwitterFollowedAccount,
} from '../services/providers/x-twitter-daily-sync'
import { createXTwitterHttpTimelineFetcher } from '../services/providers/x-twitter-http-fetcher'
import {
  readXUsageSnapshot,
  writeXUsageLedger,
} from '../services/providers/x-twitter-usage-ledger'

const bodySchema = t.Object({
  runMode: t.Optional(
    t.Union([
      t.Literal('automatic_capped'),
      t.Literal('manual_full_previous_day'),
      t.Literal('dry_run'),
    ])
  ),
  dryRun: t.Optional(t.Boolean()),
  manualConfirm: t.Optional(t.Boolean()),
  allowBudgetOverride: t.Optional(t.Boolean()),
  limitAccounts: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
})

type Body = {
  runMode?: PreviousDayRunMode
  dryRun?: boolean
  manualConfirm?: boolean
  allowBudgetOverride?: boolean
  limitAccounts?: number
}

export type XDailySyncEnv = {
  NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN?: string | undefined
  X_DAILY_BUDGET_USD: number
  X_MONTHLY_BUDGET_USD: number
  X_MAX_POST_READS_PER_DAY: number
  X_MAX_PAGES_PER_USER_PER_DAY: number
  X_MAX_TWEETS_PER_AUTHOR_PER_DAY: number
  X_REQUIRE_MANUAL_CONFIRMATION_OVER_ESTIMATE_USD: number
  X_ADVISOR_RELEVANCE_THRESHOLD: number
  X_ADVISOR_MAX_TWEETS_PER_DAY: number
  X_DAILY_PREVIOUS_DAY_TIMEZONE: string
}

const MAX_RESULTS_PER_PAGE = 100

export const fetchXFollowedAccounts = async (
  db: ApiDb,
  limitOverride?: number
): Promise<XTwitterFollowedAccount[]> => {
  const rows = await db
    .select({
      id: schema.signalSource.id,
      handle: schema.signalSource.handle,
      externalId: schema.signalSource.externalId,
      priority: schema.signalSource.priority,
    })
    .from(schema.signalSource)
    .where(
      and(eq(schema.signalSource.provider, 'x_twitter'), eq(schema.signalSource.enabled, true))
    )
    .orderBy(sql`${schema.signalSource.priority} desc`)
    .limit(limitOverride ?? 50)

  return rows.map(r => ({
    signalSourceId: r.id,
    handle: r.handle,
    externalId: r.externalId,
    priority: r.priority,
  }))
}

const persistTweetsAsSignalItems = async ({
  db,
  runId,
  ingestionRunId,
  tweets,
  scope,
}: {
  db: ApiDb
  runId: string
  ingestionRunId: number | null
  tweets: PreviousDaySyncOutcome['perAuthor'] extends infer _
    ? Array<{
        id: string
        text: string
        authorId: string
        createdAt: string
        sourceHandle: string
        score: number
        keptForAdvisor: boolean
        lang?: string | null
        publicMetrics?: {
          likeCount?: number
          retweetCount?: number
          replyCount?: number
          quoteCount?: number
        } | null
      }>
    : never
  scope: 'admin' | 'demo'
}): Promise<{ insertedCount: number; dedupedCount: number }> => {
  if (tweets.length === 0) return { insertedCount: 0, dedupedCount: 0 }
  let inserted = 0
  let deduped = 0

  for (const tweet of tweets) {
    const url = `https://x.com/i/web/status/${tweet.id}`
    const fetchedAt = new Date()
    const publishedAt = tweet.createdAt ? new Date(tweet.createdAt) : fetchedAt
    const dedupeKey = `x_twitter:${tweet.id}`
    const contentHash = `x_twitter:${tweet.id}:${tweet.text.length}`
    try {
      await db.insert(schema.signalItem).values({
        sourceProvider: 'x_twitter',
        sourceType: 'social',
        externalId: tweet.id,
        url,
        title: tweet.text.slice(0, 200),
        body: tweet.text,
        author: `@${tweet.sourceHandle}`,
        publishedAt,
        fetchedAt,
        language: tweet.lang ?? 'en',
        relevanceScore: tweet.score,
        signalDomain: tweet.keptForAdvisor ? 'social_finance' : 'social_filtered',
        requiresAttention: tweet.keptForAdvisor && tweet.score >= 80,
        dedupeKey,
        contentHash,
        graphIngestStatus: 'pending',
        advisorIngestStatus: tweet.keptForAdvisor ? 'pending' : 'skipped',
        scope,
        ingestionRunId,
        provenance: {
          provider: 'x_twitter',
          runId,
          handle: tweet.sourceHandle,
          authorId: tweet.authorId,
          score: tweet.score,
          keptForAdvisor: tweet.keptForAdvisor,
          publicMetrics: tweet.publicMetrics ?? null,
        },
      })
      inserted += 1
    } catch (_error) {
      // Likely a dedupeKey unique conflict. We treat all insert errors as dedup
      // since the signal_item table has tight unique constraints.
      deduped += 1
    }
  }

  return { insertedCount: inserted, dedupedCount: deduped }
}

export const createXTwitterDailySyncRoute = ({
  db,
  env,
  now = () => new Date(),
  fetchFollowedAccounts = (limit?: number) => fetchXFollowedAccounts(db, limit),
}: {
  db: ApiDb
  env: XDailySyncEnv
  now?: () => Date
  fetchFollowedAccounts?: (limit?: number) => Promise<XTwitterFollowedAccount[]>
}) =>
  new Elysia().post(
    '/signals/x-twitter/daily-previous-day-sync',
    async context => {
      rejectInvalidCredentials(context)
      const requestId = getRequestMeta(context).requestId
      context.set.headers['cache-control'] = 'no-store'

      return demoOrReal({
        context,
        demo: () => {
          context.set.status = 403
          return {
            ok: false as const,
            code: 'DEMO_MODE_FORBIDDEN' as const,
            message: 'Admin session required',
            requestId,
          }
        },
        real: async () => {
          requireAdmin(context)
          const body = context.body as Body
          const dryRun = body.dryRun !== false && body.runMode !== 'manual_full_previous_day'
          const runMode: PreviousDayRunMode = body.runMode
            ? body.runMode
            : dryRun
              ? 'dry_run'
              : 'automatic_capped'

          const runId = `x-daily-${randomUUID()}`
          const startedAt = new Date()
          const window = computePreviousDayWindow({
            now: now(),
            timezone: env.X_DAILY_PREVIOUS_DAY_TIMEZONE,
          })
          const accounts = await fetchFollowedAccounts(body.limitAccounts)

          // Compute the remaining budget right before the run.
          const usage = await readXUsageSnapshot(db, now())
          const remainingMonthly = Math.max(
            0,
            env.X_MONTHLY_BUDGET_USD - usage.estimatedCostThisMonth
          )

          const outcome = await runPreviousDaySync({
            accounts,
            window,
            config: {
              runMode,
              budget: {
                dailyBudgetUsd: env.X_DAILY_BUDGET_USD,
                remainingMonthlyBudgetUsd: remainingMonthly,
                spentTodayUsd: usage.estimatedCostToday,
                requireManualConfirmationOverUsd:
                  env.X_REQUIRE_MANUAL_CONFIRMATION_OVER_ESTIMATE_USD,
                manuallyConfirmed: body.manualConfirm === true,
                allowBudgetOverride: body.allowBudgetOverride === true,
              },
              caps: {
                maxPostReadsPerDay: env.X_MAX_POST_READS_PER_DAY,
                maxPagesPerUserPerDay: env.X_MAX_PAGES_PER_USER_PER_DAY,
                maxResultsPerPage: MAX_RESULTS_PER_PAGE,
                maxTweetsPerAuthorPerDay: env.X_MAX_TWEETS_PER_AUTHOR_PER_DAY,
              },
              advisor: {
                relevanceThreshold: env.X_ADVISOR_RELEVANCE_THRESHOLD,
                maxTweetsPerDay: env.X_ADVISOR_MAX_TWEETS_PER_DAY,
              },
            },
            fetchTimeline: createXTwitterHttpTimelineFetcher({
              bearerToken: env.NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN ?? '',
              onUsage: async event => {
                await writeXUsageLedger(db, {
                  runId,
                  endpoint: event.endpoint,
                  postReads: event.postReads,
                  estimatedCostUsd: event.estimatedCostUsd,
                  statusCode: event.statusCode,
                  errorCode: event.errorCode,
                })
              },
            }),
          })

          // Persist run record + items (when not dry-run).
          let signalItemCounts = { insertedCount: 0, dedupedCount: 0 }
          let ingestionRunId: number | null = null
          if (outcome.runMode !== 'dry_run') {
            const [run] = await db
              .insert(schema.signalIngestionRun)
              .values({
                provider: 'x_twitter',
                runType: 'manual_import',
                startedAt,
                finishedAt: new Date(),
                status:
                  outcome.status === 'success'
                    ? 'success'
                    : outcome.status === 'partial'
                      ? 'partial'
                      : 'failed',
                fetchedCount: outcome.fetchedTweetCount,
                insertedCount: 0, // filled below after item insert
                dedupedCount: 0,
                classifiedCount: outcome.keptForAdvisorCount,
                requestId,
                errorSummary: outcome.errorMessage,
                durationMs: Date.now() - startedAt.getTime(),
              })
              .returning({ id: schema.signalIngestionRun.id })
            ingestionRunId = run?.id ?? null

            signalItemCounts = await persistTweetsAsSignalItems({
              db,
              runId,
              ingestionRunId,
              tweets: outcome.tweets,
              scope: 'admin',
            })

            if (ingestionRunId !== null) {
              await db
                .update(schema.signalIngestionRun)
                .set({
                  insertedCount: signalItemCounts.insertedCount,
                  dedupedCount: signalItemCounts.dedupedCount,
                })
                .where(eq(schema.signalIngestionRun.id, ingestionRunId))
            }
          }

          const httpStatus =
            outcome.status === 'requires_manual_confirmation'
              ? 412 // Precondition Failed — admin must resubmit with manualConfirm
              : outcome.status === 'skipped_budget_exceeded'
                ? 429
                : 200
          context.set.status = httpStatus
          return {
            ok: outcome.status === 'success' || outcome.status === 'partial',
            runId,
            requestId,
            mode: runMode,
            runStatus: outcome.status,
            capReason: outcome.capReason,
            window: outcome.window,
            estimatedPostReads: outcome.estimatedPostReads,
            estimatedCostUsd: outcome.estimatedCostUsd,
            actualCostUsd: outcome.actualCostUsd,
            fetchedTweetCount: outcome.fetchedTweetCount,
            keptForAdvisorCount: outcome.keptForAdvisorCount,
            signalItemCounts,
            ingestionRunId,
            perAuthor: outcome.perAuthor,
            errorCode: outcome.errorCode,
            errorMessage: outcome.errorMessage,
          }
        },
      })
    },
    { body: bodySchema }
  )

export const __testing = {
  persistTweetsAsSignalItems,
}
