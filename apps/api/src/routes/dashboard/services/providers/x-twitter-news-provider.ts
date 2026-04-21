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

export const createXTwitterNewsProvider = ({
  enabled,
  bearerToken,
  query,
}: {
  enabled: boolean
  bearerToken: string | undefined
  query: string
}): NewsProviderAdapter => ({
  provider: 'x_twitter',
  enabled,
  cooldownMs: 2_500,
  async fetchItems({ requestId, maxItems }) {
    if (!bearerToken) {
      return []
    }

    const payload = await fetchJson<TwitterRecentSearchResponse>({
      url: `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${Math.min(maxItems, 100)}&tweet.fields=created_at,lang,author_id`,
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
          sourceType: 'media' as const,
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
