import type { NewsProviderAdapter } from '../news-provider-types'
import { fetchJson, sanitizePayload, trimOrNull } from '../news-provider-utils'

interface TwitterRecentSearchResponse {
  data?: Array<{
    id?: string
    text?: string
    created_at?: string
    lang?: string
    author_id?: string
  }>
}

export interface XTwitterWatchlistEntry {
  handle: string
  includePatterns: string[]
  excludePatterns: string[]
}

/**
 * Build a X API v2 recent search query from a base query and optional watchlist handles.
 *
 * If watchlist handles are provided, the query is composed as:
 *   (from:handle1 OR from:handle2 ...) [baseKeywords] -is:retweet
 *
 * X API v2 recent search supports the `from:` operator.
 * This is official API usage, not scraping.
 */
export const buildXWatchlistQuery = (
  baseQuery: string,
  watchlist: XTwitterWatchlistEntry[]
): string => {
  if (watchlist.length === 0) return baseQuery

  const fromClauses = watchlist.map(entry => `from:${entry.handle.replace(/^@/, '')}`)
  const fromGroup = `(${fromClauses.join(' OR ')})`

  // Strip existing -is:retweet from base to avoid duplication
  const baseClean = baseQuery.replace(/\s*-is:retweet\s*/g, '').trim()

  // If we have watchlist handles, we want posts from those handles.
  // If there's also a keyword filter, combine them.
  if (baseClean) {
    return `${fromGroup} (${baseClean}) -is:retweet`
  }
  return `${fromGroup} -is:retweet`
}

export const createXTwitterNewsProvider = ({
  enabled,
  bearerToken,
  query,
  watchlist,
}: {
  enabled: boolean
  bearerToken: string | undefined
  query: string
  watchlist?: XTwitterWatchlistEntry[]
}): NewsProviderAdapter => ({
  provider: 'x_twitter',
  enabled,
  cooldownMs: 2_500,
  async fetchItems({ requestId, maxItems }) {
    if (!bearerToken) {
      return []
    }

    const effectiveQuery =
      watchlist && watchlist.length > 0
        ? buildXWatchlistQuery(query, watchlist)
        : query

    const payload = await fetchJson<TwitterRecentSearchResponse>({
      url: `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(effectiveQuery)}&max_results=${Math.min(maxItems, 100)}&tweet.fields=created_at,lang,author_id`,
      requestId,
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    })

    return (payload.data ?? [])
      .map(tweet => {
        const providerArticleId = trimOrNull(tweet.id)
        const title = trimOrNull(tweet.text)
        const publishedAt = tweet.created_at ? new Date(tweet.created_at) : null
        if (!providerArticleId || !title || !publishedAt || Number.isNaN(publishedAt.getTime())) {
          return null
        }

        const providerUrl = `https://x.com/i/web/status/${providerArticleId}`

        return {
          provider: 'x_twitter' as const,
          providerArticleId,
          providerUrl,
          canonicalUrl: providerUrl,
          sourceName: 'X',
          sourceDomain: 'x.com',
          sourceType: 'social' as const,
          title,
          summary: null,
          contentSnippet: title,
          language: trimOrNull(tweet.lang) ?? 'en',
          country: null,
          region: null,
          geoScope: 'global' as const,
          publishedAt,
          metadata: trimOrNull(tweet.author_id) ? { authorId: tweet.author_id } : null,
          rawPayload: sanitizePayload(tweet),
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, maxItems)
  },
})
