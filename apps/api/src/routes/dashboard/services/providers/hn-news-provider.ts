import type { NewsProviderAdapter } from '../news-provider-types'
import { fetchJson, sanitizePayload, trimOrNull } from '../news-provider-utils'

export const createHnNewsProvider = ({
  enabled,
  query,
}: {
  enabled: boolean
  query: string
}): NewsProviderAdapter => ({
  provider: 'hn_algolia',
  enabled,
  cooldownMs: 1_000,
  async fetchItems({ requestId, maxItems }) {
    const payload = await fetchJson<{
      hits?: Array<{
        objectID?: string
        title?: string
        story_title?: string
        url?: string
        story_url?: string
        created_at?: string
        author?: string
      }>
    }>({
      url: `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story`,
      requestId,
    })

    return (payload.hits ?? [])
      .map(hit => {
        const title = trimOrNull(hit.title ?? hit.story_title)
        const providerUrl = trimOrNull(hit.url ?? hit.story_url)
        const providerArticleId = trimOrNull(hit.objectID)
        const publishedAt = hit.created_at ? new Date(hit.created_at) : null

        if (!title || !providerUrl || !providerArticleId || !publishedAt || Number.isNaN(publishedAt.getTime())) {
          return null
        }

        return {
          provider: 'hn_algolia' as const,
          providerArticleId,
          providerUrl,
          canonicalUrl: providerUrl,
          sourceName: 'Hacker News',
          sourceDomain: 'news.ycombinator.com',
          sourceType: 'tech_forum' as const,
          title,
          summary: null,
          contentSnippet: null,
          language: 'en',
          country: null,
          region: null,
          geoScope: 'global' as const,
          publishedAt,
          metadata: hit.author ? { author: hit.author } : null,
          rawPayload: sanitizePayload(hit),
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, maxItems)
  },
})
