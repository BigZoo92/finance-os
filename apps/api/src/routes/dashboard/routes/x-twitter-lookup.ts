/**
 * Admin route: lookup an X handle, cache the response in Redis for 24h,
 * persist `external_id` + `profile_image_url` + `profile_metadata` + `profile_cached_at`
 * on `signal_source` when the handle matches one of the followed accounts.
 *
 * Cost discipline:
 *   - One $0.01 user-read per cache miss (X bills lookups by resource).
 *   - Cache hit costs $0 and bypasses X entirely.
 *   - If today's user-read cap is reached, refuse the call rather than spend.
 *   - `forceRefresh=true` bypasses the cache but still respects the cap.
 *
 * Sensitive auth: admin session required. The route does NOT silently fall
 * back to demo if a bad bearer token is provided (uses rejectInvalidCredentials).
 */

import { schema } from '@finance-os/db'
import { and, eq, isNull } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { rejectInvalidCredentials, requireAdmin } from '../../../auth/guard'
import { logApiEvent } from '../../../observability/logger'
import type { ApiDb, RedisClient } from '../types'
import {
  X_BATCH_MAX_USERNAMES,
  createXTwitterProfileClient,
  normalizeXHandle,
  type XTwitterBatchLookupOutcome,
  type XTwitterFetch,
  type XTwitterProfile,
} from '../services/providers/x-twitter-profile-client'
import {
  readXUsageSnapshot,
  writeXUsageLedger,
} from '../services/providers/x-twitter-usage-ledger'

const lookupBodySchema = t.Object({
  handle: t.String({ minLength: 1, maxLength: 32 }),
  forceRefresh: t.Optional(t.Boolean()),
  persist: t.Optional(t.Boolean()),
})

type LookupBody = {
  handle: string
  forceRefresh?: boolean
  persist?: boolean
}

const CACHE_TTL_SECONDS = 24 * 60 * 60
const cacheKey = (handle: string) => `x:profile:v1:${handle.replace(/^@/, '').toLowerCase()}`

const defaultFetcher: XTwitterFetch = async ({ url, bearerToken }) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'User-Agent': 'Finance-OS X Profile Lookup/1.0',
    },
  })
  const parsed = await response.json().catch(() => ({}))
  const body: Record<string, unknown> =
    parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  return { status: response.status, body }
}

/**
 * Resolve a batch of X handles against the DB and the X `users/by` endpoint.
 *
 * For each source the caller passes (or every enabled X source when none are
 * specified), we:
 *   1. Normalize the persisted handle (handles past pollution like `@@foo`).
 *   2. If `force=true` OR `externalId` is missing, batch-lookup via X.
 *   3. Persist `externalId`, `handle` (canonical), `profileImageUrl`,
 *      `profileMetadata`, `profileCachedAt` on each resolved source.
 *
 * Returns a per-source summary so the UI can show resolved / already_resolved
 * / invalid / not_found / provider_error counts in one shot.
 */
export type ResolveAllSummaryItem = {
  sourceId: number
  handleBefore: string
  handleAfter: string | null
  externalId: string | null
  status:
    | 'resolved'
    | 'already_resolved'
    | 'invalid_handle'
    | 'not_found'
    | 'provider_error'
    | 'rate_limited'
    | 'forbidden'
    | 'token_missing_or_invalid'
    | 'budget_exceeded'
  errorMessage: string | null
}

const mapBatchItemToStatus = (
  itemCode: 'NOT_FOUND' | 'INVALID_HANDLE' | 'TOKEN_MISSING' | 'TOKEN_INVALID' | 'PAYMENT_REQUIRED' | 'FORBIDDEN' | 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE' | 'NETWORK_ERROR'
): ResolveAllSummaryItem['status'] => {
  switch (itemCode) {
    case 'NOT_FOUND':
      return 'not_found'
    case 'INVALID_HANDLE':
      return 'invalid_handle'
    case 'TOKEN_MISSING':
    case 'TOKEN_INVALID':
      return 'token_missing_or_invalid'
    case 'PAYMENT_REQUIRED':
    case 'FORBIDDEN':
      return 'forbidden'
    case 'RATE_LIMITED':
      return 'rate_limited'
    default:
      return 'provider_error'
  }
}

export const createXTwitterLookupRoute = ({
  db,
  redisClient,
  env,
  fetcher = defaultFetcher,
  now = () => new Date(),
}: {
  db: ApiDb
  redisClient: RedisClient
  env: {
    NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN?: string | undefined
    X_MAX_USER_READS_PER_DAY: number
  }
  fetcher?: XTwitterFetch
  now?: () => Date
}) =>
  new Elysia().post(
    '/signals/sources/x-twitter/lookup-handle',
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
          const body = context.body as LookupBody
          const normalized = normalizeXHandle(body.handle)
          if (!normalized.ok) {
            context.set.status = 400
            return {
              ok: false as const,
              code: 'INVALID_HANDLE' as const,
              message: normalized.reason,
              verificationStatus: 'unverified_invalid_handle' as const,
              requestId,
            }
          }
          const handle = normalized.handle
          const forceRefresh = body.forceRefresh === true
          const persist = body.persist !== false

          // 1. Cache check
          const key = cacheKey(handle)
          if (!forceRefresh) {
            const cached = await redisClient.get(key)
            if (cached) {
              try {
                const profile = JSON.parse(cached) as XTwitterProfile
                return {
                  ok: true as const,
                  source: 'cache' as const,
                  fetchedFromX: false,
                  userReads: 0,
                  estimatedCostUsd: 0,
                  profile,
                  verificationStatus: 'verified' as const,
                  requestId,
                }
              } catch {
                // Malformed cache entry — fall through to network.
              }
            }
          }

          // 2. Budget check before spending a $0.01 user read.
          const usage = await readXUsageSnapshot(db, now())
          if (usage.userReadsToday >= env.X_MAX_USER_READS_PER_DAY) {
            await writeXUsageLedger(db, {
              runId: null,
              endpoint: 'users/by/username',
              userReads: 0,
              estimatedCostUsd: 0,
              statusCode: null,
              errorCode: 'BUDGET_EXCEEDED',
            })
            context.set.status = 429
            return {
              ok: false as const,
              code: 'BUDGET_EXCEEDED' as const,
              message: `Daily user-read cap reached (${usage.userReadsToday}/${env.X_MAX_USER_READS_PER_DAY}).`,
              verificationStatus: 'unverified_budget_exceeded' as const,
              requestId,
            }
          }

          // 3. Lookup
          const client = createXTwitterProfileClient({
            bearerToken: env.NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN ?? '',
            fetcher,
          })
          const outcome = await client.lookupHandle(handle)

          // 4. Ledger row, regardless of outcome.
          const errorCode = outcome.ok ? null : outcome.code
          await writeXUsageLedger(db, {
            runId: null,
            endpoint: 'users/by/username',
            userReads: outcome.userReads,
            estimatedCostUsd: outcome.estimatedCostUsd,
            statusCode: outcome.ok ? 200 : outcome.statusCode,
            errorCode,
          })

          if (!outcome.ok) {
            const status =
              outcome.code === 'TOKEN_MISSING' ||
              outcome.code === 'TOKEN_INVALID'
                ? 401
                : outcome.code === 'PAYMENT_REQUIRED'
                  ? 402
                  : outcome.code === 'FORBIDDEN'
                    ? 403
                    : outcome.code === 'NOT_FOUND'
                      ? 404
                      : outcome.code === 'RATE_LIMITED'
                        ? 429
                        : outcome.code === 'INVALID_HANDLE'
                          ? 400
                          : 502
            context.set.status = status
            return {
              ok: false as const,
              code: outcome.code,
              message: outcome.message,
              verificationStatus: mapVerificationStatus(outcome.code),
              userReads: outcome.userReads,
              estimatedCostUsd: outcome.estimatedCostUsd,
              statusCode: outcome.statusCode,
              requestId,
            }
          }

          // 5. Cache 24h
          await redisClient.set(key, JSON.stringify(outcome.profile), { EX: CACHE_TTL_SECONDS })

          // 6. Optional persist to signal_source when the handle is followed.
          let persisted = false
          if (persist) {
            persisted = await persistProfileOnSignalSource({
              db,
              handle,
              profile: outcome.profile,
              now: now(),
            })
          }

          return {
            ok: true as const,
            source: 'x_api' as const,
            fetchedFromX: true,
            userReads: outcome.userReads,
            estimatedCostUsd: outcome.estimatedCostUsd,
            persisted,
            profile: outcome.profile,
            verificationStatus: 'verified' as const,
            requestId,
          }
        },
      })
    },
    { body: lookupBodySchema }
  )
  .post(
    '/signals/sources/x-twitter/resolve-all',
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
          const body = (context.body ?? {}) as { force?: boolean; sourceIds?: number[] }
          const force = body.force === true
          const filterIds =
            Array.isArray(body.sourceIds) && body.sourceIds.length > 0
              ? body.sourceIds.filter(id => Number.isInteger(id) && id > 0)
              : null

          // 1. Read candidate rows. Default = enabled X sources with no
          //    externalId. force=true relaxes to all enabled X sources.
          const baseConditions = [eq(schema.signalSource.provider, 'x_twitter')]
          if (!force) baseConditions.push(isNull(schema.signalSource.externalId))
          baseConditions.push(eq(schema.signalSource.enabled, true))
          const allRows = await db
            .select({
              id: schema.signalSource.id,
              handle: schema.signalSource.handle,
              externalId: schema.signalSource.externalId,
            })
            .from(schema.signalSource)
            .where(and(...baseConditions))

          const rows = filterIds
            ? allRows.filter(r => filterIds.includes(r.id))
            : allRows

          if (rows.length === 0) {
            return {
              ok: true as const,
              requestId,
              summary: {
                total: 0,
                resolved: 0,
                alreadyResolved: 0,
                invalidHandle: 0,
                notFound: 0,
                providerError: 0,
                tokenInvalid: 0,
                rateLimited: 0,
                forbidden: 0,
              },
              items: [] as ResolveAllSummaryItem[],
              userReads: 0,
              estimatedCostUsd: 0,
              rateLimit: null,
              providerError: null,
            }
          }

          // 2. Budget gate. Worst-case = rows.length user reads — refuse if
          //    we don't have headroom under the daily cap.
          const usage = await readXUsageSnapshot(db, now())
          const headroom = env.X_MAX_USER_READS_PER_DAY - usage.userReadsToday
          if (headroom <= 0) {
            context.set.status = 429
            return {
              ok: false as const,
              code: 'BUDGET_EXCEEDED' as const,
              message: `Daily user-read cap reached (${usage.userReadsToday}/${env.X_MAX_USER_READS_PER_DAY}).`,
              requestId,
            }
          }

          // 3. Normalize all handles first. Invalid rows are reported with
          //    the original `handle` so the admin can fix them in the UI.
          type Candidate = {
            sourceId: number
            originalHandle: string
            canonical: string | null
            invalidReason: string | null
          }
          const candidates: Candidate[] = rows.map(r => {
            const normalized = normalizeXHandle(r.handle)
            return normalized.ok
              ? { sourceId: r.id, originalHandle: r.handle, canonical: normalized.handle, invalidReason: null }
              : {
                  sourceId: r.id,
                  originalHandle: r.handle,
                  canonical: null,
                  invalidReason: normalized.reason,
                }
          })

          const items: ResolveAllSummaryItem[] = []
          for (const c of candidates) {
            if (c.canonical === null) {
              items.push({
                sourceId: c.sourceId,
                handleBefore: c.originalHandle,
                handleAfter: null,
                externalId: null,
                status: 'invalid_handle',
                errorMessage: c.invalidReason,
              })
            }
          }

          const toLookup = candidates.filter(c => c.canonical !== null)
          // 4. Chunk to X_BATCH_MAX_USERNAMES. Track the aggregated rate
          //    limit + provider error so the UI can show one banner.
          let userReadsTotal = 0
          let estimatedCostUsdTotal = 0
          let lastRateLimit: XTwitterBatchLookupOutcome['rateLimit'] = null
          let providerError: XTwitterBatchLookupOutcome['providerError'] = null
          const client = createXTwitterProfileClient({
            bearerToken: env.NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN ?? '',
            fetcher,
          })
          for (let i = 0; i < toLookup.length; i += X_BATCH_MAX_USERNAMES) {
            // Stop chunking early if the previous chunk already produced a
            // batch-wide provider error — repeating the same 401/429 just
            // burns the rate-limit window.
            if (providerError !== null) break
            const chunk = toLookup.slice(i, i + X_BATCH_MAX_USERNAMES)
            const handles = chunk.map(c => c.canonical as string)
            const outcome = await client.lookupHandlesBatch(handles)
            userReadsTotal += outcome.userReads
            estimatedCostUsdTotal += outcome.estimatedCostUsd
            if (outcome.rateLimit) lastRateLimit = outcome.rateLimit
            if (outcome.providerError) providerError = outcome.providerError

            // 5. Persist + emit per-item summary
            for (const item of outcome.items) {
              const candidate = chunk.find(c => c.canonical === item.canonicalHandle) ??
                chunk.find(c => c.originalHandle === item.handle)
              const sourceId = candidate?.sourceId ?? rows.find(r => r.handle === item.handle)?.id
              if (sourceId === undefined) continue
              const handleBefore = candidate?.originalHandle ?? item.handle

              if (item.ok) {
                await persistProfileOnSignalSourceById({
                  db,
                  sourceId,
                  canonicalHandle: item.profile.username,
                  profile: item.profile,
                  now: now(),
                })
                // Cache 24h so subsequent /lookup-handle hits skip the
                // network call.
                await redisClient.set(
                  cacheKey(item.profile.username),
                  JSON.stringify(item.profile),
                  { EX: 24 * 60 * 60 }
                )
                items.push({
                  sourceId,
                  handleBefore,
                  handleAfter: item.profile.username,
                  externalId: item.profile.id,
                  status: 'resolved',
                  errorMessage: null,
                })
              } else {
                items.push({
                  sourceId,
                  handleBefore,
                  handleAfter: item.canonicalHandle,
                  externalId: null,
                  status: mapBatchItemToStatus(item.code),
                  errorMessage: item.message,
                })
              }
            }

            // Single ledger row per batch HTTP call.
            await writeXUsageLedger(db, {
              runId: null,
              endpoint: 'users/by',
              userReads: outcome.userReads,
              estimatedCostUsd: outcome.estimatedCostUsd,
              statusCode: outcome.providerError?.statusCode ?? 200,
              errorCode: outcome.providerError?.code ?? null,
            })
          }

          // 6. Mark sources that were already resolved (force=false skipped
          //    them entirely from the candidate set, so this branch only
          //    matters when force=true and the row was already resolved
          //    but a subsequent X call surfaced an error — handled inline
          //    above). For the default flow, candidates with non-null
          //    externalId would have been filtered out by the where clause
          //    so we don't need a special "already_resolved" case here.

          logApiEvent({
            level: providerError ? 'warn' : 'info',
            msg: 'x_twitter_resolve_all',
            requestId,
            stage: 'resolve_all',
            totalRows: rows.length,
            resolved: items.filter(i => i.status === 'resolved').length,
            invalidHandle: items.filter(i => i.status === 'invalid_handle').length,
            notFound: items.filter(i => i.status === 'not_found').length,
            providerErrorCount: items.filter(
              i =>
                i.status === 'provider_error' ||
                i.status === 'rate_limited' ||
                i.status === 'forbidden' ||
                i.status === 'token_missing_or_invalid'
            ).length,
            userReadsTotal,
            estimatedCostUsdTotal,
            providerErrorCode: providerError?.code ?? null,
          })

          const summary = {
            total: rows.length,
            resolved: items.filter(i => i.status === 'resolved').length,
            alreadyResolved: 0,
            invalidHandle: items.filter(i => i.status === 'invalid_handle').length,
            notFound: items.filter(i => i.status === 'not_found').length,
            providerError: items.filter(i => i.status === 'provider_error').length,
            tokenInvalid: items.filter(i => i.status === 'token_missing_or_invalid')
              .length,
            rateLimited: items.filter(i => i.status === 'rate_limited').length,
            forbidden: items.filter(i => i.status === 'forbidden').length,
          }

          return {
            ok: true as const,
            requestId,
            summary,
            items,
            userReads: userReadsTotal,
            estimatedCostUsd: estimatedCostUsdTotal,
            rateLimit: lastRateLimit,
            providerError,
          }
        },
      })
    },
    {
      body: t.Optional(
        t.Object({
          force: t.Optional(t.Boolean()),
          sourceIds: t.Optional(t.Array(t.Integer())),
        })
      ),
    }
  )

const mapVerificationStatus = (
  code: string
):
  | 'verified'
  | 'unverified_payment_required'
  | 'unverified_forbidden'
  | 'unverified_rate_limited'
  | 'unverified_not_found'
  | 'unverified_token_invalid'
  | 'unverified_invalid_handle'
  | 'unverified_provider_error' => {
  switch (code) {
    case 'PAYMENT_REQUIRED':
      return 'unverified_payment_required'
    case 'FORBIDDEN':
      return 'unverified_forbidden'
    case 'RATE_LIMITED':
      return 'unverified_rate_limited'
    case 'NOT_FOUND':
      return 'unverified_not_found'
    case 'TOKEN_INVALID':
    case 'TOKEN_MISSING':
      return 'unverified_token_invalid'
    case 'INVALID_HANDLE':
      return 'unverified_invalid_handle'
    default:
      return 'unverified_provider_error'
  }
}

/**
 * Same as {@link persistProfileOnSignalSource} but addresses the row by id
 * AND rewrites the stored `handle` column to the X-canonical form. Used by
 * the batch resolve-all flow to fix historical handle pollution (e.g.
 * `@@tom_doerr`) in the same write that caches the profile.
 */
const persistProfileOnSignalSourceById = async ({
  db,
  sourceId,
  canonicalHandle,
  profile,
  now,
}: {
  db: ApiDb
  sourceId: number
  canonicalHandle: string
  profile: XTwitterProfile
  now: Date
}): Promise<void> => {
  await db
    .update(schema.signalSource)
    .set({
      handle: canonicalHandle,
      externalId: profile.id,
      profileImageUrl: profile.profileImageUrl,
      profileMetadata: {
        username: profile.username,
        name: profile.name,
        description: profile.description,
        profileBannerUrl: profile.profileBannerUrl,
        verified: profile.verified,
        verifiedType: profile.verifiedType,
        protected: profile.protected,
        publicMetrics: profile.publicMetrics,
        createdAt: profile.createdAt,
      },
      profileCachedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.signalSource.id, sourceId))
}

const persistProfileOnSignalSource = async ({
  db,
  handle,
  profile,
  now,
}: {
  db: ApiDb
  handle: string
  profile: XTwitterProfile
  now: Date
}): Promise<boolean> => {
  // Match by case-insensitive handle on the X provider rows. We don't INSERT
  // a row from a lookup — the admin must explicitly add the source via the
  // existing signal_source admin flow. Lookup only enriches existing rows.
  const result = await db
    .update(schema.signalSource)
    .set({
      externalId: profile.id,
      profileImageUrl: profile.profileImageUrl,
      profileMetadata: {
        username: profile.username,
        name: profile.name,
        description: profile.description,
        profileBannerUrl: profile.profileBannerUrl,
        verified: profile.verified,
        verifiedType: profile.verifiedType,
        protected: profile.protected,
        publicMetrics: profile.publicMetrics,
        createdAt: profile.createdAt,
      },
      profileCachedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.signalSource.handle, handle))
    .returning({ id: schema.signalSource.id })
  return result.length > 0
}

export const __testing = {
  mapVerificationStatus,
  cacheKey,
}
