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
import { logApiEvent } from '../../../observability/logger'
import type { ApiDb } from '../types'
import {
  computePreviousDayWindow,
  dedupeXFollowedAccounts,
  type PreviousDayRunMode,
  type PreviousDaySyncOutcome,
  runPreviousDaySync,
  type XTwitterFollowedAccount,
} from '../services/providers/x-twitter-daily-sync'
import { createXTwitterHttpTimelineFetcher } from '../services/providers/x-twitter-http-fetcher'
import {
  X_BATCH_MAX_USERNAMES,
  createXTwitterProfileClient,
  type XTwitterFetch,
} from '../services/providers/x-twitter-profile-client'
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
  X_MAX_USER_READS_PER_DAY: number
  X_MAX_PAGES_PER_USER_PER_DAY: number
  X_MAX_TWEETS_PER_AUTHOR_PER_DAY: number
  X_REQUIRE_MANUAL_CONFIRMATION_OVER_ESTIMATE_USD: number
  X_ADVISOR_RELEVANCE_THRESHOLD: number
  X_ADVISOR_MAX_TWEETS_PER_DAY: number
  X_DAILY_PREVIOUS_DAY_TIMEZONE: string
  /** When true (default), an admin manual run tries to batch-resolve any
   *  followed account whose external_id is null before fetching tweets.
   *  Cron / scheduled runs still skip auto-resolve to avoid surprise spend. */
  X_AUTO_RESOLVE_HANDLES_ON_MANUAL_RUN?: boolean
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
    .limit(limitOverride ? Math.min(limitOverride * 4, 200) : 200)

  const accounts = rows.map(r => ({
    signalSourceId: r.id,
    handle: r.handle,
    externalId: r.externalId,
    priority: r.priority,
  }))
  return dedupeXFollowedAccounts(accounts).accounts.slice(0, limitOverride ?? 50)
}

/**
 * Best-effort batch resolution of accounts whose `externalId` is null so the
 * subsequent timeline pull can actually run. Persists the canonical handle +
 * profile metadata on each resolved row. Never throws — any provider error
 * is swallowed and the unresolved accounts simply stay unresolved, which the
 * orchestrator then reports as `UNRESOLVED_HANDLE` per-author.
 *
 * Mirrors the budget discipline of the explicit resolve-all endpoint: if the
 * daily user-read cap is already exhausted, skip the lookup entirely.
 */
const autoResolveMissingExternalIds = async ({
  db,
  accounts,
  bearerToken,
  fetcher,
  requestId,
  now,
  userReadsToday,
  maxUserReadsPerDay,
}: {
  db: ApiDb
  accounts: XTwitterFollowedAccount[]
  bearerToken: string
  fetcher: XTwitterFetch
  requestId: string | null
  now: Date
  userReadsToday: number
  maxUserReadsPerDay: number
}): Promise<{ accounts: XTwitterFollowedAccount[]; resolvedCount: number; failedCount: number }> => {
  const deduped = dedupeXFollowedAccounts(accounts)
  accounts = deduped.accounts
  const missing = accounts.filter(a => a.externalId === null)
  if (missing.length === 0 || !bearerToken) {
    return { accounts, resolvedCount: 0, failedCount: 0 }
  }
  if (userReadsToday >= maxUserReadsPerDay) {
    logApiEvent({
      level: 'warn',
      msg: 'x_twitter_auto_resolve_skipped_budget',
      requestId,
      stage: 'auto_resolve',
      reason: 'daily_user_read_cap_reached',
      missingCount: missing.length,
    })
    return { accounts, resolvedCount: 0, failedCount: 0 }
  }

  const client = createXTwitterProfileClient({ bearerToken, fetcher })
  const enriched = new Map<number, XTwitterFollowedAccount>()
  let resolvedCount = 0
  let failedCount = 0
  let providerErrorEncountered = false

  for (let i = 0; i < missing.length; i += X_BATCH_MAX_USERNAMES) {
    if (providerErrorEncountered) break
    const chunk = missing.slice(i, i + X_BATCH_MAX_USERNAMES)
    const handles = chunk.map(a => a.handle)
    const outcome = await client.lookupHandlesBatch(handles)
    if (outcome.providerError) {
      providerErrorEncountered = true
      logApiEvent({
        level: 'warn',
        msg: 'x_twitter_auto_resolve_provider_error',
        requestId,
        stage: 'auto_resolve',
        providerErrorCode: outcome.providerError.code,
        statusCode: outcome.providerError.statusCode,
        rateLimitRemaining: outcome.rateLimit?.remaining ?? null,
        rateLimitResetAt: outcome.rateLimit?.resetAt ?? null,
      })
    }

    for (const item of outcome.items) {
      const account = chunk.find(a => a.handle === item.handle)
      if (!account) continue
      if (!item.ok) {
        failedCount += 1
        continue
      }
      await db
        .update(schema.signalSource)
        .set({
          handle: item.profile.username,
          externalId: item.profile.id,
          profileImageUrl: item.profile.profileImageUrl,
          profileMetadata: {
            username: item.profile.username,
            name: item.profile.name,
            description: item.profile.description,
            profileBannerUrl: item.profile.profileBannerUrl,
            verified: item.profile.verified,
            verifiedType: item.profile.verifiedType,
            protected: item.profile.protected,
            publicMetrics: item.profile.publicMetrics,
            createdAt: item.profile.createdAt,
          },
          profileCachedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.signalSource.id, account.signalSourceId))

      enriched.set(account.signalSourceId, {
        ...account,
        handle: item.profile.username,
        externalId: item.profile.id,
      })
      resolvedCount += 1
    }

    await writeXUsageLedger(db, {
      runId: null,
      endpoint: 'users/by',
      userReads: outcome.userReads,
      estimatedCostUsd: outcome.estimatedCostUsd,
      statusCode: outcome.providerError?.statusCode ?? 200,
      errorCode: outcome.providerError?.code ?? null,
    })
  }

  const merged = accounts.map(a => enriched.get(a.signalSourceId) ?? a)
  if (resolvedCount > 0) {
    logApiEvent({
      level: 'info',
      msg: 'x_twitter_auto_resolve_completed',
      requestId,
      stage: 'auto_resolve',
      resolvedCount,
      failedCount,
      remainingUnresolved: merged.filter(a => a.externalId === null).length,
    })
  }
  return { accounts: merged, resolvedCount, failedCount }
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

/**
 * Default profile-lookup fetcher used by the auto-resolve step. Mirrors the
 * one in `x-twitter-lookup.ts` so the auto-resolve path doesn't depend on
 * route-internal helpers.
 */
const defaultProfileFetcher: XTwitterFetch = async ({ url, bearerToken }) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'User-Agent': 'Finance-OS X Daily Sync Auto-Resolve/1.0',
    },
  })
  const parsed = await response.json().catch(() => ({}))
  const body: Record<string, unknown> =
    parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  const rateLimit = {
    limit: numericHeader(response.headers.get('x-rate-limit-limit')),
    remaining: numericHeader(response.headers.get('x-rate-limit-remaining')),
    resetAt: numericHeader(response.headers.get('x-rate-limit-reset')),
  }
  return { status: response.status, body, rateLimit }
}

const numericHeader = (value: string | null): number | null => {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const createXTwitterDailySyncRoute = ({
  db,
  env,
  now = () => new Date(),
  fetchFollowedAccounts = (limit?: number) => fetchXFollowedAccounts(db, limit),
  profileFetcher = defaultProfileFetcher,
}: {
  db: ApiDb
  env: XDailySyncEnv
  now?: () => Date
  fetchFollowedAccounts?: (limit?: number) => Promise<XTwitterFollowedAccount[]>
  /** Optional override for the profile-lookup HTTP fetcher (auto-resolve).
   *  Tests inject a stub here; production uses the real fetch wrapper. */
  profileFetcher?: XTwitterFetch
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
          const rawAccounts = await fetchFollowedAccounts(body.limitAccounts)
          const accountDedupe = dedupeXFollowedAccounts(rawAccounts)

          // Compute the remaining budget right before the run.
          const usage = await readXUsageSnapshot(db, now())
          const remainingMonthly = Math.max(
            0,
            env.X_MONTHLY_BUDGET_USD - usage.estimatedCostThisMonth
          )

          // Auto-resolve any handle that lost / never had its external_id.
          // Skipped for dry-runs (we never spend on a dry-run) and when the
          // admin explicitly disables it via env. This is the fix for the
          // prod regression where a manual run returned 17 × UNRESOLVED_HANDLE
          // because no one ever ran a per-handle lookup first.
          const autoResolveEnabled =
            (env.X_AUTO_RESOLVE_HANDLES_ON_MANUAL_RUN ?? true) && runMode !== 'dry_run'
          let autoResolved = 0
          let autoResolveFailed = 0
          let accounts = accountDedupe.accounts
          if (autoResolveEnabled) {
            const result = await autoResolveMissingExternalIds({
              db,
              accounts,
              bearerToken: env.NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN ?? '',
              fetcher: profileFetcher,
              requestId,
              now: now(),
              userReadsToday: usage.userReadsToday,
              maxUserReadsPerDay: env.X_MAX_USER_READS_PER_DAY,
            })
            accounts = result.accounts
            autoResolved = result.resolvedCount
            autoResolveFailed = result.failedCount
          }

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
            dedupedSourcesCount: accountDedupe.dedupedSourcesCount,
            dedupedSources: accountDedupe.dedupedSources,
            errorCode: outcome.errorCode,
            errorMessage: outcome.errorMessage,
            autoResolve: {
              enabled: autoResolveEnabled,
              resolvedCount: autoResolved,
              failedCount: autoResolveFailed,
            },
          }
        },
      })
    },
    { body: bodySchema }
  )

export const __testing = {
  persistTweetsAsSignalItems,
  autoResolveMissingExternalIds,
}
