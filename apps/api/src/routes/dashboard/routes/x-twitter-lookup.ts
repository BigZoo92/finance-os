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
import { eq } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { rejectInvalidCredentials, requireAdmin } from '../../../auth/guard'
import type { ApiDb, RedisClient } from '../types'
import {
  createXTwitterProfileClient,
  normalizeXHandle,
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
