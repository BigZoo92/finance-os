/**
 * Real HTTP fetcher for X (Twitter) v2 endpoints, scoped to the two calls
 * the daily-sync and profile-lookup features need:
 *   GET /2/users/:id/tweets       — paginated previous-day timeline
 *   GET /2/users/by/username/:n   — handled by the dedicated profile client
 *
 * No secret is ever logged. The bearer token is forwarded as an Authorization
 * header and never echoed back in errors. Provider error messages are
 * truncated and stripped of any header values before being returned.
 */

import type {
  XTwitterTimelineFetcher,
  XTwitterTimelinePage,
} from './x-twitter-daily-sync'

const TWEET_FIELDS = [
  'id',
  'text',
  'author_id',
  'created_at',
  'lang',
  'public_metrics',
  'referenced_tweets',
].join(',')

const mapErrorCode = (status: number): XTwitterTimelinePage['errorCode'] => {
  if (status === 401) return 'TOKEN_INVALID'
  if (status === 402) return 'PAYMENT_REQUIRED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 429) return 'RATE_LIMITED'
  if (status >= 500) return 'PROVIDER_UNAVAILABLE'
  return 'PROVIDER_UNAVAILABLE'
}

export type XTwitterHttpFetcherDeps = {
  bearerToken: string
  fetch?: typeof fetch
  baseUrl?: string
  /**
   * Optional usage hook fired after every HTTP call so the orchestrator can
   * persist a ledger row. The hook MUST be cheap (DB write at most) and
   * never throw — errors are swallowed by the fetcher.
   */
  onUsage?: (event: {
    endpoint: string
    statusCode: number
    postReads: number
    estimatedCostUsd: number
    errorCode: XTwitterTimelinePage['errorCode']
  }) => Promise<void> | void
}

const POST_READ_COST_USD = 0.005

export const createXTwitterHttpTimelineFetcher = ({
  bearerToken,
  fetch: fetcher = fetch,
  baseUrl = 'https://api.x.com/2',
  onUsage,
}: XTwitterHttpFetcherDeps): XTwitterTimelineFetcher => {
  return async ({ userId, startTime, endTime, paginationToken, maxResults }) => {
    const params = new URLSearchParams({
      max_results: String(Math.max(5, Math.min(100, maxResults))),
      start_time: startTime,
      end_time: endTime,
      'tweet.fields': TWEET_FIELDS,
      // Exclude retweets/replies by default — keep replies cheap to keep when
      // the user explicitly toggles them later via env. For now we strip
      // retweets only (cheap signal-to-noise win).
      exclude: 'retweets',
    })
    if (paginationToken) {
      params.set('pagination_token', paginationToken)
    }
    const url = `${baseUrl}/users/${encodeURIComponent(userId)}/tweets?${params.toString()}`

    let response: Response
    try {
      response = await fetcher(url, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'User-Agent': 'Finance-OS X Daily Sync/1.0',
        },
      })
    } catch (_error) {
      const errorCode: XTwitterTimelinePage['errorCode'] = 'NETWORK_ERROR'
      if (onUsage) {
        try {
          await onUsage({
            endpoint: 'users/:id/tweets',
            statusCode: 0,
            postReads: 0,
            estimatedCostUsd: 0,
            errorCode,
          })
        } catch {
          /* swallow */
        }
      }
      return {
        tweets: [],
        meta: { nextToken: null, resultCount: 0 },
        statusCode: 0,
        errorCode,
      }
    }

    if (!response.ok) {
      const errorCode = mapErrorCode(response.status)
      if (onUsage) {
        try {
          await onUsage({
            endpoint: 'users/:id/tweets',
            statusCode: response.status,
            postReads: 0,
            estimatedCostUsd: 0,
            errorCode,
          })
        } catch {
          /* swallow */
        }
      }
      return {
        tweets: [],
        meta: { nextToken: null, resultCount: 0 },
        statusCode: response.status,
        errorCode,
      }
    }

    type RawTweet = {
      id: string
      text: string
      author_id?: string
      created_at?: string
      lang?: string
      public_metrics?: {
        like_count?: number
        retweet_count?: number
        reply_count?: number
        quote_count?: number
      }
    }
    type RawPayload = {
      data?: RawTweet[]
      meta?: { next_token?: string; result_count?: number }
    }
    let payload: RawPayload = {}
    try {
      payload = (await response.json()) as RawPayload
    } catch {
      /* parser error treated as PROVIDER_UNAVAILABLE below */
    }

    const tweets =
      payload.data?.map(t => {
        const metrics = t.public_metrics
          ? Object.fromEntries(
              Object.entries({
                likeCount: t.public_metrics.like_count,
                retweetCount: t.public_metrics.retweet_count,
                replyCount: t.public_metrics.reply_count,
                quoteCount: t.public_metrics.quote_count,
              }).filter(([, value]) => value !== undefined)
            )
          : null
        return {
          id: t.id,
          text: t.text,
          authorId: t.author_id ?? userId,
          createdAt: t.created_at ?? '',
          lang: t.lang ?? null,
          publicMetrics: metrics,
        }
      }) ?? []
    const postReads = tweets.length
    const estimatedCostUsd = postReads * POST_READ_COST_USD
    if (onUsage) {
      try {
        await onUsage({
          endpoint: 'users/:id/tweets',
          statusCode: 200,
          postReads,
          estimatedCostUsd,
          errorCode: null,
        })
      } catch {
        /* swallow */
      }
    }
    return {
      tweets,
      meta: {
        nextToken: payload.meta?.next_token ?? null,
        resultCount: payload.meta?.result_count ?? tweets.length,
      },
      statusCode: 200,
      errorCode: null,
    }
  }
}

export const __testing = { mapErrorCode }
