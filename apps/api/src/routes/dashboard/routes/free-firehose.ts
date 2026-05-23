/**
 * Admin routes for the Free Firehose:
 *   POST /api/dashboard/admin/free-firehose/estimate  — dry-run, never writes
 *   POST /api/dashboard/admin/free-firehose/run       — live, gated by weekly cap
 *
 * Builds concrete `FreeFirehoseProviderRunner`s from the existing free news
 * providers (GDELT, Hacker News, ECB RSS, Fed RSS, SEC EDGAR, FRED). X / Twitter
 * is structurally excluded by the orchestrator's allowlist — it doesn't even
 * appear in the adapter map. Paid providers (EODHD, TwelveData, Alpha Vantage)
 * are not part of the news provider system at all and therefore can never be
 * invoked from this route.
 *
 * All routes require admin auth and reject silent demo fallback on bad creds.
 */

import { schema } from '@finance-os/db'
import { eq, sql } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { randomUUID } from 'node:crypto'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { rejectInvalidCredentials, requireAdmin } from '../../../auth/guard'
import { logApiEvent, toErrorLogFields } from '../../../observability/logger'
import type { ApiDb } from '../types'
import {
  estimateFreeFirehoseVolume,
  type FreeFirehoseProviderId,
  type FreeFirehoseProviderRunner,
  runFreeFirehose,
} from '../services/providers/free-firehose-orchestrator'
import { createGdeltNewsProvider } from '../services/providers/gdelt-news-provider'
import { createHnNewsProvider } from '../services/providers/hn-news-provider'
import { createEcbRssNewsProvider } from '../services/providers/ecb-rss-news-provider'
import { createFedRssNewsProvider } from '../services/providers/fed-rss-news-provider'
import { createSecEdgarNewsProvider } from '../services/providers/sec-edgar-news-provider'
import { createFredNewsProvider } from '../services/providers/fred-news-provider'
import type { NewsProviderAdapter } from '../services/news-provider-types'
import type { NewsProviderRawItem } from '../domain/news-types'

export type FreeFirehoseEnv = {
  FREE_FIREHOSE_ENABLED: boolean
  FREE_FIREHOSE_MAX_RUNS_PER_WEEK: number
  FREE_FIREHOSE_MAX_GDELT_RECORDS: number
  FREE_FIREHOSE_MAX_HN_RECORDS: number
  FREE_FIREHOSE_MAX_SEC_FILINGS: number
  FREE_FIREHOSE_MAX_FRED_SERIES: number
  FREE_FIREHOSE_MAX_ECB_SERIES: number
  // Provider config — read from the same env shape the news ingest uses.
  NEWS_PROVIDER_HN_QUERY?: string | undefined
  NEWS_PROVIDER_GDELT_QUERY?: string | undefined
  NEWS_PROVIDER_ECB_RSS_FEED_URLS?: string[] | undefined
  NEWS_PROVIDER_FED_FEED_URLS?: string[] | undefined
  NEWS_PROVIDER_SEC_TICKERS?: string[] | undefined
  NEWS_PROVIDER_FRED_SERIES_IDS?: string[] | undefined
  FRED_API_KEY?: string | undefined
  SEC_USER_AGENT?: string | undefined
}

const adaptNewsItemToSignalItem = (
  raw: NewsProviderRawItem,
  runId: string,
  ingestionRunId: number | null
): typeof schema.signalItem.$inferInsert => {
  const fetchedAt = new Date()
  return {
    sourceProvider: raw.provider,
    sourceType: raw.sourceType === 'social' ? 'social' : 'news',
    externalId: raw.providerArticleId,
    url: raw.providerUrl ?? raw.canonicalUrl,
    title: raw.title.slice(0, 500),
    body: raw.summary ?? raw.contentSnippet ?? null,
    author: raw.sourceName,
    publishedAt: raw.publishedAt ?? fetchedAt,
    fetchedAt,
    language: raw.language ?? 'en',
    signalDomain: 'free_firehose',
    requiresAttention: false,
    dedupeKey: `${raw.provider}:${raw.providerArticleId}`,
    contentHash: `${raw.provider}:${raw.providerArticleId}:${raw.title.length}`,
    graphIngestStatus: 'pending',
    advisorIngestStatus: 'skipped', // Free firehose never auto-feeds Advisor; admin opts in explicitly later.
    scope: 'admin',
    ingestionRunId,
    provenance: {
      provider: raw.provider,
      sourceName: raw.sourceName,
      sourceDomain: raw.sourceDomain,
      runId,
    },
  }
}

const wrapNewsProvider = ({
  adapter,
  id,
  maxRecords,
  db,
  runId,
  ingestionRunId,
}: {
  adapter: NewsProviderAdapter
  id: FreeFirehoseProviderId
  maxRecords: number
  db: ApiDb
  runId: string
  ingestionRunId: number | null
}): FreeFirehoseProviderRunner => ({
  id,
  maxRecords,
  run: async ({ dryRun }) => {
    if (!adapter.enabled) {
      return {
        fetchedCount: 0,
        insertedCount: 0,
        dedupedCount: 0,
        failedCount: 0,
        errorCodes: ['PROVIDER_DISABLED'],
      }
    }
    let items: NewsProviderRawItem[] = []
    try {
      items = await adapter.fetchItems({
        requestId: runId,
        now: new Date(),
        maxItems: maxRecords,
      })
    } catch (error) {
      return {
        fetchedCount: 0,
        insertedCount: 0,
        dedupedCount: 0,
        failedCount: 1,
        errorCodes: [error instanceof Error ? error.name : 'UNKNOWN_ERROR'],
      }
    }

    if (dryRun) {
      return {
        fetchedCount: items.length,
        insertedCount: 0,
        dedupedCount: 0,
        failedCount: 0,
        errorCodes: [],
      }
    }

    let inserted = 0
    let deduped = 0
    for (const raw of items) {
      try {
        await db
          .insert(schema.signalItem)
          .values(adaptNewsItemToSignalItem(raw, runId, ingestionRunId))
        inserted += 1
      } catch {
        deduped += 1
      }
    }
    return {
      fetchedCount: items.length,
      insertedCount: inserted,
      dedupedCount: deduped,
      failedCount: 0,
      errorCodes: [],
    }
  },
})

export const buildFreeFirehoseRunners = ({
  env,
  db,
  runId,
  ingestionRunId,
}: {
  env: FreeFirehoseEnv
  db: ApiDb
  runId: string
  ingestionRunId: number | null
}): FreeFirehoseProviderRunner[] => {
  const runners: FreeFirehoseProviderRunner[] = []

  runners.push(
    wrapNewsProvider({
      id: 'gdelt',
      maxRecords: env.FREE_FIREHOSE_MAX_GDELT_RECORDS,
      adapter: createGdeltNewsProvider({
        enabled: true,
        query: env.NEWS_PROVIDER_GDELT_QUERY ?? 'finance OR macro OR earnings',
      }),
      db,
      runId,
      ingestionRunId,
    })
  )
  runners.push(
    wrapNewsProvider({
      id: 'hn',
      maxRecords: env.FREE_FIREHOSE_MAX_HN_RECORDS,
      adapter: createHnNewsProvider({
        enabled: true,
        query: env.NEWS_PROVIDER_HN_QUERY ?? 'finance OR macro OR earnings',
      }),
      db,
      runId,
      ingestionRunId,
    })
  )
  runners.push(
    wrapNewsProvider({
      id: 'ecb_rss',
      maxRecords: env.FREE_FIREHOSE_MAX_ECB_SERIES,
      adapter: createEcbRssNewsProvider({
        enabled: true,
        feedUrls: env.NEWS_PROVIDER_ECB_RSS_FEED_URLS ?? [],
      }),
      db,
      runId,
      ingestionRunId,
    })
  )
  runners.push(
    wrapNewsProvider({
      id: 'fed_rss',
      maxRecords: env.FREE_FIREHOSE_MAX_ECB_SERIES,
      adapter: createFedRssNewsProvider({
        enabled: true,
        feedUrls: env.NEWS_PROVIDER_FED_FEED_URLS ?? [],
      }),
      db,
      runId,
      ingestionRunId,
    })
  )
  runners.push(
    wrapNewsProvider({
      id: 'sec_edgar',
      maxRecords: env.FREE_FIREHOSE_MAX_SEC_FILINGS,
      adapter: createSecEdgarNewsProvider({
        enabled: true,
        watchlistTickers: env.NEWS_PROVIDER_SEC_TICKERS ?? [],
        userAgent: env.SEC_USER_AGENT ?? 'finance-os-firehose/1.0',
      }),
      db,
      runId,
      ingestionRunId,
    })
  )
  if (env.FRED_API_KEY) {
    runners.push(
      wrapNewsProvider({
        id: 'fred',
        maxRecords: env.FREE_FIREHOSE_MAX_FRED_SERIES,
        adapter: createFredNewsProvider({
          enabled: true,
          apiKey: env.FRED_API_KEY,
          seriesIds: env.NEWS_PROVIDER_FRED_SERIES_IDS ?? [],
        }),
        db,
        runId,
        ingestionRunId,
      })
    )
  }

  return runners
}

const buildHistoryAdapter = ({ db }: { db: ApiDb }) => ({
  // Use Postgres SQL `now() - make_interval(...)` so the windowDays value is
  // bound as an integer parameter — never as a localized JS Date string. A
  // previous version passed `new Date(...)` directly into the sql template,
  // which Drizzle serialized via `Date.prototype.toString()` (locale-dependent,
  // produces "Mon May 11 2026 23:42:39 GMT+0200 (Central European Summer Time)")
  // and Postgres rejected with status 22008.
  countLastNDays: async (windowDays: number) => {
    const [row] = await db
      .select({ count: sql<number>`count(*)`.as('count') })
      .from(schema.freeFirehoseRun)
      .where(
        sql`${schema.freeFirehoseRun.startedAt} >= now() - make_interval(days => ${windowDays}) AND ${schema.freeFirehoseRun.mode} = 'live'`
      )
    return Number(row?.count ?? 0)
  },
  createRunRecord: async (input: {
    runId: string
    mode: 'dry_run' | 'live'
    quotaOverride?: {
      requested: boolean
      confirmedRisk: boolean
      reason: string | null
    } | null
  }) => {
    await db.insert(schema.freeFirehoseRun).values({
      runId: input.runId,
      requestedBy: 'admin',
      mode: input.mode,
      status: 'running',
      overrideRequested: input.quotaOverride?.requested === true,
      overrideReason: input.quotaOverride?.reason ?? null,
      overrideConfirmedRisk: input.quotaOverride?.confirmedRisk === true,
      overrideUsed:
        input.quotaOverride?.requested === true && input.quotaOverride.confirmedRisk === true,
    })
  },
  finishRunRecord: async (input: {
    runId: string
    status: 'success' | 'partial' | 'failed' | 'cancelled' | 'skipped_quota'
    durationMs: number
    counts: { fetched: number; inserted: number; deduped: number; skipped: number; failed: number }
    providerBreakdown: Record<string, unknown>
    errorSummary: string | null
  }) => {
    await db
      .update(schema.freeFirehoseRun)
      .set({
        status: input.status,
        finishedAt: new Date(),
        durationMs: input.durationMs,
        fetchedCount: input.counts.fetched,
        insertedCount: input.counts.inserted,
        dedupedCount: input.counts.deduped,
        skippedCount: input.counts.skipped,
        failedCount: input.counts.failed,
        providerBreakdown: input.providerBreakdown as Record<string, unknown>,
        errorSummary: input.errorSummary,
      })
      .where(eq(schema.freeFirehoseRun.runId, input.runId))
  },
})

const runBodySchema = t.Object({
  dryRun: t.Optional(t.Boolean()),
  confirmation: t.Optional(t.Boolean()),
  overrideRequested: t.Optional(t.Boolean()),
  overrideReason: t.Optional(t.String({ maxLength: 500 })),
  confirmedRisk: t.Optional(t.Boolean()),
})

type RunBody = {
  dryRun?: boolean
  confirmation?: boolean
  overrideRequested?: boolean
  overrideReason?: string
  confirmedRisk?: boolean
}

export const createFreeFirehoseAdminRoute = ({
  db,
  env,
  now = () => new Date(),
}: {
  db: ApiDb
  env: FreeFirehoseEnv
  now?: () => Date
}) =>
  new Elysia()
    .post(
      '/admin/free-firehose/estimate',
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
            if (!env.FREE_FIREHOSE_ENABLED) {
              context.set.status = 503
              return {
                ok: false as const,
                code: 'FREE_FIREHOSE_DISABLED' as const,
                message: 'Set FREE_FIREHOSE_ENABLED=true on the API container to enable.',
                requestId,
              }
            }
            const runners = buildFreeFirehoseRunners({
              env,
              db,
              runId: 'estimate',
              ingestionRunId: null,
            })
            const estimate = estimateFreeFirehoseVolume(runners)

            // Weekly cap status: include for the UI confirmation step.
            // Compute the count via SQL `now() - interval '7 days'` to avoid
            // sending a JS Date through the parameter binding (see history
            // adapter comment above).
            let runsLastWeek = 0
            try {
              const [weeklyRow] = await db
                .select({ count: sql<number>`count(*)`.as('count') })
                .from(schema.freeFirehoseRun)
                .where(
                  sql`${schema.freeFirehoseRun.startedAt} >= now() - interval '7 days' AND ${schema.freeFirehoseRun.mode} = 'live'`
                )
              runsLastWeek = Number(weeklyRow?.count ?? 0)
            } catch (error) {
              logApiEvent({
                level: 'error',
                msg: 'free_firehose_estimate_weekly_quota_failed',
                requestId,
                stage: 'weekly_quota',
                providerCount: estimate.providers.length,
                ...toErrorLogFields({ error, includeStack: false }),
              })
              context.set.status = 500
              return {
                ok: false as const,
                code: 'FREE_FIREHOSE_ESTIMATE_FAILED' as const,
                message: 'Unable to compute weekly quota for Free Firehose estimate.',
                requestId,
              }
            }
            return {
              ok: true as const,
              requestId,
              maxRecords: estimate.maxRecords,
              providers: estimate.providers,
              weeklyCap: env.FREE_FIREHOSE_MAX_RUNS_PER_WEEK,
              runsLastWeek,
              wouldBeBlockedByCap: runsLastWeek >= env.FREE_FIREHOSE_MAX_RUNS_PER_WEEK,
              requiresConfirmation: true,
              adminOverrideAllowed: true,
              estimatedCostUsd: 0,
              budgetRemainingUsd: null,
              warnings:
                runsLastWeek >= env.FREE_FIREHOSE_MAX_RUNS_PER_WEEK
                  ? [
                      'Weekly free-firehose cap is exceeded. Live admin override requires confirmation, confirmedRisk, and an audit reason is recommended.',
                    ]
                  : [],
              llmEnrichmentEnabled: false,
            }
          },
        })
      },
      { body: t.Optional(t.Object({})) }
    )
    .post(
      '/admin/free-firehose/run',
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
            if (!env.FREE_FIREHOSE_ENABLED) {
              context.set.status = 503
              return {
                ok: false as const,
                code: 'FREE_FIREHOSE_DISABLED' as const,
                message: 'Set FREE_FIREHOSE_ENABLED=true on the API container to enable.',
                requestId,
              }
            }
            const body = context.body as RunBody
            const dryRun = body.dryRun !== false
            const mode: 'dry_run' | 'live' = dryRun ? 'dry_run' : 'live'
            if (mode === 'live' && body.confirmation !== true) {
              context.set.status = 412
              return {
                ok: false as const,
                code: 'CONFIRMATION_REQUIRED' as const,
                message: 'Free Firehose live runs require explicit `confirmation: true`.',
                requestId,
              }
            }
            if (mode === 'live' && body.overrideRequested === true && body.confirmedRisk !== true) {
              context.set.status = 412
              return {
                ok: false as const,
                code: 'OVERRIDE_RISK_CONFIRMATION_REQUIRED' as const,
                message: 'Free Firehose quota override requires explicit `confirmedRisk: true`.',
                requestId,
              }
            }

            const runId = `firehose-${randomUUID()}`
            const startedAt = new Date()

            // Open a parallel signal_ingestion_run record so item rows reference it.
            const [ingestionRun] = await db
              .insert(schema.signalIngestionRun)
              .values({
                provider: 'free_firehose',
                runType: 'manual_import',
                startedAt,
                status: 'running',
                requestId,
              })
              .returning({ id: schema.signalIngestionRun.id })
            const ingestionRunId = ingestionRun?.id ?? null

            const runners = buildFreeFirehoseRunners({ env, db, runId, ingestionRunId })
            const history = buildHistoryAdapter({ db })
            const outcome = await runFreeFirehose({
              runId,
              mode,
              providers: runners,
              history,
              maxRunsPerWeek: env.FREE_FIREHOSE_MAX_RUNS_PER_WEEK,
              now,
              quotaOverride:
                mode === 'live' && body.overrideRequested === true
                  ? {
                      requested: true,
                      confirmedRisk: body.confirmedRisk === true,
                      reason: body.overrideReason?.trim() || null,
                    }
                  : null,
            })

            if (outcome.quota.overrideUsed) {
              logApiEvent({
                level: 'warn',
                msg: 'free_firehose_quota_override_used',
                requestId,
                runId,
                runsLastWeek: outcome.quota.runsLastWeek,
                weeklyCap: outcome.quota.maxRunsPerWeek,
                overrideReason: outcome.quota.overrideReason,
              })
            }

            if (ingestionRunId !== null) {
              await db
                .update(schema.signalIngestionRun)
                .set({
                  finishedAt: new Date(),
                  status:
                    outcome.status === 'success'
                      ? 'success'
                      : outcome.status === 'partial'
                        ? 'partial'
                        : 'failed',
                  fetchedCount: outcome.counts.fetched,
                  insertedCount: outcome.counts.inserted,
                  dedupedCount: outcome.counts.deduped,
                  failedCount: outcome.counts.failed,
                  errorSummary: outcome.errorSummary,
                  durationMs: outcome.durationMs,
                })
                .where(eq(schema.signalIngestionRun.id, ingestionRunId))
            }

            const httpStatus = outcome.status === 'skipped_quota' ? 429 : 200
            context.set.status = httpStatus
            return {
              ok: outcome.status === 'success' || outcome.status === 'partial',
              requestId,
              runId,
              mode,
              status: outcome.status,
              counts: outcome.counts,
              providerBreakdown: outcome.providerBreakdown,
              durationMs: outcome.durationMs,
              estimatedMaxRecords: outcome.estimatedMaxRecords,
              estimatedCostUsd: 0,
              budgetRemainingUsd: null,
              quota: outcome.quota,
              warnings:
                outcome.status === 'skipped_quota'
                  ? [outcome.errorSummary ?? 'Weekly cap reached.']
                  : outcome.quota.overrideUsed
                    ? ['Weekly cap was exceeded and explicitly overridden by admin.']
                    : [],
              errorSummary: outcome.errorSummary,
              ingestionRunId,
            }
          },
        })
      },
      { body: t.Optional(runBodySchema) }
    )

export const __testing = { adaptNewsItemToSignalItem, buildHistoryAdapter }
